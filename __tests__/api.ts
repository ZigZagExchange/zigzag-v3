import request from "supertest"
import { ethers } from "ethers"
import app from "../src/app"
import { db, runDbMigration } from "../src/db"
import fs from 'fs'

const EVMConfig = JSON.parse(fs.readFileSync('EVMConfig.json', 'utf8'))

const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const USDC = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8";

const wallet = new ethers.Wallet("0xf1c6a46e12f76cb6d8b5b78f5c2a46dd68d05eaee7ff45f5ed20fa2a5db676ce");
const wallet2 = new ethers.Wallet("0xa8f70284bf6be99ec73512e00441528be2d020f1f8c0f11ac46d4045517d9346");

beforeAll(async () => {
  await db.query("DROP TABLE orders");
  await db.query("DROP TABLE token_info");
  await runDbMigration()
  
  const values = [WETH, "WETH", "Wrapped Ether", 18];
  const values2 = [USDC, "USDC", "USD Coin", 6];
  await db.query("INSERT INTO token_info(token_address, token_symbol, token_name, token_decimals) VALUES ($1,$2,$3,$4)", values);
  await db.query("INSERT INTO token_info(token_address, token_symbol, token_name, token_decimals) VALUES ($1,$2,$3,$4)", values2);
});

describe("Sending Orders", () => {

  test("standard order", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: WETH,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) + 20
    }
    const signature = await wallet._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(200);
    await expect(response.body.id).toBeTruthy()
    await expect(response.body.hash).toBeTruthy()
    console.log(response.body);
  });

  test("without a signature", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: WETH,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) + 20
    }
    const body = { order }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err).toBe('missing signature')
  });

  test("with a bad signature", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: WETH,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) + 20
    }
    const signature = await wallet2._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err).toBe('Bad signature. You might need the signer field');
  });

  test("with an early expiry", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: WETH,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) - 20
    }
    const signature = await wallet2._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err.includes("expirationTimeSeconds")).toBe(true)
  });

  test("with a late expiry", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: WETH,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) * 10
    }
    const signature = await wallet2._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err.includes("expirationTimeSeconds")).toBe(true)
  });

  test("with the same tokens", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: USDC,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) + 20
    }
    const signature = await wallet2._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err).toBe("Can't buy and sell the same token")
  });

  test("buy order", async () => {
    const order = {
      user: wallet.address,
      buyToken: WETH, 
      sellToken: USDC,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) + 20
    }
    const signature = await wallet._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(200);
  });

  test("with an alternate signer", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: WETH,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) + 20
    }
    const signature = await wallet2._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature, signer: wallet2.address }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(200);
  });

  test("fails with bad alternate signer", async () => {
    const order = {
      user: wallet.address,
      buyToken: USDC, 
      sellToken: WETH,
      buyAmount: ethers.utils.parseEther("1200").toString(),
      sellAmount: ethers.utils.parseEther("1").toString(),
      expirationTimeSeconds: (Date.now() / 1000 | 0) + 20
    }
    const signature = await wallet2._signTypedData(EVMConfig.onChainSettings.domain, EVMConfig.onChainSettings.types, order);
    const body = { order, signature, signer: wallet.address }
    const response = await request(app)
      .post("/v1/order")
      .set("Content-Type", "application/json")
      .send(body)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err).toBe('Bad signature. You might need the signer field');
  });

});

describe("Getting orders", () => {

  test("sells - successfully", async () => {
    const response = await request(app).get(`/v1/orders?buyToken=${USDC}&sellToken=${WETH}`)
    await expect(response.statusCode).toBe(200);
    await expect(response.body.orders.length > 0).toBe(true)
  });

  test("buys - successfully", async () => {
    const response = await request(app).get(`/v1/orders?buyToken=${USDC}&sellToken=${WETH}`)
    console.log(response.body.orders[0]);
    await expect(response.statusCode).toBe(200);
    await expect(response.body.orders.length > 0).toBe(true)
    await expect(response.body.orders[0].order.user).toBe(wallet.address)
    await expect(response.body.orders[0].order.buyToken).toBe(USDC)
    await expect(response.body.orders[0].order.sellToken).toBe(WETH)
    await expect(response.body.orders[0].order.buyAmount).toBe(ethers.utils.parseEther("1200").toString())
    await expect(response.body.orders[0].order.sellAmount).toBe(ethers.utils.parseEther("1").toString())
    await expect(response.body.orders[0].order.expirationTimeSeconds).toBeGreaterThanOrEqual(Date.now() / 1000 | 0)
    await expect(response.body.orders[0].signature).toBeTruthy()
  });

  test("without any args", async () => {
    const response = await request(app).get("/v1/orders")
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err).toBe("Missing query arg buyToken")
  });

  test("without sellToken", async () => {
    const response = await request(app).get(`/v1/orders?buyToken=${USDC}`)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err).toBe("Missing query arg sellToken")
  });

  test("without buyToken", async () => {
    const response = await request(app).get(`/v1/orders?sellToken=${USDC}`)
    await expect(response.statusCode).toBe(400);
    await expect(response.body.err).toBe("Missing query arg buyToken")
  });

  test("without expires", async () => {
    const expires = (Date.now() / 1000 | 0) + 100000;
    const response = await request(app).get(`/v1/orders?buyToken=${USDC}&sellToken=${WETH}&expires=${expires}`)
    await expect(response.statusCode).toBe(200);
    await expect(response.body.orders.length > 0).toBe(true)
  });

});

describe("Market Info", () => {
  test("get markets", async () => {
    const response = await request(app).get("/v1/markets")
    await expect(response.statusCode).toBe(200);
  });

  test("markets should not repeat", async () => {
    await expect(false).toBe(true);
  });

  test("need a method to decide how to determine base vs quote token", async () => {
    await expect(false).toBe(true);
  });
});

afterAll(async () => {
  await db.end()
});
