import type {
  ZZHttpServer,
  zzErrorMessage
} from '../types'
import { addVaultSigner } from '../redisClient'
import { doesNotExist, sendErrorMsg } from './helpers';

export default function vaultRouts(app: ZZHttpServer) {

  app.post('/vault/addsigner', async (req, res) => {
    const { ownerAddress, signerAddress, signature }: { [key: string]: any } = req.query
    if (doesNotExist(res, ownerAddress, 'ownerAddress')) return
    if (doesNotExist(res, signerAddress, 'signerAddress')) return
    if (doesNotExist(res, signature, 'signature')) return

    try {
      await addVaultSigner(ownerAddress, signerAddress, signature)
      res.status(200)
    } catch (e: any) {
      sendErrorMsg(res, e.message)
    }
  })

}
