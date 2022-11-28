// SPDX-License-Identifier: BUSL-1.1
import { ethers } from 'ethers'
import { EventEmitter } from 'events'
import fs from 'fs'
import type { Pool } from 'pg'
import type { RedisClientType } from 'redis'

import { EVMOrderSchema } from './schemas'
import type {
  ZZTokenInfo,
  ZZHttpServer,
  ZZOrder,
  ZZMarketInfo,
  AnyObject,
} from './types'
import {
  getNewAccessToken,
  modifyOldSignature,
  verifyMessage,
} from './cryptography'
import {
  parseSQLResultToZZOrder
} from './utils'

export default class API extends EventEmitter {
  ETHERS_PROVIDER: any
  EVMConfig: AnyObject = {}
  ERC20_ABI: any

  TOKEN_INFO: { [key: string]: ZZTokenInfo } = {}

  started = false
  redis: RedisClientType
  http: ZZHttpServer
  db: Pool

  constructor(
    db: Pool,
    http: ZZHttpServer,
    redis: RedisClientType
  ) {
    super()
    this.db = db
    this.redis = redis
    this.http = http
    this.http.api = this
  }

  start = async (port: number) => {
    if (this.started) return

    await this.redis.connect()

    this.ERC20_ABI = JSON.parse(fs.readFileSync('abi/ERC20.abi', 'utf8'))
    this.EVMConfig = JSON.parse(fs.readFileSync('EVMConfig.json', 'utf8'))

    // connect infura providers
    try {
      try {
        this.ETHERS_PROVIDER = new ethers.providers.InfuraProvider(
          this.EVMConfig.serverSettings.chainName,
          process.env.INFURA_PROJECT_ID
        )
        console.log(`Connected InfuraProvider for ${this.EVMConfig.serverSettings.chainName}`)
      } catch (e: any) {
        console.warn(
          `Could not connect InfuraProvider for ${this.EVMConfig.serverSettings.chainName}, trying RPC...`
        )
        this.ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider(
          this.EVMConfig.serverSettings.RPC
        )
        console.log(`Connected JsonRpcProvider for ${this.EVMConfig.serverSettings.chainName}`)
      }
    } catch (e: any) {
      console.error(e.message)
      throw new Error(`Failed to setup provider for ${this.EVMConfig.serverSettings.chainName}.`)
    }

    await this.cacheTokenInfo()

    this.started = true

    this.http.listen(port, () => {
      console.log(`Server listening on port ${port}.`)
    })
  }

  stop = async () => {
    if (!this.started) return
    await this.redis.disconnect()
    this.started = false
  }

  /**
   * cache tokenInfos from all currnetly known tokens
   */
  cacheTokenInfo = async () => {
    const tokenInfos = await this.db.query("SELECT * FROM token_infos;")
    for (let i = 0; tokenInfos.rows.length; i++) {
      const tokenInfo = tokenInfos.rows[i]
      this.TOKEN_INFO[tokenInfo.token_address] = {
        address: tokenInfo.token_address,
        symbol: tokenInfo.token_symbol,
        decimals: tokenInfo.token_decimals,
        name: tokenInfo.token_name
      }
    }
  }

  setTokenInfo = async (address: string, symbol: string, decimals: number, name: string, key: string): Promise<boolean> => {
    const adminKey: string = process.env.addNewTokenKey || 'testAdminKey'
    if (key !== adminKey) throw new Error('Unauthorized')
    
    const dbCheckAddress = await this.db.query("SELECT * FROM token_infos WHERE token_address=$1;", [address])
    if (dbCheckAddress.rows.length > 0) throw new Error('Token address is already used')

    const dbCheckSymbol = await this.db.query("SELECT * FROM token_infos WHERE token_symbol=$1;", [symbol])
    if (dbCheckSymbol.rows.length > 0) throw new Error('Token symbol is already used')

    const dbCheckName = await this.db.query("SELECT * FROM token_infos WHERE token_name=$1;", [name])
    if (dbCheckName.rows.length > 0) throw new Error('Token name is already used')

    const testTokenContract = new ethers.Contract(address, this.ERC20_ABI, this.ETHERS_PROVIDER)
    const [onChainName, onChainSymbol, onChainDecimals] = await Promise.all([
      testTokenContract.name(),
      testTokenContract.sysmbol(),
      testTokenContract.decimals()
    ])

    if (name !== onChainName) throw new Error('Token name does not match on chain name')
    if (symbol !== onChainSymbol) throw new Error('Token symbol does not match on chain symbol')
    if (decimals !== onChainDecimals) throw new Error('Token decimals does not match on chain decimals')

    const insertResult = await this.db.query(
      "INSERT INTO token_infos (token_address, token_symbol, token_name, token_decimals) VALUES ($1, $2, $3, $4);",
      [address, symbol, name, decimals]
    )

    return (insertResult.rows.length > 0)
  }

  /**
   * get tokenInfo for a given tokenSymbol
   * @param tokenSymbol symbol of that token
   * @returns tokenInfo as zzTokenInfo
   */
  getTokenInfo = (tokenSymbol: string): ZZTokenInfo => {
    const tokenInfo: ZZTokenInfo = this.TOKEN_INFO[tokenSymbol]
    if (!tokenInfo) throw new Error(`bad token ${tokenSymbol}`)
    return tokenInfo
  }

  getMarketInfo = (buyToken: string, sellToken: string): ZZMarketInfo => {
    const buyTokenInfo = this.getTokenInfo(buyToken)
    const sellTokenInfo = this.getTokenInfo(sellToken)

    return {
      buyToken: buyTokenInfo,
      sellToken: sellTokenInfo,
      exchangeAddress: this.EVMConfig.onChainSettings.exchangeAddress,
      contractVersion: this.EVMConfig.onChainSettings.domain.version
    } as ZZMarketInfo
  }

  getActiveMarkets = async () => {
    const marketsString = await this.redis.GET('activemarkets')
    if (!marketsString) throw new Error('No active markets')
    return JSON.parse(marketsString)
  }

  getActiveTokens = async () => {
    const activeMarkets = await this.getActiveMarkets()
      .catch((e: any) =>  { throw new Error('No active tokens') })
    
    return activeMarkets.map((market: string) => market.split('-')).join(',')
  }

  /**
   * takes a new ZZOrder and inserts it in the DB
   * @param {ZZOrder} zktx 
   * @returns {number} order id
   */
  processOrderEVM = async (zktx: ZZOrder): Promise<number> => {
    const inputValidation = EVMOrderSchema.validate(zktx)
    if (inputValidation.error) throw inputValidation.error

    // amount validations
    if (Number(zktx.sellAmount) <= 0)
      throw new Error('sellAmount must be positive')
    if (Number(zktx.buyAmount) <= 0)
      throw new Error('buyAmount must be positive')

    const { onChainSettings } = this.EVMConfig
    if (!onChainSettings) throw new Error('Missing settings file')

    /* validate order */
    if (!ethers.utils.isAddress(zktx.user)) throw new Error('Bad userAddress')

    if (zktx.sellToken.toLowerCase() === zktx.buyToken.toLowerCase())
      throw new Error(`Can't buy and sell the same token`)

    if (Number(zktx.expirationTimeSeconds) < Date.now() / 1000 + 5000)
      throw new Error('Expiry time too low. Use at least NOW + 5sec')

    const buyTokenInfo = this.getTokenInfo(zktx.buyToken)
    const sellTokenInfo = this.getTokenInfo(zktx.sellToken)

    /* validateSignature */
    const { signature } = zktx
    if (!signature) throw new Error('Missing order signature')
    delete zktx.signature

    await verifyMessage({
      provider: this.ETHERS_PROVIDER as ethers.providers.Provider,
      signer: zktx.user,
      typedData: {
        domain: onChainSettings.domain,
        types: onChainSettings.types,
        message: zktx
      },
      signature,
    })

    const buyAmountFormated = Number(ethers.utils.formatUnits(zktx.buyAmount, buyTokenInfo.decimals))
    const sellAmountFormated = Number(ethers.utils.formatUnits(zktx.sellAmount, sellTokenInfo.decimals))
    const price = buyAmountFormated / sellAmountFormated

    let orderId: number
    const values: any[] = [
      zktx.user,
      zktx.buyToken,
      zktx.sellToken,
      buyAmountFormated,
      sellAmountFormated,
      zktx.buyAmount,
      zktx.sellAmount,
      price,
      zktx.expirationTimeSeconds,
      modifyOldSignature(signature),
      getNewAccessToken()
    ]
    try {
      const orders = await this.db.query(
        "INSERT INTO orders (user,buy_token,sell_token,buy_amount,sell_amount,buy_amount_parsed,sell_amount_parsed,price,expires,unfilled,sig,token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11) RETURNING id",
        values
      )
      orderId = orders.rows[0].id
    } catch (err: any) {
      console.error(`Failed to insert order: ${err.message}`)
      throw new Error('Failed to place order')
    }

    return orderId
  }

  cancelOrderSignature = async (
    user: string,
    orderId: number,
    signature: string
  ): Promise<boolean> => {
    await verifyMessage({
      provider: this.ETHERS_PROVIDER as ethers.providers.Provider,
      signer: user,
      message: `cancelorder2:${this.EVMConfig.serverSettings.chainId}:${orderId}`,
      signature
    })

    const updatevalues = [orderId, user]
    const update = await this.db.query(
      "DELETE FROM orders WHERE id=$1 AND user=$2 RETURNING id",
      updatevalues
    )
    if (update.rows.length > 0) throw new Error('Order not found')
    return true
  }

  cancelOrderToken = async (
    orderId: number,
    token: string
  ): Promise<boolean> => {
    const updatevalues = [orderId, token]
    const update = await this.db.query(
      "DELETE FROM orders WHERE id=$1 AND token=$2 RETURNING id",
      updatevalues
    )
    if (update.rows.length > 0) throw new Error('Order not found')
    return true
  }

  getOrder = async (orderId: number | number[]): Promise<ZZOrder[]> => {
    orderId = typeof orderId === 'string' ? [orderId] : orderId
    const query = {
      text: 'SELECT id,user,buy_token,sell_token,buy_amount,sell_amount,price,expires,unfilled FROM orders WHERE id=$1 LIMIT 25',
      values: [orderId],
      rowMode: 'array',
    }

    const select = await this.db.query(query)
    if (select.rows.length === 0) throw new Error('Order not found')
    return parseSQLResultToZZOrder(select.rows, false)
  }

  getUserOrders = async (user: string): Promise<ZZOrder[]> => {
    const query = {
      text: "SELECT id,user,buy_token,sell_token,buy_amount,sell_amount,price,expires,unfilled FROM orders WHERE user=$1 AND unfilled < sell_amount ORDER BY id DESC LIMIT 25",
      values: [user],
      rowMode: 'array',
    }

    const select = await this.db.query(query)
    return parseSQLResultToZZOrder(select.rows, false)
  }

  /**
   * Returns the orderBook for a given buy/sell combination.
   * @param {string} buyToken
   * @param {string} sellToken
   * @param {boolean} signature true returns signatures as well
   */
  getOrderBook = async (buyToken: string, sellToken: string, signature: boolean = false): Promise<ZZOrder[]> => {
    const query = {
      text: "SELECT id,user,buy_token,sell_token,buy_amount,sell_amount,buy_token_parsed,sell_amount_parsed,price,expires,unfilled,sig FROM orders WHERE buy_token=$1 AND sell_token=$2 AND unfilled < sell_amount",
      values: [buyToken, sellToken],
      rowMode: 'array',
    }

    const select = await this.db.query(query)
    return parseSQLResultToZZOrder(select.rows, signature)
  }

  genQuote = async (
    buyToken: string,
    sellToken: string,
    buyAmount: number | null,
    sellAmount: number | null,
    signature: boolean
  ): Promise<ZZOrder[]> => {
    let query: string
    let values: [string, string, number]
    if (buyAmount && !sellAmount) {
      query = 'SELECT * FROM get_buy_quote($1, $2, $3)'
      values = [buyToken, sellToken, buyAmount]
    } else if (!buyAmount && sellAmount) {
      query = 'SELECT * FROM get_sell_quote($1, $2, $3)'
      values = [buyToken, sellToken, sellAmount]
    } else {
      throw new Error('Only one of buyAmount or sellAmount should be set')
    }

    const quote = await this.db.query(query, values)
    return parseSQLResultToZZOrder(quote.rows, signature)
  }
}
