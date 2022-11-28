import type {
  ZZHttpServer,
  zzErrorMessage
} from '../types'

export default function vaultRouts(app: ZZHttpServer) {
  /* helper functions */
  const sendErrorMsg = (res: any, msg: string) => {
    const errorMsg: zzErrorMessage = {
      op: 'error',
      args: msg
    }
    res.status(400).json(errorMsg)
  }

  const doesNotExist = (res: any, value: any, name: string) => {
    if (!value) {
      sendErrorMsg(res, `Missing ${name}`)
      return true
    }
    return false
  }

  /* endpoints */
  app.post('/vault/addsigner', async (req, res) => {
    const { ownerAddress, signerAddress, signature }: { [key: string]: any } = req.query
    if (doesNotExist(res, ownerAddress, 'ownerAddress')) return
    if (doesNotExist(res, signerAddress, 'signerAddress')) return
    if (doesNotExist(res, signature, 'signature')) return

    try {
      await app.api.addVaultSigner(ownerAddress, signerAddress, signature)
      res.status(200)
    } catch (e: any) {
      sendErrorMsg(res, e.message)
    }
  })

  app.patch('/vault/addsigner', async (req, res) => {
    const { ownerAddress, signerAddress, signature }: { [key: string]: any } = req.query
    if (doesNotExist(res, ownerAddress, 'ownerAddress')) return
    if (doesNotExist(res, signerAddress, 'signerAddress')) return
    if (doesNotExist(res, signature, 'signature')) return

    try {
      await app.api.addVaultSigner(ownerAddress, signerAddress, signature)
      res.status(200)
    } catch (e: any) {
      sendErrorMsg(res, e.message)
    }
  })
}
