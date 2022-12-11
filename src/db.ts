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

export async function runDbMigration () {
  console.log('running db migration')
  const migration = fs.readFileSync('schema.sql', 'utf8')
  try {
    await db.query(migration)
    console.log('finished db migration')
  } catch (err) {
    console.error(`Failed to run db migration: ${err}`)
  }
}
