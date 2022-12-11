# ZigZag API

Base URL: https://api.zigzag.exchange

## Endpoints

* [GET /v1/markets](#market-info)
* [GET /v1/orders](#get-orders)
* [POST /v1/order](#submit-order)

## Market Info

`GET /v1/markets`

```
{
  "markets": [
    {
      "buyToken": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
      "sellToken": "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
      "verified": true
    },
    {
      "buyToken": "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
      "sellToken": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
      "verified": true
    }
  ],
  "verifiedTokens": [
    {
      "address": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
      "symbol": "WETH",
      "decimals": 18,
      "name": "Wrapped Ether"
    },
    {
      "address": "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
      "symbol": "USDC",
      "decimals": 6,
      "name": "USD Coin"
    }
  ],
  "exchange": {
    "exchangeAddress": "0x20e7FCC377CB96805c6Ae8dDE7BB302b344dc42f",
    "makerVolumeFee": 0,
    "takerVolumeFee": 0.0005,
    "domain": {
      "name": "ZigZag",
      "version": "2.1",
      "chainId": "42161",
      "verifyingContract": "0x20e7FCC377CB96805c6Ae8dDE7BB302b344dc42f"
    },
    "types": {
      "Order": [
        { "name": "user", "type": "address" },
        { "name": "sellToken", "type": "address" },
        { "name": "buyToken", "type": "address" },
        { "name": "sellAmount", "type": "uint256" },
        { "name": "buyAmount", "type": "uint256" },
        { "name": "expirationTimeSeconds", "type": "uint256" }
      ]
    }
  }
}
```

## Get Orders

`GET /v1/orders`

**Query paramaters**:

* `buyToken`: Address of token being purchased   
* `sellToken`: Address of token being sold   
* `expires`: (optional) UNIX timestamp of latest expiry you want to see. Defaults to 30 seconds past the current time.    

**Example:**

`GET /v1/orders?buyToken=0x82af49447d8a07e3bd95bd0d56f35241523fbab1&sellToken=0xff970a61a04b1ca14834a43f5de4533ebddb5cc8`

```
{
  "orders": [
    {
      "id": 1,
      "order": {
        "user": "0xc3Be2ecf454A5C74c1218949b4526433a9665fA1",
        "buyToken": "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
        "sellToken": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "buyAmount": "1200000000000000000000",
        "sellAmount": "1000000000000000000",
        "expirationTimeSeconds": 1670795578
      },
      "signature": "0x5de9042545420a24abf6ae7729674fa25288f810c9ce39e66e4295fbfc7f0c06499995b04ed90d83100d951c1d66b1ef451b1c0b7b7f7c18023ddea373b5fb2d1b"
    },
    {
      "id": 3,
      "order": {
        "user": "0xc3Be2ecf454A5C74c1218949b4526433a9665fA1",
        "buyToken": "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
        "sellToken": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "buyAmount": "1200000000000000000000",
        "sellAmount": "1000000000000000000",
        "expirationTimeSeconds": 1670795579
      },
      "signature": "0x882b17fd322e7f9b790dfdb2b2965a942e59464d62152d80152b423d8b6f9aa811a245f34af56fdaded2910867eb3625264dc85690b189dc2dc99d0d418bea4d1c"
    }
  ]
}
```


## Submit Order

`POST /v1/order`

**POST JSON parameters**

* `order.user`: The address of the user sending the order     
* `order.buyToken`: The address of the token being bought     
* `order.sellToken`: The address of the token being sold     
* `order.buyAmount`: The quantity of buyToken being bought as a uint256 string    
* `order.sellAmount`: The quantity of sellToken being sold as a uint256 string    
* `signature`: Orders must be signed. To generate the signature, use the `domain` and `types` info in `GET /v1/markets`, then use something like [ethers.utils.signTypedData](https://docs.ethers.org/v5/api/signer/#Signer-signTypedData) to generate an EIP-712 signature.     
* `signer`: (optional) Most users will not need this. Smart contracts will usually have a designated signer. They can use this field to pass in the address of the authorized signer for signature verification.   

**Example**

```
POST /v1/order
Content-Type: application/json

{
  order: {
    user: '0xc3Be2ecf454A5C74c1218949b4526433a9665fA1',
    buyToken: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    sellToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    buyAmount: '1200000000000000000000',
    sellAmount: '1000000000000000000',
    expirationTimeSeconds: 1670795578
  },
  signature: '0x5de9042545420a24abf6ae7729674fa25288f810c9ce39e66e4295fbfc7f0c06499995b04ed90d83100d951c1d66b1ef451b1c0b7b7f7c18023ddea373b5fb2d1b'
}


200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json

{ id: 1, hash: '0x7bcad1ceab2751cf380fd000facd079682f95b70a93c1bfbf7230a76fd8eacfc' }
```
