import { ethers } from 'ethers';
import fs from 'fs';
import type {
  ZZHttpServer,
  ZZOrder
} from '../types'
import { db } from '../db';
import { modifyOldSignature, addrMatching } from '../cryptography';
import { EVMOrderSchema } from '../schemas';

const EVMConfig = JSON.parse(fs.readFileSync('EVMConfig.json', 'utf8'))


export default function orderRoutes(app: ZZHttpServer) {
  app.post('/v1/order', async (req, res, next) => {
    // order validation
    const zzOrder: ZZOrder = req.body.order;
    const inputValidation = EVMOrderSchema.validate(zzOrder)
    if (inputValidation.error) next(inputValidation.error.message)

    // grab signature data
    let signature: string = req.body.signature;
    const signer: string = req.body.signer || req.body.order.user;

    // field validations
    if (!signature) return next("missing signature");
    if (Number(zzOrder.sellAmount) <= 0) return next('sellAmount must be positive')
    if (Number(zzOrder.buyAmount) <= 0) return next('buyAmount must be positive')
    if (zzOrder.sellToken.toLowerCase() === zzOrder.buyToken.toLowerCase()) return next(`Can't buy and sell the same token`)
    if (Number(zzOrder.expirationTimeSeconds) < (Date.now() / 1000) + 5) return next('Expiry time too low. Use at least NOW + 5sec')
    if (!ethers.utils.isAddress(zzOrder.user)) return next("order.user is invalid address");
    if (!ethers.utils.isAddress(zzOrder.buyToken)) return next("order.buyToken is invalid address");
    if (!ethers.utils.isAddress(zzOrder.sellToken)) return next("order.sellToken is invalid address");
    if (!ethers.utils.isAddress(signer)) return next("signer is invalid address");

    // signature validation
    const modifiedSignature = modifyOldSignature(signature);
    const orderHash = ethers.utils._TypedDataEncoder.hash(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, zzOrder);
    const recoveredAddress = ethers.utils.recoverAddress(orderHash, modifiedSignature);
    if (!addrMatching(recoveredAddress, signer)) return next('Bad signature. You might need the signer field');

    // store in DB
    const values: any[] = [ 
      zzOrder.user,
      zzOrder.buyToken,
      zzOrder.sellToken,
      zzOrder.buyAmount,
      zzOrder.sellAmount,
      zzOrder.expirationTimeSeconds,
      modifiedSignature
    ]
    const insert = await db.query(
      "INSERT INTO orders (user_address,buy_token,sell_token,buy_amount,sell_amount,expires,sig) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      values
    )

    res.status(200).json({ "id": insert.rows[0].id, hash: orderHash })
  });




  app.get('/v1/orders', async (req, res, next) => {
    let { buyToken, sellToken } = req.query;
    let expires: any = req.query.expires;
    if (!buyToken) return next('Missing query arg buyToken');
    if (!sellToken) return next('Missing query arg sellToken');
    if (!expires) expires = (Date.now() / 1000 | 0) + 30;
    expires = Number(expires);

    const values = [buyToken, sellToken, expires];
    const select = await db.query(
      `SELECT id, user_address, buy_token, sell_token, CAST(buy_amount AS TEXT) AS buyamount, CAST(sell_amount AS TEXT) AS sellamount, expires, sig 
       FROM orders WHERE buy_token = $1 AND sell_token = $2 AND expires < $3`,
      values
    )

    const orders = select.rows.map(row => ({
      id: row.id,
      order: {
        user: row.user_address,
        buyToken: row.buy_token,
        sellToken: row.sell_token,
        buyAmount: row.buyamount,
        sellAmount: row.sellamount,
        expirationTimeSeconds: row.expires
      },
      signature: row.sig
    }));

    return res.status(200).json({ orders });
  });

}
