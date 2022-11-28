import type {
  ZZHttpServer,
  zzErrorMessage,
  ZZMessage,
  ZZOrder
} from '../types'

export default function orderRouts(app: ZZHttpServer) {
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
  app.get('/v1/order', async (req, res) => {
    const { idList }: { [key: string]: any } = req.query
    if (doesNotExist(res, idList, 'id')) return
    const ids: number[] = idList.split(',').map((id: string) => Number(id))

    try {
      const orders = await app.api.getOrder(ids)
      const msg: ZZMessage = {
        op: 'orders',
        args: orders
      }
      res.status(200).json(msg)
    } catch (e: any) {
      sendErrorMsg(res, `Failed to fetch orders: ${e.message}`)
    }
  })

  app.post('/v1/order', async (req, res) => {
    const zzOrderList: ZZOrder[] = Array.isArray(req.body.order) ? req.body.order : [req.body.order]
    const cancelList: any = Array.isArray(req.body.cancel) ? req.body.cancel : [req.body.cancel]

    try {
      for (let i = 0; i < cancelList.length; i++) {
        const cancelEntry: [string, number, string] = cancelList[i]
        await app.api.cancelOrderSignature(...cancelEntry)
      }
    } catch (e: any) {
      sendErrorMsg(res, `Failed to cancel orders: ${e.message}`)
      return
    }

    const orderResponse: any[] = []
    for (let i = 0; i < zzOrderList.length; i++) {
      try {
        const orderId = await app.api.processOrderEVM(zzOrderList[i])
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

  app.post('/v1/order/cancel', async (req, res) => {
    const cancelList: any = Array.isArray(req.body.cancel) ? req.body.cancel : [req.body.cancel]

    const errorMsg: string[] = []
    for (let i = 0; i < cancelList.length; i++) {
      try {
        const cancelEntry: [string, number, string] = cancelList[i]
        await app.api.cancelOrderSignature(...cancelEntry)
      } catch (e: any) {
        errorMsg.push(`Failed to cancel order ${cancelList?.[i]?.[1]}: ${e.message}`)
      }
    }
    
    if (errorMsg.length > 0) {
      sendErrorMsg(res, errorMsg.join(','))
    } else {
      res.status(200)
    }
  })

  app.post('/v1/order/cancelwithtoken', async (req, res) => {
    const cancelList: any = Array.isArray(req.body.cancel) ? req.body.cancel : [req.body.cancel]

    const errorMsg: string[] = []
    for (let i = 0; i < cancelList.length; i++) {
      try {
        const cancelEntry: [number, string] = cancelList[i]
        await app.api.cancelOrderToken(...cancelEntry)
      } catch (e: any) {
        errorMsg.push(`Failed to cancel order ${cancelList?.[i]?.[0]}: ${e.message}`)
      }
    }

    if (errorMsg.length > 0) {
      sendErrorMsg(res, errorMsg.join(','))
    } else {
      res.status(200)
    }
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
      const quote = await app.api.genQuote(buyToken, sellToken, buyAmount, sellAmount, true)
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
      const orderBook = await app.api.getOrderBook(buyToken, sellToken, true)
      const msg: ZZMessage = {
        op: 'orderbook',
        args: [orderBook]
      }
      if (both) {
        const otherSideOrderBook = await app.api.getOrderBook(sellToken, buyToken, true)
        msg.args.push(otherSideOrderBook)
      }
      res.status(200).json(msg)
    } catch (e: any) {
      sendErrorMsg(res, `Failed to fetch orderbook: ${e.message}`)
    }
  })
}
