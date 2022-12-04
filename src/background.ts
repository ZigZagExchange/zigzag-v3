import { removeExpiredOrders, runDbMigration } from './db'
import { updateActiveMarkets } from './redisClient'

async function start() {
  console.log('background.ts: Run startup')
  await runDbMigration()

  console.log('background.ts: Run initial update')
  await removeExpiredOrders()
  await updateActiveMarkets()

  console.log('background.ts: Starting update functions')
  setInterval(removeExpiredOrders, 2 * 1000)
  setInterval(updateActiveMarkets, 60 * 1000)

}

start()