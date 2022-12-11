// SPDX-License-Identifier: BUSL-1.1
import type { Application } from 'express'

export type AnyObject = { [key: string | number]: any }

export type ZZHttpServer = Application

export type ZZTokenInfo = {
  address: string,
  symbol: string,
  decimals: number,
  name: string
}

export type ZZMarketInfo = {
  token1: ZZTokenInfo,
  token2: ZZTokenInfo,
}

export type ZZOrder = {
  user: string
  sellToken: string
  buyToken: string
  sellAmount: number
  buyAmount: number
  expirationTimeSeconds: string
}
