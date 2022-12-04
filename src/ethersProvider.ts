import fs from 'fs'
import { ethers } from 'ethers'

const EVMConfig = JSON.parse(fs.readFileSync('EVMConfig.json', 'utf8'))
const ERC20_ABI = JSON.parse(fs.readFileSync('abi/ERC20.abi', 'utf8'))
let ETHERS_PROVIDER: any

try {
  try {
    ETHERS_PROVIDER = new ethers.providers.InfuraProvider(
      EVMConfig.serverSettings.chainName,
      process.env.INFURA_PROJECT_ID
    )
    console.log(`Connected InfuraProvider for ${EVMConfig.serverSettings.chainName}`)
  } catch (e: any) {
    console.warn(
      `Could not connect InfuraProvider for ${EVMConfig.serverSettings.chainName}, trying RPC...`
    )
    ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider(
      EVMConfig.serverSettings.RPC
    )
    console.log(`Connected JsonRpcProvider for ${EVMConfig.serverSettings.chainName}`)
  }
} catch (e: any) {
  console.error(e.message)
  throw new Error(`Failed to setup provider for ${EVMConfig.serverSettings.chainName}.`)
}

export async function verifyTokenInformation(
  address: string,
  name: string,
  decimals: number,
  symbol: string
): Promise<boolean> {
  const tokenContract = new ethers.Contract(address, ERC20_ABI, ETHERS_PROVIDER)

  const [onChainName, onChainSymbol, onChainDecimals] = await Promise.all([
    tokenContract.name(),
    tokenContract.sysmbol(),
    tokenContract.decimals()
  ])

  if (name !== onChainName) throw new Error('Token name does not match on chain name')
  if (symbol !== onChainSymbol) throw new Error('Token symbol does not match on chain symbol')
  if (decimals !== onChainDecimals) throw new Error('Token decimals does not match on chain decimals')

  return true
}

export function getEthersProvider(): ethers.providers.BaseProvider {
  return ETHERS_PROVIDER
}

export async function onChainEIP1271Check(
  signer: string,
  hash: string,
  signature: string
) {
  const code = await ETHERS_PROVIDER.getCode(signer)
  if (code && code !== '0x') {
    const contract = new ethers.Contract(
      signer,
      ['function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)'],
      ETHERS_PROVIDER
    )
    return (await contract.isValidSignature(hash, signature)) === '0x1626ba7e'
  }
  return false
}
