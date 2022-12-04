#!/usr/bin/env node
// SPDX-License-Identifier: BUSL-1.1
import { createHttpServer } from './httpServer'
import throng from 'throng'

const httpServer = createHttpServer()

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
