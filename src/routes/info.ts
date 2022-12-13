import fs from 'fs'
import type { ZZHttpServer, ZZMarketInfo, ZZTokenInfo } from '../types'
import { db } from '../db'

const EVMConfig = JSON.parse(fs.readFileSync('EVMConfig.json', 'utf8'))

export default function infoRoutes(app: ZZHttpServer) {
  app.get('/v1/info', async (req, res) => {
    const selectDistinctMarkets = await db.query(
      'SELECT DISTINCT(buy_token, sell_token), buy_token, sell_token FROM orders'
    )
    const selectTokens = await db.query('SELECT * FROM token_info')

    // Mark verified markets
    const verifiedTokenAddresses = selectTokens.rows.map((r) =>
      r.token_address.toLowerCase()
    )
    const markets: ZZMarketInfo[] = selectDistinctMarkets.rows.map((row) => ({
      buyToken: row.buy_token,
      sellToken: row.sell_token,
      verified:
        verifiedTokenAddresses.includes(row.buy_token) &&
        verifiedTokenAddresses.includes(row.sell_token),
    }))

    const tokenInfo: ZZTokenInfo[] = selectTokens.rows.map((row) => ({
      address: row.token_address,
      symbol: row.token_symbol,
      decimals: row.token_decimals,
      name: row.token_name,
    }))

    const result = {
      markets,
      verifiedTokens: tokenInfo,
      exchange: EVMConfig.onChainSettings
    }

    res.status(200).json(result)
  })
}
