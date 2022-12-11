import type {
  ZZHttpServer,
  zzErrorMessage,
  ZZMessage,
  ZZOrder
} from '../types'
import { db } from '../db';
import ethers from 'ethers';

import { modifyOldSignature, addrMatching } from '../cryptography';
import { doesNotExist, sendErrorMsg } from './helpers';

export default function orderRoutes(app: ZZHttpServer) {

  app.post('/v1/order', async (req, res) => {
    const zzOrder: ZZOrder = req.body.order;
    let signature: string = req.body.signature;
    const signer: string = req.body.signer || req.body.order.user;

    // schema validation
    const inputValidation = EVMOrderSchema.validate(zzOrder)
    if (inputValidation.error) throw inputValidation.error

    // field validations
    if (Number(zzOrder.sellAmount) <= 0) throw new Error('sellAmount must be positive')
    if (Number(zzOrder.buyAmount) <= 0) throw new Error('buyAmount must be positive')
    if (zzOrder.sellToken.toLowerCase() === zzOrder.buyToken.toLowerCase()) throw new Error(`Can't buy and sell the same token`)
    if (Number(zzOrder.expirationTimeSeconds) < Date.now() / 1000 + 5000) throw new Error('Expiry time too low. Use at least NOW + 5sec')
    if (!ethers.utlis.isAddress(zzOrder.user)) throw new Error("order.user is invalid address");
    if (!ethers.utlis.isAddress(zzOrder.buyToken)) throw new Error("order.buyToken is invalid address");
    if (!ethers.utlis.isAddress(zzOrder.sellToken)) throw new Error("order.sellToken is invalid address");
    if (!ethers.utlis.isAddress(signer)) throw new Error("signer is invalid address");

    // signature validation
    const modifiedSignature = modifyOldSignature(signature);
    const orderHash = ethers.utils._TypedDataEncoder.hash(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, zzOrder);
    const recoveredAddress = ethers.utils.recoverAddress(orderHash, modifiedSignature);
    if (!addrMatching(recoveredAddress, signer)) throw new Error(`Invalid recovered address: ${recoveredAddress}`);

    // store in DB
    const values: any[] = [ zzOrder.user, zzOrder.buyToken,
      zzOrder.user,
      zzOrder.buyToken,
      zzOrder.sellToken,
      zzOrder.buyAmount,
      zzOrder.sellAmount,
      zzOrder.expirationTimeSeconds,
      modifiedSignature
    ]
    await db.query(
      "INSERT INTO orders (user_address,buy_token,sell_token,buy_amount,sell_amount,expires,sig) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      values
    )

    res.status(200).json({ "id": orderHash })
  })




  app.get('/v1/orders', async (req, res) => {
  });
}
