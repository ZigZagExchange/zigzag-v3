// SPDX-License-Identifier: BUSL-1.1
import express from 'express'
import { createServer } from 'http'
import type { ZZHttpServer } from './types'
import marketRoutes from './routes/markets'
import orderRoutes from './routes/order'
import vaultRoutes from './routes/vault'

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

  marketRoutes(expressApp)
  orderRoutes(expressApp)
  vaultRoutes(expressApp)

  // expressApp.listen = (...args: any) => server.listen(...args)

  return expressApp
}
