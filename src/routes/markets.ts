import type {
  ZZHttpServer,
} from '../types'
import { db } from '../db';

export default function marketRoutes(app: ZZHttpServer) {

  app.get('/v1/markets', async (req, res) => {
    const selectDistinctMarkets = await db.query("SELECT DISTINCT(buy_token, sell_token), buy_token, sell_token FROM orders");
    const selectTokens = await db.query("SELECT * FROM token_info");

    // Mark verified markets
    const verifiedTokenAddresses = selectTokens.rows.map(r => r.token_address.toLowerCase());
    const markets = selectDistinctMarkets.rows.map(row => ({
      buyToken: row.buy_token,
      sellToken: row.sell_token,
      verified: (verifiedTokenAddresses.includes(row.buy_token) && verifiedTokenAddresses.includes(row.sell_token)),
    }));

    const result = {
      markets,
      verifiedTokens: selectTokens.rows,
    }

    res.status(200).json(result)
  })

}
