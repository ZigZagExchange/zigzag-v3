import { db, runDbMigration } from './db'

async function start() {
  console.log('background.ts: Starting')
  await runDbMigration()
  setInterval(removeExpiredOrders, 2 * 1000)
}

async function removeExpiredOrders() {
  await db.query(
    "DELETE FROM orders WHERE expires < EXTRACT(EPOCH FROM (NOW() + INTERVAL '3 SECONDS'))"
  )
}

start()
