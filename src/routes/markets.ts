import type {
  ZZHttpServer,
  zzErrorMessage,
  ZZMessage
} from '../types'

import { getMarketInfo } from '../db'
import { getActiveMarkets } from '../redisClient'
import { doesNotExist, sendErrorMsg } from './helpers';

export default function marketRouts(app: ZZHttpServer) {

  app.get('/v1/markets', async (req, res) => {

    try {
      const markets = await getActiveMarkets()
      const msg: ZZMessage = {
        op: 'markets',
        args: markets
      }
      res.status(200).json(msg)
    } catch (e: any) {
      sendErrorMsg(res, `Failed to fetch markets: ${e.message}`)
    }
  })

}
