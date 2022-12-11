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
  buyToken: string,
  sellToken: string,
  verified: boolean
}

export type ZZOrder = {
  user: string
  sellToken: string
  buyToken: string
  sellAmount: number
  buyAmount: number
  expirationTimeSeconds: string
}
