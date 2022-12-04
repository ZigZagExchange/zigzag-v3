// SPDX-License-Identifier: BUSL-1.1
import pg from 'pg'
import fs from 'fs'
import ethers from 'ethers'

import type { AnyObject, ZZOrder, ZZMarketInfo, ZZTokenInfo } from './types'

import { EVMOrderSchema } from './schemas'
import { verifyTokenInformation } from './ethersProvider'
import { modifyOldSignature, verifyMessage } from './cryptography'

const { Pool } = pg

const EVMConfig = JSON.parse(fs.readFileSync('EVMConfig.json', 'utf8'))
const TOKEN_INFO: AnyObject = {}

pg.types.setTypeParser(20, parseInt)
pg.types.setTypeParser(23, parseInt)
pg.types.setTypeParser(1700, parseFloat)

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
})

// cache tokenInfos from all currnetly known tokens
db.query("SELECT * FROM token_info;").then((tokenInfos: AnyObject) => {
  for (let i = 0; tokenInfos.rows.length; i++) {
    const tokenInfo = tokenInfos.rows[i]
    TOKEN_INFO[tokenInfo.token_address] = {
      address: tokenInfo.token_address,
      symbol: tokenInfo.token_symbol,
      decimals: tokenInfo.token_decimals,
      name: tokenInfo.token_name
    }
  }
})

export async function runDbMigration() {
  console.log('running db migration')
  const migration = fs.readFileSync('schema.sql', 'utf8')
  await db.query(migration).catch((err: string) => {
    console.error(`Failed to run db migration: ${err}`)
  })
  console.log('finished db migration')
}

export async function setTokenInfo(address: string, symbol: string, decimals: number, name: string, key: string): Promise<boolean> {
  const adminKey: string = process.env.addNewTokenKey || 'testAdminKey'
  if (key !== adminKey) throw new Error('Unauthorized')

  const dbCheckAddress = await db.query("SELECT * FROM token_info WHERE token_address=$1;", [address])
  if (dbCheckAddress.rows.length > 0) throw new Error('Token address is already used')

  const dbCheckSymbol = await db.query("SELECT * FROM token_info WHERE token_symbol=$1;", [symbol])
  if (dbCheckSymbol.rows.length > 0) throw new Error('Token symbol is already used')

  const dbCheckName = await db.query("SELECT * FROM token_info WHERE token_name=$1;", [name])
  if (dbCheckName.rows.length > 0) throw new Error('Token name is already used')

  const success = await verifyTokenInformation(address, name, decimals, symbol)
  if (!success) throw new Error("Can not verify information on chain")  

  const insertResult = await db.query(
    "INSERT INTO token_info (token_address, token_symbol, token_name, token_decimals) VALUES ($1, $2, $3, $4);",
    [address, symbol, name, decimals]
  )

  return (insertResult.rows.length > 0)
}


/**
 * takes a new ZZOrder and inserts it in the DB
 * @param {ZZOrder} zktx 
 * @returns {number} order id
 */
export async function processOrderEVM(zktx: ZZOrder): Promise<number> {
  const inputValidation = EVMOrderSchema.validate(zktx)
  if (inputValidation.error) throw inputValidation.error

  // amount validations
  if (Number(zktx.sellAmount) <= 0)
    throw new Error('sellAmount must be positive')
  if (Number(zktx.buyAmount) <= 0)
    throw new Error('buyAmount must be positive')

  const { onChainSettings } = EVMConfig
  if (!onChainSettings) throw new Error('Missing settings file')

  /* validate order */
  if (!ethers.utils.isAddress(zktx.user)) throw new Error('Bad userAddress')

  if (zktx.sellToken.toLowerCase() === zktx.buyToken.toLowerCase())
    throw new Error(`Can't buy and sell the same token`)

  if (Number(zktx.expirationTimeSeconds) < Date.now() / 1000 + 5000)
    throw new Error('Expiry time too low. Use at least NOW + 5sec')

  const buyTokenInfo = getTokenInfo(zktx.buyToken)
  const sellTokenInfo = getTokenInfo(zktx.sellToken)

  /* validateSignature */
  const { signature } = zktx
  if (!signature) throw new Error('Missing order signature')
  delete zktx.signature

  await verifyMessage({
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
    modifyOldSignature(signature)
  ]
  try {
    const orders = await db.query(
      "INSERT INTO orders (user_address,buy_token,sell_token,buy_amount,sell_amount,buy_amount_parsed,sell_amount_parsed,price,expires,unfilled,sig,token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11) RETURNING id",
      values
    )
    orderId = orders.rows[0].id
  } catch (err: any) {
    console.error(`Failed to insert order: ${err.message}`)
    throw new Error('Failed to place order')
  }

  return orderId
}

/**
 * get tokenInfo for a given tokenSymbol
 * @param tokenSymbol symbol of that token
 * @returns tokenInfo as zzTokenInfo
 */
export function getTokenInfo(tokenSymbol: string): ZZTokenInfo {
  const tokenInfo: ZZTokenInfo = TOKEN_INFO[tokenSymbol]
  if (!tokenInfo) throw new Error(`bad token ${tokenSymbol}`)
  return tokenInfo
}

export function getMarketInfo(buyToken: string, sellToken: string): ZZMarketInfo {
  const buyTokenInfo = getTokenInfo(buyToken)
  const sellTokenInfo = getTokenInfo(sellToken)

  return {
    buyToken: buyTokenInfo,
    sellToken: sellTokenInfo,
    exchangeAddress: EVMConfig.onChainSettings.exchangeAddress,
    contractVersion: EVMConfig.onChainSettings.domain.version
  } as ZZMarketInfo
}

export async function getOrder(orderId: number | number[]): Promise<ZZOrder[]> {
  orderId = typeof orderId === 'string' ? [orderId] : orderId
  const query = {
    text: 'SELECT id,user_address,buy_token,sell_token,buy_amount,sell_amount,price,expires,unfilled FROM orders WHERE id=$1 LIMIT 25',
    values: [orderId],
    rowMode: 'array',
  }

  const select = await db.query(query)
  if (select.rows.length === 0) throw new Error('Order not found')
  return parseSQLResultToZZOrder(select.rows, false)
}

export async function getUserOrders(user: string): Promise<ZZOrder[]> {
  const query = {
    text: "SELECT id,user_address,buy_token,sell_token,buy_amount,sell_amount,price,expires,unfilled FROM orders WHERE user_address=$1 AND unfilled < sell_amount ORDER BY id DESC LIMIT 25",
    values: [user],
    rowMode: 'array',
  }

  const select = await db.query(query)
  return parseSQLResultToZZOrder(select.rows, false)
}

/**
 * Returns the orderBook for a given buy/sell combination.
 * @param {string} buyToken
 * @param {string} sellToken
 * @param {boolean} signature true returns signatures as well
 */
export async function getOrderBook(buyToken: string, sellToken: string, signature: boolean = false): Promise<ZZOrder[]> {
  const query = {
    text: "SELECT id,user_address,buy_token,sell_token,buy_amount,sell_amount,buy_token_parsed,sell_amount_parsed,price,expires,unfilled,sig FROM orders WHERE buy_token=$1 AND sell_token=$2 AND unfilled < sell_amount",
    values: [buyToken, sellToken],
    rowMode: 'array',
  }

  const select = await db.query(query)
  return parseSQLResultToZZOrder(select.rows, signature)
}

export async function genQuote(
  buyToken: string,
  sellToken: string,
  buyAmount: number | null,
  sellAmount: number | null,
  signature: boolean
): Promise<ZZOrder[]> {
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

  const quote = await db.query(query, values)
  return parseSQLResultToZZOrder(quote.rows, signature)
}

/**
 * Returns a parsed ZZOrder list
 * @param {AnyObject[]} sql sql result
 * @param {boolean} signature true returns signatures as well
 */
export function parseSQLResultToZZOrder(sql: AnyObject[], signature: boolean): ZZOrder[] {
  const zzOrderList: ZZOrder[] = []

  for (let i = 0; i < sql.length; i++) {
    const row = sql[i]

    const nextOrder: ZZOrder = {
      user: row.user_address,
      sellToken: row.sell_token,
      buyToken: row.buy_token,
      sellAmount: row.sell_amount,
      buyAmount: row.buy_amount,
      expirationTimeSeconds: row.expirationTimeSeconds,
    }

    // check if those are included in the SQL result
    if (row.buy_token_parsed) nextOrder.buyAmountParsed = row.buy_token_parsed
    if (row.sell_amount_parsed) nextOrder.sellAmountParsed = row.sell_amount_parsed
    if (row.id) nextOrder.orderId = row.id
    if (row.unfilled) nextOrder.unfilled = row.unfilled

    // only add signature if requested
    if (signature) nextOrder.signature = row.sig

    zzOrderList.push(nextOrder)
  }

  return zzOrderList
}

export async function removeExpiredOrders() {
  try {
    const expiredTimestamp = ((Date.now() / 1000) | 0) + 3
    await db.query(
      'DELETE FROM orders WHERE expires < $1;',
      [expiredTimestamp]
    )
  } catch (e: any) {
    console.error(`Failed to removeExpiredOrders: ${e.message}`)
  }
}

export async function getActiveMarketsFromDb() {
  const marketsResult = await db.query(
    'SELECT buy_token, sell_token FROM orders GROUP BY buy_token, sell_token;'
  )

  return marketsResult
}
