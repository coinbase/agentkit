import { X402ReceiptsActionProvider } from "./x402receiptsActionProvider";
import { Network } from "../../network";

describe("X402ReceiptsActionProvider", () => {
  const provider = new X402ReceiptsActionProvider();

  it("supports Base and Solana", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as Network)).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" } as Network)).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" } as Network)).toBe(false);
  });

  it("describes the service without paying", async () => {
    global.fetch = jest.fn().mockResolvedValue({ headers: { get: () => Buffer.from(JSON.stringify({ accepts: [{ network: "eip155:8453", amount: "2000" }] })).toString("base64") } }) as never;
    const out = JSON.parse(await provider.getInfo());
    expect(out.pricePerReceiptUsd).toBe(0.002);
    expect(out.accepts[0].network).toBe("eip155:8453");
  });
});
