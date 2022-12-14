import { db, runDbMigration, removeExpiredOrders } from './db'

async function start() {
  console.log('background.ts: Starting')
  await runDbMigration()
  setInterval(removeExpiredOrders, 2 * 1000)
}

start()
