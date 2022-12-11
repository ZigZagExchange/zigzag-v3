import request from "supertest"
import ethers from "ethers"
import app from "../src/app"
import { db } from "../src/db"

describe("GET /", () => {
  test("should 404", async () => {
    const response = await request(app).get("/")
    expect(response.statusCode).toBe(404);
  });
});

describe("Sending Orders", () => {
  test("standard order", async () => {
    const wallet = ethers.Wallet.createRandom();
    const response = await request(app).post("/v1/order").body(order);
    expect(response.statusCode).toBe(400);
    expect(response.body.err).toBe("Missing query arg buyToken")
  });
});

describe("Getting orders", () => {
  beforeEach(
  test("without any args", async () => {
    const response = await request(app).get("/v1/orders")
    expect(response.statusCode).toBe(400);
    expect(response.body.err).toBe("Missing query arg buyToken")
  });

  test("without sellToken", async () => {
    const response = await request(app).get("/v1/orders?buyToken=0x82af49447d8a07e3bd95bd0d56f35241523fbab1")
    expect(response.statusCode).toBe(400);
    expect(response.body.err).toBe("Missing query arg sellToken")
  });

  test("without buyToken", async () => {
    const response = await request(app).get("/v1/orders?buyToken=0x82af49447d8a07e3bd95bd0d56f35241523fbab1")
    expect(response.statusCode).toBe(400);
    expect(response.body.err).toBe("Missing query arg sellToken")
  });

});
