import type {
  ZZHttpServer,
} from '../types'
import { db } from '../db';

export default function marketRoutes(app: ZZHttpServer) {

  app.get('/v1/markets', async (req, res) => {
    const selectDistinctMarkets = await db.query("SELECT DISTINCT(buyToken, sellToken) FROM orders");
    const selectTokens = await db.query("SELECT * FROM tokeninfo");

    // Mark verified markets
    const verifiedTokenAddresses = selectTokens.rows.map(r => r.token_address);
    const markets = selectDistinctMarkets.rows.map(row => ({
      ...row,
      verified: (verifiedTokenAddresses.includes(row.buyToken) && verifiedTokenAddresses.includes(row.sellToken)),
    }));

    const result = {
      markets,
      verifiedTokens: selectTokens.rows,
    }
  })

}
