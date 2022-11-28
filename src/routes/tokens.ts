import type {
  ZZHttpServer,
  zzErrorMessage,
  ZZMessage
} from '../types'

export default function tokenRouts(app: ZZHttpServer) {
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
  app.get('/v1/tokens', async (req, res) => {
    try {
      const activeTokens = await app.api.getActiveTokens()
      const msg: ZZMessage = {
        op: 'tokens',
        args: [activeTokens]
      }
      res.status(200).json(msg)
    } catch (e: any) {
      sendErrorMsg(res, `Failed to fetch markets: ${e.message}`)
    }
  })

  app.get('/v1/tokens/info', async (req, res) => {
    const { token }: { [key: string]: any } = req.query
    if (doesNotExist(res, token, 'token')) return

    try {
      const tokenInfo = app.api.getTokenInfo(token)
      const msg: ZZMessage = {
        op: 'tokeninfo',
        args: [tokenInfo]
      }
      res.status(200).json(msg)
    } catch (e: any) {
      sendErrorMsg(res, `Failed to fetch markets: ${e.message}`)
    }
  })
}
