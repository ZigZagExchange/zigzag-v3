#!/usr/bin/env node
// SPDX-License-Identifier: BUSL-1.1
import { createHttpServer } from './httpServer'
import { redis } from './redisClient'
import db from './db'
import API from './api'
import type { RedisClientType } from 'redis'
import throng from 'throng'

const httpServer = createHttpServer()

function start() {
  const port = Number(process.env.PORT) || 3004
  const api = new API(
    db,
    httpServer,
    redis as RedisClientType
  )

  api.start(port).then(() => {
    console.log('Successfully started server.')
  })
}

const WORKERS = process.env.WEB_CONCURRENCY ? Number(process.env.WEB_CONCURRENCY) : 1
throng({
  worker: start,
  count: WORKERS,
  lifetime: Infinity,
})
