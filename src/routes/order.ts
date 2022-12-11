import type {
  ZZHttpServer,
  zzErrorMessage,
  ZZMessage,
  ZZOrder
} from '../types'

import { getOrder, processOrderEVM, genQuote, getOrderBook } from '../db'
import { doesNotExist, sendErrorMsg } from './helpers';

export default function orderRouts(app: ZZHttpServer) {

  app.post('/v1/order', async (req, res) => {
    const zzOrderList: ZZOrder[] = Array.isArray(req.body.order) ? req.body.order : [req.body.order]

    const orderResponse: any[] = []
    for (let i = 0; i < zzOrderList.length; i++) {
      try {
        const orderId = await processOrderEVM(zzOrderList[i])
        orderResponse.push({ orderId })
      } catch (e: any) {
        orderResponse.push({ error: `Failed to place order: ${e.message}` })
      }
    }
    const msg: ZZMessage = {
      op: 'orderack',
      args: orderResponse
    }
    res.status(200).json(msg)
  })

  app.get('/v1/order/quote', async (req, res) => {
    const { buyToken, sellToken, sellAmount, buyAmount }: { [key: string]: any } = req.query
    if (doesNotExist(res, buyToken, 'buyToken')) return
    if (doesNotExist(res, sellToken, 'sellToken')) return
    if ((!sellAmount && !buyAmount) || (sellAmount && buyAmount)) {
      sendErrorMsg(res, 'Either set buyAmount or set sellAmount')
      return
    }

    try {
      const quote = await genQuote(buyToken, sellToken, buyAmount, sellAmount, true)
      const msg: ZZMessage = {
        op: 'quote',
        args: quote
      }
      res.status(200).json(msg)
    } catch (e: any) {
      sendErrorMsg(res, `Failed to generate quote: ${e.message}`)
    }
  })

  app.get('/v1/order/orderbook/:tokens', async (req, res) => {
    const { tokens } = req.params
    const { both }: { [key: string]: any } = req.query
    let buyToken: string | undefined
    let sellToken: string | undefined
    if (tokens.includes('-')) [buyToken, sellToken] = tokens.split('-')
    if (tokens.includes('_')) [buyToken, sellToken] = tokens.split('_')

    if (!buyToken || doesNotExist(res, buyToken, 'buyToken')) return
    if (!sellToken || doesNotExist(res, sellToken, 'sellToken')) return


    try {
      const orderBook = await getOrderBook(buyToken, sellToken, true)
      const msg: ZZMessage = {
        op: 'orderbook',
        args: [orderBook]
      }
      if (both) {
        const otherSideOrderBook = await getOrderBook(sellToken, buyToken, true)
        msg.args.push(otherSideOrderBook)
      }
      res.status(200).json(msg)
    } catch (e: any) {
      sendErrorMsg(res, `Failed to fetch orderbook: ${e.message}`)
    }
  })
}
