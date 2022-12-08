import type {
  ZZHttpServer,
  zzErrorMessage,
  ZZMessage
} from '../types'

import { getTokenInfo } from '../db'
import { getActiveTokens } from '../redisClient'
import { doesNotExist, sendErrorMsg } from './helpers';

export default function tokenRouts(app: ZZHttpServer) {

  app.get('/v1/tokens', async (req, res) => {
    try {
      const activeTokens = await getActiveTokens()
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
      const tokenInfo = getTokenInfo(token)
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
