import type {
  ZZHttpServer,
  zzErrorMessage
} from '../types'

import { setTokenInfo } from '../db'
import { doesNotExist, sendErrorMsg } from './helpers';

export default function adminRouts(app: ZZHttpServer) {

  app.get('/admin/addtoken', async (req, res) => {
    const { address, name, symbol, decimals, key }: { [key: string]: any } = req.query
    if (doesNotExist(res, address, 'address')) return
    if (doesNotExist(res, name, 'name')) return
    if (doesNotExist(res, symbol, 'symbol')) return
    if (doesNotExist(res, decimals, 'decimals')) return
    if (doesNotExist(res, key, 'key')) return

    try {
      const success = await setTokenInfo(address, symbol, Number(decimals), name, key)
      success ? res.status(200) : res.status(400)
    } catch (e: any) {
      sendErrorMsg(res, e.message)
    }
  })
}
