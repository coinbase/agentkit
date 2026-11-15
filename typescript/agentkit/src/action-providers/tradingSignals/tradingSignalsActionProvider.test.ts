import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { EvmWalletProvider, SvmWalletProvider } from "../../wallet-providers";
import { TradingSignalsActionProvider } from "./tradingSignalsActionProvider";
import { TokenPreTradePackSchema, TokenRiskVerdictSchema, TokenWhaleFlowSchema } from "./schemas";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("@x402/svm/exact/client");

type Policy = (version: number, reqs: unknown[]) => unknown[];

const mockFetch = jest.fn();
const mockFetchWithPayment = jest.fn();
let registeredPolicy: Policy | undefined;
const mockClient = {
  registerPolicy: jest.fn((p: Policy) => {
    registeredPolicy = p;
    return mockClient;
  }),
};

jest.mocked(x402Client).mockImplementation(() => mockClient as unknown as x402Client);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);

global.fetch = mockFetch;

const SOL_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const BASE_TOKEN = "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const createMockResponse = (status: number, data: unknown, headers: Record<string, string> = {}) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  }) as unknown as Response;

const makeEvmWallet = (networkId = "base-mainnet") => {
  const w = Object.create(EvmWalletProvider.prototype);
  w.toSigner = jest.fn().mockReturnValue({ address: "0xabc" });
  w.readContract = jest.fn();
  w.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId });
  return w as EvmWalletProvider;
};

const makeSvmWallet = (networkId = "solana-mainnet") => {
  const w = Object.create(SvmWalletProvider.prototype);
  w.toSigner = jest.fn().mockResolvedValue({ address: "SoLSigner" });
  w.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "svm", networkId });
  return w as SvmWalletProvider;
};

const paymentHeader = (network: string, transaction: string) =>
  Buffer.from(JSON.stringify({ success: true, network, transaction })).toString("base64");

describe("TradingSignalsActionProvider", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredPolicy = undefined;
    process.env = { ...OLD_ENV };
    delete process.env.TRADING_SIGNALS_API_KEY;
    delete process.env.TRADING_SIGNALS_MAX_PAYMENT_USDC;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("schemas", () => {
    it("accepts Base and Solana token addresses", () => {
      expect(TokenRiskVerdictSchema.safeParse({ token: SOL_MINT }).success).toBe(true);
      expect(TokenRiskVerdictSchema.safeParse({ token: BASE_TOKEN }).success).toBe(true);
    });

    it("rejects malformed addresses", () => {
      expect(TokenRiskVerdictSchema.safeParse({ token: "0x123" }).success).toBe(false);
      expect(TokenRiskVerdictSchema.safeParse({ token: "not a token!" }).success).toBe(false);
    });

    it("bounds whale flow hours", () => {
      expect(TokenWhaleFlowSchema.safeParse({ token: SOL_MINT, hours: 6 }).success).toBe(true);
      expect(TokenWhaleFlowSchema.safeParse({ token: SOL_MINT, hours: 48 }).success).toBe(false);
    });

    it("validates the optional pre-trade wallet", () => {
      expect(
        TokenPreTradePackSchema.safeParse({ token: SOL_MINT, wallet: BASE_TOKEN, amount: 5 })
          .success,
      ).toBe(true);
      expect(TokenPreTradePackSchema.safeParse({ token: SOL_MINT, wallet: "bad" }).success).toBe(
        false,
      );
    });
  });

  describe("supportsNetwork", () => {
    const provider = new TradingSignalsActionProvider();
    it("supports Base mainnet and Solana mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        true,
      );
    });
    it("does not support testnets or other chains", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
    });
  });

  describe("token_risk_verdict", () => {
    it("pays over x402 from a Base wallet and routes Base tokens to /base/token-verdict", async () => {
      const provider = new TradingSignalsActionProvider();
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse(
          200,
          { token: { symbol: "TOSHI" }, verdict: { rating: "safe", grade: "A" } },
          { "payment-response": paymentHeader("eip155:8453", "0xtx") },
        ),
      );

      const result = JSON.parse(
        await provider.tokenRiskVerdict(makeEvmWallet(), { token: BASE_TOKEN }),
      );

      expect(registerExactEvmScheme).toHaveBeenCalled();
      const [url] = mockFetchWithPayment.mock.calls[0];
      expect(url).toBe(`https://signals.incomefather.com/base/token-verdict?address=${BASE_TOKEN}`);
      expect(result.status).toBe("success");
      expect(result.summary).toBe("TOSHI: SAFE (grade A)");
      expect(result.paidWith).toBe("x402");
      expect(result.priceUsdc).toBe(0.01);
      expect(result.payment.explorerUrl).toBe("https://basescan.org/tx/0xtx");
    });

    it("routes Solana mints to /solana/token-verdict and pays from a Solana wallet", async () => {
      const provider = new TradingSignalsActionProvider();
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse(
          200,
          { token: { symbol: "Bonk" }, verdict: { rating: "caution", grade: "C" } },
          {
            "payment-response": paymentHeader("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "sig1"),
          },
        ),
      );

      const result = JSON.parse(
        await provider.tokenRiskVerdict(makeSvmWallet(), { token: SOL_MINT }),
      );

      expect(registerExactSvmScheme).toHaveBeenCalled();
      expect(mockFetchWithPayment.mock.calls[0][0]).toBe(
        `https://signals.incomefather.com/solana/token-verdict?mint=${SOL_MINT}`,
      );
      expect(result.summary).toBe("Bonk: CAUTION (grade C)");
      expect(result.payment.explorerUrl).toBe("https://solscan.io/tx/sig1");
    });

    it("rejects a chain that does not match the address format", async () => {
      const provider = new TradingSignalsActionProvider();
      const result = JSON.parse(
        await provider.tokenRiskVerdict(makeEvmWallet(), { token: SOL_MINT, chain: "base" }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toBe("invalid_input");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });
  });

  describe("payment policy", () => {
    it("only allows USDC on the wallet's network at or below the cap", async () => {
      const provider = new TradingSignalsActionProvider({ maxPaymentUsdc: 0.015 });
      mockFetchWithPayment.mockResolvedValue(createMockResponse(200, { verdict: {} }));
      await provider.tokenRiskVerdict(makeEvmWallet(), { token: BASE_TOKEN });

      expect(registeredPolicy).toBeDefined();
      const reqs = [
        { network: "eip155:8453", asset: BASE_USDC, amount: "10000" },
        { network: "eip155:8453", asset: BASE_USDC, amount: "20000" },
        {
          network: "eip155:8453",
          asset: "0x0000000000000000000000000000000000000001",
          amount: "1",
        },
        { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", asset: SOL_USDC, amount: "10000" },
      ];
      expect(registeredPolicy!(2, reqs)).toEqual([reqs[0]]);
    });

    it("refuses routes priced above the cap without calling the API", async () => {
      const provider = new TradingSignalsActionProvider({ maxPaymentUsdc: 0.01 });
      const result = JSON.parse(
        await provider.tokenWhaleFlow(makeEvmWallet(), { token: SOL_MINT }),
      );
      expect(result.error).toBe("over_payment_cap");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("refuses to pay from an unsupported network", async () => {
      const provider = new TradingSignalsActionProvider();
      const result = JSON.parse(
        await provider.tokenRiskVerdict(makeEvmWallet("base-sepolia"), { token: BASE_TOKEN }),
      );
      expect(result.error).toBe("unsupported_network");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("reports a failed payment when the API still answers 402", async () => {
      const provider = new TradingSignalsActionProvider();
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse(402, { error: "Payment required" }),
      );
      const result = JSON.parse(
        await provider.tokenRiskVerdict(makeEvmWallet(), { token: BASE_TOKEN }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toBe("payment_failed");
    });

    it("rejects a non-positive cap", () => {
      expect(() => new TradingSignalsActionProvider({ maxPaymentUsdc: 0 })).toThrow();
    });
  });

  describe("api key", () => {
    it("uses the API key without paying when set", async () => {
      const provider = new TradingSignalsActionProvider({ apiKey: "test-key" });
      mockFetch.mockResolvedValue(createMockResponse(200, { decision: "GO" }));
      const result = JSON.parse(
        await provider.tokenPreTradePack(makeEvmWallet(), { token: SOL_MINT }),
      );
      expect(mockFetch.mock.calls[0][1].headers["x-api-key"]).toBe("test-key");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      expect(result.paidWith).toBe("api_key");
      expect(result.summary).toBe("Decision: GO");
    });

    it("falls back to x402 when the key's monthly quota is used up", async () => {
      const provider = new TradingSignalsActionProvider({ apiKey: "test-key" });
      mockFetch.mockResolvedValue(createMockResponse(429, { error: "quota_exceeded" }));
      mockFetchWithPayment.mockResolvedValue(createMockResponse(200, { decision: "STOP" }));
      const result = JSON.parse(
        await provider.tokenPreTradePack(makeEvmWallet(), { token: SOL_MINT }),
      );
      expect(mockFetchWithPayment).toHaveBeenCalled();
      expect(result.paidWith).toBe("x402");
      expect(result.summary).toBe("Decision: STOP");
    });
  });

  describe("token_pre_trade_pack and token_whale_flow", () => {
    it("passes wallet and amount to the pre-trade pack", async () => {
      const provider = new TradingSignalsActionProvider();
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse(200, { decision: "CAUTION", token: { verdict: { rating: "caution" } } }),
      );
      const result = JSON.parse(
        await provider.tokenPreTradePack(makeEvmWallet(), {
          token: SOL_MINT,
          wallet: BASE_TOKEN,
          amount: 5,
        }),
      );
      const url = new URL(mockFetchWithPayment.mock.calls[0][0]);
      expect(url.pathname).toBe("/bundle/token-pre-trade");
      expect(url.searchParams.get("wallet")).toBe(BASE_TOKEN);
      expect(url.searchParams.get("amount")).toBe("5");
      expect(result.summary).toBe("Decision: CAUTION, token verdict caution");
      expect(result.priceUsdc).toBe(0.015);
    });

    it("drops amount when no wallet is given", async () => {
      const provider = new TradingSignalsActionProvider();
      mockFetchWithPayment.mockResolvedValue(createMockResponse(200, { decision: "GO" }));
      await provider.tokenPreTradePack(makeEvmWallet(), { token: SOL_MINT, amount: 5 });
      const url = new URL(mockFetchWithPayment.mock.calls[0][0]);
      expect(url.searchParams.has("amount")).toBe(false);
    });

    it("summarizes whale flow", async () => {
      const provider = new TradingSignalsActionProvider();
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse(200, {
          summary: {
            signal: "accumulation",
            whaleBuys: 3,
            whaleBuyUsd: 30000,
            whaleSells: 1,
            whaleSellUsd: 5000,
            netFlowUsd: 25000,
          },
        }),
      );
      const result = JSON.parse(
        await provider.tokenWhaleFlow(makeSvmWallet(), { token: SOL_MINT, hours: 6 }),
      );
      const url = new URL(mockFetchWithPayment.mock.calls[0][0]);
      expect(url.pathname).toBe("/crypto/whale-flow");
      expect(url.searchParams.get("hours")).toBe("6");
      expect(result.summary).toBe(
        "Whale signal: accumulation; 3 buys ($30000) vs 1 sells ($5000), net $25000",
      );
      expect(result.priceUsdc).toBe(0.02);
    });

    it("returns a structured error when the request throws", async () => {
      const provider = new TradingSignalsActionProvider();
      mockFetchWithPayment.mockRejectedValue(new Error("network down"));
      const result = JSON.parse(
        await provider.tokenWhaleFlow(makeEvmWallet(), { token: SOL_MINT }),
      );
      expect(result.status).toBe("error");
      expect(result.message).toBe("network down");
    });
  });
});
