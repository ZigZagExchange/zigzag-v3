#!/usr/bin/env node
// SPDX-License-Identifier: BUSL-1.1
import throng from 'throng'
import express from 'express'
import { createServer } from 'http'
import marketRoutes from './routes/markets'
import orderRoutes from './routes/order'
import dotenv from 'dotenv'

dotenv.config()

const expressApp = express() 
const server = createServer(expressApp)

expressApp.use(express.json())

// CORS
expressApp.use('/', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST')
  next()
})

// Register routes
marketRoutes(expressApp)
orderRoutes(expressApp)

function start() {
  const port = Number(process.env.PORT) || 3004
  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}.`)
  })
}

const WORKERS = process.env.WEB_CONCURRENCY ? Number(process.env.WEB_CONCURRENCY) : 1
throng({
  worker: start,
  count: WORKERS,
  lifetime: Infinity,
})
