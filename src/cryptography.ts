import { ethers } from 'ethers'

import type { AnyObject } from './types'

import { onChainEIP1271Check } from './ethersProvider'
import { getVaultSigner } from './redisClient'

export function modifyOldSignature(signature: string): string {
  if (signature.slice(-2) === '00') return signature.slice(0, -2).concat('1B')
  if (signature.slice(-2) === '01') return signature.slice(0, -2).concat('1C')
  return signature
}

// Address recovery wrapper
function recoverAddress(hash: string, signature: string): string {
  try {
    return ethers.utils.recoverAddress(hash, signature)
  } catch {
    return ''
  }
}

// Comparing addresses. targetAddr is already checked upstream
function addrMatching(recoveredAddr: string, targetAddr: string) {
  if (recoveredAddr === '') return false
  if (!ethers.utils.isAddress(recoveredAddr))
    throw new Error(`Invalid recovered address: ${recoveredAddr}`)

  return recoveredAddr.toLowerCase() === targetAddr.toLowerCase()
}

// you only need to pass one of: typedData or message
export async function verifyMessage(param: {
  signer: string
  message?: string
  typedData?: AnyObject
  signature: string
}) {
  const { message, typedData, signer } = param
  const signature = modifyOldSignature(param.signature)
  let finalDigest: string
  
  if (message) {
    finalDigest = ethers.utils.hashMessage(message)
  } else if (typedData) {
    if (!typedData.domain || !typedData.types || !typedData.message) {
      throw Error(
        'Missing one or more properties for typedData (domain, types, message)'
      )
    }

    // eslint-disable-next-line no-underscore-dangle
    finalDigest = ethers.utils._TypedDataEncoder.hash(
      typedData.domain,
      typedData.types,
      typedData.message
    )
  } else {
    throw Error('Missing one of the properties: message or typedData')
  }

  // 1nd try: elliptic curve signature (EOA)
  const recoveredAddress = recoverAddress(finalDigest, signature)
  if (addrMatching(recoveredAddress, signer)) return true

  // 2nd try: Check registered vault address
  // Requires manual whitelist
  const vaultSigner = await getVaultSigner(signer)
  if (vaultSigner && addrMatching(recoveredAddress, vaultSigner)) return true
  console.log(`Expected ${signer}, recovered ${recoveredAddress}`)

  // 3rd try: Check on chain EIP1271 signature
  // disabled for now
  // const isValid = await onChainEIP1271Check(signer, finalDigest, signature)
  // if (isValid) return true

  throw Error('Invalid signature')
}
