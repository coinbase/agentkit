import { AgentForgeActionProvider } from "./agentforgeActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockFetchWithPayment = jest.fn();
const mockRegisterPolicy = jest.fn();
const WALLET = "0x1234567890123456789012345678901234567890";

describe("AgentForgeActionProvider", () => {
  let provider: AgentForgeActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    (x402Client as unknown as jest.Mock).mockImplementation(() => ({
      registerPolicy: mockRegisterPolicy,
    }));
    (registerExactEvmScheme as jest.Mock).mockImplementation(client => client);
    (wrapFetchWithPayment as jest.Mock).mockReturnValue(mockFetchWithPayment);
    mockFetchWithPayment.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ verdict: "proceed" }),
    });
    wallet = {
      getAddress: jest.fn().mockReturnValue(WALLET),
      toSigner: jest.fn().mockReturnValue({ address: WALLET, signTypedData: jest.fn() }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    provider = new AgentForgeActionProvider({ maxPaymentUsdc: 0.05, baseUrl: "https://af.test" });
  });

  it("supports only Base mainnet (payments settle there)", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
      false,
    );
  });

  it("simulates transactions, defaulting from to the agent wallet and capping payments", async () => {
    const result = await provider.simulateTransaction(wallet, {
      chain: "base",
      transactions: [{ to: WALLET, data: "0x", value: "0" }],
    });
    expect(JSON.parse(result)).toEqual({ verdict: "proceed" });
    const [url, init] = mockFetchWithPayment.mock.calls[0];
    expect(url).toBe("https://af.test/v1/tx-simulate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).from).toBe(WALLET);
    const policy = mockRegisterPolicy.mock.calls[0][0];
    const reqs = [{ amount: "5000" }, { amount: "50000" }, { amount: "50001" }];
    expect(policy(2, reqs)).toEqual([{ amount: "5000" }, { amount: "50000" }]);
  });

  it("maps address and token lists to the API shape", async () => {
    await provider.checkAddresses(wallet, { chain: "base", addresses: [WALLET] });
    expect(JSON.parse(mockFetchWithPayment.mock.calls[0][1].body)).toEqual({
      chain: "base",
      addresses: [{ address: WALLET }],
    });
    await provider.scoreTokens(wallet, { chain: "base", tokenAddresses: [WALLET, WALLET] });
    expect(JSON.parse(mockFetchWithPayment.mock.calls[1][1].body).tokens).toHaveLength(2);
  });

  it("sends GET filters as query parameters", async () => {
    await provider.getNewTokenLaunches(wallet, {
      chain: "base",
      minLiquidityUsd: 1000,
      maxRiskScore: 40,
    });
    expect(mockFetchWithPayment.mock.calls[0][0]).toBe(
      "https://af.test/v1/launches?chain=base&minLiquidityUsd=1000&maxRiskScore=40",
    );
    await provider.checkLendingHealth(wallet, { chain: "all" });
    expect(mockFetchWithPayment.mock.calls[1][0]).toBe(
      `https://af.test/v1/lending/health?address=${WALLET}&chain=all`,
    );
  });

  it("returns a JSON error instead of throwing on failures", async () => {
    mockFetchWithPayment.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":"VALIDATION_ERROR"}',
    });
    const bad = JSON.parse(
      await provider.checkTokenBeforeTrade(wallet, { tokenAddress: WALLET, chain: "base" }),
    );
    expect(bad).toMatchObject({ error: true, status: 400 });

    mockFetchWithPayment.mockRejectedValueOnce(new Error("spend cap exceeded"));
    const thrown = JSON.parse(
      await provider.checkTokenBeforeTrade(wallet, { tokenAddress: WALLET, chain: "base" }),
    );
    expect(thrown).toMatchObject({ error: true, details: "spend cap exceeded" });
  });
});
