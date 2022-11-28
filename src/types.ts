// SPDX-License-Identifier: BUSL-1.1
import type { Application } from 'express'
import type API from './api'

export type AnyObject = { [key: string | number]: any }

export type ZZAPITransport = { api: API }

export type ZZHttpServer = Application & ZZAPITransport

export type zzErrorMessage = {
  op: 'error'
  args: string
}

export type ZZMessage = {
  op: string
  args: any[]
}

export type ZZTokenInfo = {
  address: string,
  symbol: string,
  decimals: number,
  name: string
}

export type ZZMarketInfo = {
  buyToken: ZZTokenInfo,
  sellToken: ZZTokenInfo,
  exchangeAddress: string,
  contractVersion: string
}

export type ZZOrder = {
  user: string
  sellToken: string
  buyToken: string
  sellAmount: number
  buyAmount: number
  expirationTimeSeconds: string
  signature?: string
  orderId?: number,
  unfilled?: number
  sellAmountParsed?: string
  buyAmountParsed?: string
}
