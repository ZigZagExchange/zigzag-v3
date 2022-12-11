// SPDX-License-Identifier: BUSL-1.1
import pg from 'pg'
import fs from 'fs'

const { Pool } = pg

pg.types.setTypeParser(20, parseInt)
pg.types.setTypeParser(23, parseInt)
pg.types.setTypeParser(1700, parseFloat)

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
})

console.log('running db migration')
const migration = fs.readFileSync('schema.sql', 'utf8')
await db.query(migration).catch((err: string) => {
  console.error(`Failed to run db migration: ${err}`)
})
console.log('finished db migration')
