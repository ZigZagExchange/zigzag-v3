import { redis } from './redisClient'
import db from './db'
import type { AnyObject } from './types'

async function removeExpiredOrders () {
  try {
    const expiredTimestamp = ((Date.now() / 1000) | 0) + 3
    await db.query(
      'DELETE FROM orders WHERE expires < $1;',
      [expiredTimestamp]
    )
  } catch (e: any) {
    console.error(`Failed to removeExpiredOrders: ${e.message}`)
  }
}

async function updateActiveMarkets () {
  try {
    const marketsResult = await db.query(
      'SELECT DESTINCT(buy_token, sell_token) FROM orders;'
    )
    const activeMarkets = marketsResult.rows.map((result: AnyObject) => {
      return `${result.buy_token}-${result.sell_token}`
    })
    redis.SET('activemarkets', JSON.stringify(activeMarkets))
  } catch (e: any) {
    console.error(`Failed to updateActiveMarkets: ${e.message}`)
  }
}

async function start() {
  console.log('background.ts: Run startup')
  await redis.connect()


  console.log('background.ts: Run initial update')
  await removeExpiredOrders()
  await updateActiveMarkets()

  console.log('background.ts: Starting update functions')
  setInterval(removeExpiredOrders, 2 * 1000)
  setInterval(updateActiveMarkets, 60 * 1000)

}

start()