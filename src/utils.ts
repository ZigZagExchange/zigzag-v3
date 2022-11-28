import type { AnyObject, ZZOrder } from "./types";

/**
 * Returns a parsed ZZOrder list
 * @param {AnyObject[]} sql sql result
 * @param {boolean} signature true returns signatures as well
 */
export function parseSQLResultToZZOrder(sql: AnyObject[], signature: boolean): ZZOrder[] {
  const zzOrderList: ZZOrder[] = []
  
  for (let i = 0; i < sql.length; i++) {
    const row = sql[i]

    const nextOrder: ZZOrder = {
      user: row.user,
      sellToken: row.sell_token,
      buyToken: row.buy_token,
      sellAmount: row.sell_amount,
      buyAmount: row.buy_amount,
      expirationTimeSeconds: row.expirationTimeSeconds,
    }
    
    // check if those are included in the SQL result
    if (row.buy_token_parsed) nextOrder.buyAmountParsed = row.buy_token_parsed
    if (row.sell_amount_parsed) nextOrder.sellAmountParsed = row.sell_amount_parsed
    if (row.id) nextOrder.orderId = row.id
    if (row.unfilled) nextOrder.unfilled = row.unfilled

    // only add signature if requested
    if (signature) nextOrder.signature = row.sig

    zzOrderList.push(nextOrder)
  }

  return zzOrderList
}