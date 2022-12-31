import { ethers } from 'ethers'
import fs from 'fs'
import type { ZZHttpServer, ZZOrder } from '../types'
import { db } from '../db'
import { modifyOldSignature, addrMatching } from '../cryptography'
import { EVMOrderSchema } from '../schemas'

const EVMConfig = JSON.parse(fs.readFileSync('EVMConfig.json', 'utf8'))

export default function orderRoutes(app: ZZHttpServer) {
  app.post('/v1/order', async (req, res, next) => {
    // order validation
    const zzOrder: ZZOrder = req.body.order
    const inputValidation = EVMOrderSchema.validate(zzOrder)
    if (inputValidation.error) next(inputValidation.error.message)

    // grab signature data
    let signature: string = req.body.signature
    const signer: string = req.body.signer || req.body.order.user

    // parse incomming tokens to lower case
    zzOrder.sellToken = zzOrder.sellToken.toLowerCase()
    zzOrder.buyToken = zzOrder.buyToken.toLowerCase()

    // field validations
    if (!signature) return next('missing signature')
    if (Number(zzOrder.sellAmount) <= 0)
      return next('sellAmount must be positive')
    if (Number(zzOrder.buyAmount) <= 0)
      return next('buyAmount must be positive')
    if (zzOrder.sellToken === zzOrder.buyToken)
      return next(`Can't buy and sell the same token`)
    if (Number(zzOrder.expirationTimeSeconds) < Date.now() / 1000 + 5)
      return next('Expiry time too low. Use at least NOW + 5sec')
    if (!ethers.utils.isAddress(zzOrder.user))
      return next('order.user is invalid address')
    if (!ethers.utils.isAddress(zzOrder.buyToken))
      return next('order.buyToken is invalid address')
    if (!ethers.utils.isAddress(zzOrder.sellToken))
      return next('order.sellToken is invalid address')
    if (!ethers.utils.isAddress(signer))
      return next('signer is invalid address')

    // signature validation
    const modifiedSignature = modifyOldSignature(signature)
    const orderHash = ethers.utils._TypedDataEncoder.hash(
      EVMConfig.onChainSettings.domain,
      EVMConfig.onChainSettings.types,
      zzOrder
    )
    const recoveredAddress = ethers.utils.recoverAddress(
      orderHash,
      modifiedSignature
    )
    if (!addrMatching(recoveredAddress, signer))
      return next('Bad signature. You might need the signer field')

    // store in DB
    const values: any[] = [
      orderHash,
      zzOrder.user,
      zzOrder.buyToken,
      zzOrder.sellToken,
      zzOrder.buyAmount,
      zzOrder.sellAmount,
      zzOrder.expirationTimeSeconds,
      modifiedSignature,
    ]
    try {
      await db.query(
        'INSERT INTO orders (hash,user_address,buy_token,sell_token,buy_amount,sell_amount,expires,sig) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        values
      )
    } catch(e: any) {
      console.error(e);
      return next(e.detail);
    }

    res.status(200).json({ hash: orderHash })
  })

  app.get('/v1/orders', async (req, res, next) => {
    let maxExpires: any = req.query.maxExpires
    let minExpires: any = req.query.minExpires
    const now = (Date.now() / 1000 | 0)
    if (!req.query.buyToken) return next('Missing query arg buyToken')
    if (!req.query.sellToken) return next('Missing query arg sellToken')
    if (!maxExpires) maxExpires = now + 60;
    if (!minExpires) minExpires = now + 3;
    if (Number(maxExpires) > now * 2) return next(`Max value of maxExpires is ${now * 2}`);
    if (Number(maxExpires) < now) return next(`Min value of maxExpires is ${now}`);
    if (Number(minExpires) > now * 2) return next(`Max value of minExpires is ${now * 2}`);
    if (Number(minExpires) < now) return next(`Min value of minExpires is ${now}`);
    maxExpires = Number(maxExpires)
    minExpires = Number(minExpires)

    let buyTokens: string[] = (req.query.buyToken as string).split(',');
    let sellTokens: string[] = (req.query.sellToken as string).split(',');

    const values = [buyTokens, sellTokens, minExpires, maxExpires]
    let select;
    try {
      select = await db.query(
        `SELECT hash, user_address, buy_token, sell_token, CAST(buy_amount AS TEXT) AS buyamount, CAST(sell_amount AS TEXT) AS sellamount, expires, sig 
         FROM orders WHERE buy_token=ANY($1) AND sell_token= ANY($2) AND expires >= $3 AND expires <= $4`,
        values
      )
    } catch (e: any) {
      console.error(e);
      return next(e.detail);
    }

    const orders = select.rows.map((row) => ({
      hash: row.hash,
      order: {
        user: row.user_address,
        buyToken: row.buy_token,
        sellToken: row.sell_token,
        buyAmount: row.buyamount,
        sellAmount: row.sellamount,
        expirationTimeSeconds: row.expires.toString(),
      },
      signature: row.sig,
    }))

    return res.status(200).json({ orders })
  })
}
