// SPDX-License-Identifier: BUSL-1.1
import * as Redis from 'redis'

import type { AnyObject } from './types'

import { verifyMessage } from './cryptography'
import { getActiveMarketsFromDb } from './db'

const redisUrl = process.env.REDIS_URL || 'redis://0.0.0.0:6379'
const redisUseTLS = redisUrl.includes('rediss')

const redis = Redis.createClient({
  url: redisUrl,
  socket: {
    tls: redisUseTLS,
    rejectUnauthorized: false,
  },
}).on('error', (err: Error) => console.log('Redis Client Error', err))

redis.connect()

export async function getActiveMarkets() {
  const marketsString = await redis.GET('activemarkets')
  if (!marketsString) throw new Error('No active markets')
  return JSON.parse(marketsString)
}

export async function getActiveTokens() {
  const activeMarkets = await getActiveMarkets()
    .catch((e: any) => { throw new Error('No active tokens') })

  return activeMarkets.map((market: string) => market.split('-')).join(',')
}

export async function addVaultSigner(
  ownerAddress: string,
  signerAddress: string,
  signature: string
) {
  await verifyMessage({
    signer: signerAddress,
    message: `addvaultsigner:${ownerAddress.toLowerCase()}`,
    signature
  })

  redis.SET(`vaultsigner:${signerAddress.toLowerCase()}`, ownerAddress.toLowerCase())
}

export async function getVaultSigner(address: string): Promise<string | null> {
  return redis.GET(`vaultsigner:${address.toLowerCase()}`);
}

export async function updateActiveMarkets() {
  try {
    const marketsResult = await getActiveMarketsFromDb()
    const activeMarkets = marketsResult.rows.map((result: AnyObject) => {
      return `${result.buy_token}-${result.sell_token}`
    })
    redis.SET('activemarkets', JSON.stringify(activeMarkets))
  } catch (e: any) {
    console.error(`Failed to updateActiveMarkets: ${e.message}`)
  }
}