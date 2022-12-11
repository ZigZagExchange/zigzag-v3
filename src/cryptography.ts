import { ethers } from 'ethers'

export function modifyOldSignature(signature: string): string {
  if (signature.slice(-2) === '00') return signature.slice(0, -2).concat('1B')
  if (signature.slice(-2) === '01') return signature.slice(0, -2).concat('1C')
  return signature
}

// Comparing addresses. targetAddr is already checked upstream
export function addrMatching(recoveredAddr: string, targetAddr: string) {
  if (recoveredAddr === '') return false
  if (!ethers.utils.isAddress(recoveredAddr)) return false;
  return recoveredAddr.toLowerCase() === targetAddr.toLowerCase()
}
