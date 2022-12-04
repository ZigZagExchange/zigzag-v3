// SPDX-License-Identifier: BUSL-1.1
import express from 'express'
import { createServer } from 'http'
import type { ZZHttpServer } from './types'
import adminRouts from './routes/admin'
import marketRouts from './routes/markets'
import tokenRouts from './routes/tokens'
import orderRouts from './routes/order'
import vaultRouts from './routes/vault'

export const createHttpServer = (): ZZHttpServer => {
  const expressApp = express() as any as ZZHttpServer
  const server = createServer(expressApp)

  expressApp.use(express.json())

  /* CORS */
  expressApp.use('/', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.header('Access-Control-Allow-Methods', 'GET, POST')
    next()
  })

  adminRouts(expressApp)
  marketRouts(expressApp)
  tokenRouts(expressApp)
  orderRouts(expressApp)
  vaultRouts(expressApp)

  // expressApp.listen = (...args: any) => server.listen(...args)

  return expressApp
}
