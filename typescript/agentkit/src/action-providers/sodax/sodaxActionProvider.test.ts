import { encodeFunctionData, erc20Abi } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { SodaxActionProvider, sodaxActionProvider } from "./sodaxActionProvider";
import {
  SodaxGetQuoteSchema,
  SodaxGetSupportedTokensSchema,
  SodaxGetSwapStatusSchema,
  SodaxSwapSchema,
} from "./schemas";
import { applySlippage, findToken } from "./utils";

const WALLET = "0x71C234708F9E949C6D30AdAAa6a2866E348979ed";
const SOLANA_RECIPIENT = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const NATIVE = "0x0000000000000000000000000000000000000000";
const ASSET_MANAGER = "0x348BE44F63A458be9C1b13D6fD8e99048F297Bc3";
const TX_HASH = `0x${"ab".repeat(32)}` as const;
const APPROVE_HASH = `0x${"cd".repeat(32)}` as const;

const BASE_TOKENS = [
  { symbol: "ETH", name: "Ethereum", decimals: 18, address: NATIVE },
  { symbol: "USDC", name: "USD Coin", decimals: 6, address: BASE_USDC },
];
const ARB_TOKENS = [{ symbol: "USDC", name: "USD Coin", decimals: 6, address: ARB_USDC }];
const SOL_TOKENS = [
  { symbol: "SOL", name: "Solana", decimals: 9, address: "11111111111111111111111111111111" },
  { symbol: "USDC", name: "USD Coin", decimals: 6, address: SOL_USDC },
];

const INTENT = {
  intentId: "1",
  creator: "0x7633847Cd63307f53aFB3417e42B600A316896bd",
  inputToken: "0x72E852545B024ddCbc5b70C1bCBDAA025164259C",
  outputToken: "0xdB7BdA65c3a1C51D64dC4444e418684677334109",
  inputAmount: "10000000",
  minOutputAmount: "9893613",
  deadline: "1794813264",
  allowPartialFill: false,
  srcChain: "30",
  dstChain: "23",
  srcAddress: WALLET,
  dstAddress: WALLET,
  solver: NATIVE,
  data: "0x",
};

const approveData = (spender: string, amount: bigint) =>
  encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender as `0x${string}`, amount],
  });

type Route = { status?: number; body: unknown };

/**
 * Builds a fetch mock that answers SODAX API requests by method and path.
 *
 * @param routes - Responses keyed by "METHOD /path" (query string excluded).
 * @returns The fetch mock.
 */
function mockSodaxApi(routes: Record<string, Route>): jest.Mock {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace("https://api.sodax.com/v1/swaps", "").split("?")[0];
    const key = `${init?.method ?? "GET"} ${path}`;
    const route = routes[key];
    if (!route) {
      return { ok: false, status: 404, text: async () => JSON.stringify({ message: "not found" }) };
    }
    const status = route.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(route.body),
    };
  });
}

const defaultRoutes = (): Record<string, Route> => ({
  "GET /tokens/0x2105.base": { body: BASE_TOKENS },
  "GET /tokens/0xa4b1.arbitrum": { body: ARB_TOKENS },
  "GET /tokens/solana": { body: SOL_TOKENS },
  "POST /quote": { body: { quotedAmount: "9993549" } },
  "GET /deadline": { body: { deadline: "1794813264" } },
  "POST /intents": {
    body: {
      tx: { from: WALLET, to: ASSET_MANAGER, value: "0", data: "0xc6b4180b" },
      intent: INTENT,
      relayData: { address: INTENT.creator, payload: "0x1234" },
    },
  },
  "POST /allowance/check": { body: { valid: false } },
  "POST /approve": {
    body: {
      tx: { from: WALLET, to: BASE_USDC, value: "0", data: approveData(ASSET_MANAGER, 10000000n) },
    },
  },
  "POST /submit-tx": { body: { success: true, data: { status: "inserted" } } },
});

/**
 * Gets the parsed JSON body of the fetch call to a path.
 *
 * @param fetchMock - The fetch mock.
 * @param path - The API path.
 * @returns The parsed request body.
 */
function bodyOf(fetchMock: jest.Mock, path: string): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url]) => (url as string).includes(path));
  return JSON.parse(call![1].body as string);
}

describe("SODAX Action Provider", () => {
  const originalFetch = global.fetch;
  let provider: SodaxActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = sodaxActionProvider();
    wallet = {
      getAddress: jest.fn().mockReturnValue(WALLET),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      }),
      sendTransaction: jest.fn().mockResolvedValueOnce(APPROVE_HASH).mockResolvedValueOnce(TX_HASH),
      waitForTransactionReceipt: jest
        .fn()
        .mockImplementation(async (hash: string) => ({ status: "success", transactionHash: hash })),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    fetchMock = mockSodaxApi(defaultRoutes());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("schemas", () => {
    it("parses a valid swap input and defaults slippage", () => {
      const result = SodaxSwapSchema.safeParse({
        inputToken: "USDC",
        outputToken: "USDC",
        destinationChainKey: "solana",
        amount: "10",
        destinationAddress: SOLANA_RECIPIENT,
        slippageBps: null,
      });
      expect(result.success).toBe(true);
      expect(result.data?.slippageBps).toBe(100);
    });

    it("rejects invalid amounts and slippage", () => {
      const base = {
        inputToken: "USDC",
        outputToken: "USDC",
        destinationChainKey: null,
        destinationAddress: null,
      };
      expect(SodaxSwapSchema.safeParse({ ...base, amount: "-1", slippageBps: 50 }).success).toBe(
        false,
      );
      expect(SodaxSwapSchema.safeParse({ ...base, amount: "1", slippageBps: 9000 }).success).toBe(
        false,
      );
      expect(
        SodaxGetQuoteSchema.safeParse({ ...base, amount: "abc", destinationChainKey: null })
          .success,
      ).toBe(false);
      expect(
        SodaxGetQuoteSchema.safeParse({ ...base, amount: "0.0", destinationChainKey: null })
          .success,
      ).toBe(false);
    });

    it("validates swap status and token list inputs", () => {
      expect(
        SodaxGetSwapStatusSchema.safeParse({ txHash: TX_HASH, sourceChainKey: null }).success,
      ).toBe(true);
      expect(
        SodaxGetSwapStatusSchema.safeParse({ txHash: "0x123", sourceChainKey: null }).success,
      ).toBe(false);
      expect(SodaxGetSupportedTokensSchema.safeParse({ chainKey: null }).success).toBe(true);
    });
  });

  describe("utils", () => {
    it("applies slippage in basis points", () => {
      expect(applySlippage(10_000n, 100)).toBe(9_900n);
      expect(applySlippage(10_000n, 0)).toBe(10_000n);
      expect(() => applySlippage(10_000n, 6000)).toThrow("slippageBps");
    });

    it("finds tokens by address or symbol", () => {
      expect(findToken(BASE_TOKENS, BASE_USDC.toLowerCase(), "0x2105.base").symbol).toBe("USDC");
      expect(findToken(BASE_TOKENS, "eth", "0x2105.base").address).toBe(NATIVE);
      expect(() => findToken(BASE_TOKENS, "DOGE", "0x2105.base")).toThrow("not supported");
      expect(() =>
        findToken(
          [...BASE_TOKENS, { symbol: "USDC", decimals: 6, address: `0x${"1".repeat(40)}` }],
          "USDC",
          "0x2105.base",
        ),
      ).toThrow("matches several tokens");
    });
  });

  describe("supportsNetwork", () => {
    it("supports SODAX EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "42161" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "146" })).toBe(true);
    });

    it("rejects other networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "84532" })).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("get_supported_tokens", () => {
    it("lists tokens on the wallet network by default", async () => {
      const result = JSON.parse(await provider.getSupportedTokens(wallet, { chainKey: null }));
      expect(result.chainKey).toBe("0x2105.base");
      expect(result.tokens).toHaveLength(2);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.sodax.com/v1/swaps/tokens/0x2105.base");
    });

    it("lists every chain with 'all'", async () => {
      fetchMock = mockSodaxApi({
        "GET /tokens": { body: { "0x2105.base": BASE_TOKENS, solana: SOL_TOKENS } },
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const result = JSON.parse(await provider.getSupportedTokens(wallet, { chainKey: "all" }));
      expect(result.chains).toEqual(["0x2105.base", "solana"]);
    });

    it("sends the API key header when configured", async () => {
      provider = sodaxActionProvider({ apiKey: "sodax_test" });
      await provider.getSupportedTokens(wallet, { chainKey: "solana" });
      expect(fetchMock.mock.calls[0][1].headers["x-api-key"]).toBe("sodax_test");
    });

    it("returns API errors", async () => {
      fetchMock = mockSodaxApi({ "GET /tokens/foo": { status: 500, body: { message: "boom" } } });
      global.fetch = fetchMock as unknown as typeof fetch;
      const result = await provider.getSupportedTokens(wallet, { chainKey: "foo" });
      expect(result).toContain("Error fetching SODAX supported tokens");
      expect(result).toContain("boom");
    });
  });

  describe("get_quote", () => {
    it("quotes a cross-network swap in base units and formats the output", async () => {
      const result = await provider.getQuote(wallet, {
        inputToken: "USDC",
        outputToken: ARB_USDC,
        destinationChainKey: "0xa4b1.arbitrum",
        amount: "10",
      });
      expect(bodyOf(fetchMock, "/quote")).toEqual({
        tokenSrc: BASE_USDC,
        tokenSrcChainKey: "0x2105.base",
        tokenDst: ARB_USDC,
        tokenDstChainKey: "0xa4b1.arbitrum",
        amount: "10000000",
        quoteType: "exact_input",
      });
      expect(result).toContain("Expected output: 9.993549 USDC");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("returns an error for an unsupported token", async () => {
      const result = await provider.getQuote(wallet, {
        inputToken: "DOGE",
        outputToken: "USDC",
        destinationChainKey: "solana",
        amount: "1",
      });
      expect(result).toContain("Error getting SODAX quote");
      expect(result).toContain("DOGE is not supported");
    });

    it("returns quote API errors", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /quote": { status: 400, body: { message: "unsupported token_src" } },
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const result = await provider.getQuote(wallet, {
        inputToken: "USDC",
        outputToken: "USDC",
        destinationChainKey: "solana",
        amount: "1",
      });
      expect(result).toContain("returned 400: unsupported token_src");
    });
  });

  describe("swap", () => {
    const swapArgs = {
      inputToken: "USDC",
      outputToken: "USDC",
      destinationChainKey: "0xa4b1.arbitrum",
      amount: "10",
      destinationAddress: null,
      slippageBps: 100,
    };

    it("approves, creates the intent and submits it to SODAX", async () => {
      const result = await provider.swap(wallet, swapArgs);

      expect(result).toContain("Submitted SODAX swap");
      expect(result).toContain(TX_HASH);
      const intentBody = bodyOf(fetchMock, "/intents");
      expect(intentBody).toMatchObject({
        srcChainKey: "0x2105.base",
        dstChainKey: "0xa4b1.arbitrum",
        inputToken: BASE_USDC,
        outputToken: ARB_USDC,
        inputAmount: "10000000",
        minOutputAmount: "9893613",
        deadline: "1794813264",
        srcAddress: WALLET,
        dstAddress: WALLET,
        allowPartialFill: false,
      });

      expect(wallet.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: BASE_USDC,
        data: approveData(ASSET_MANAGER, 10000000n),
        value: 0n,
      });
      expect(wallet.sendTransaction).toHaveBeenNthCalledWith(2, {
        to: ASSET_MANAGER,
        data: "0xc6b4180b",
        value: 0n,
      });
      expect(bodyOf(fetchMock, "/submit-tx")).toEqual({
        txHash: TX_HASH,
        srcChainKey: "0x2105.base",
        walletAddress: WALLET,
        intent: INTENT,
        relayData: "0x1234",
      });
    });

    it("applies the default slippage when called without schema parsing", async () => {
      await provider.swap(wallet, {
        ...swapArgs,
        slippageBps: null as unknown as number,
      });
      expect(bodyOf(fetchMock, "/intents").minOutputAmount).toBe("9893613");
    });

    it("skips the approval when the allowance is sufficient", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /allowance/check": { body: { valid: true } },
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      wallet.sendTransaction.mockReset().mockResolvedValue(TX_HASH);

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("Submitted SODAX swap");
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.some(([url]) => (url as string).endsWith("/approve"))).toBe(
        false,
      );
    });

    it("sends native value and skips allowance checks for the native asset", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /intents": {
          body: {
            tx: { from: WALLET, to: ASSET_MANAGER, value: "1000000000000000", data: "0xc6b4180b" },
            intent: INTENT,
            relayData: { address: INTENT.creator, payload: "0x1234" },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      wallet.sendTransaction.mockReset().mockResolvedValue(TX_HASH);

      const result = await provider.swap(wallet, {
        ...swapArgs,
        inputToken: "ETH",
        amount: "0.001",
      });
      expect(result).toContain("Submitted SODAX swap");
      expect(wallet.sendTransaction).toHaveBeenCalledWith({
        to: ASSET_MANAGER,
        data: "0xc6b4180b",
        value: 1000000000000000n,
      });
      expect(
        fetchMock.mock.calls.some(([url]) => (url as string).endsWith("/allowance/check")),
      ).toBe(false);
    });

    it("requires a destination address for non-EVM destinations", async () => {
      const result = await provider.swap(wallet, {
        ...swapArgs,
        destinationChainKey: "solana",
      });
      expect(result).toContain("destinationAddress is required");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("passes the destination address for Solana swaps", async () => {
      await provider.swap(wallet, {
        ...swapArgs,
        destinationChainKey: "solana",
        destinationAddress: SOLANA_RECIPIENT,
      });
      expect(bodyOf(fetchMock, "/intents")).toMatchObject({
        dstChainKey: "solana",
        outputToken: SOL_USDC,
        dstAddress: SOLANA_RECIPIENT,
      });
    });

    it("refuses an approval for a different spender", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /approve": {
          body: {
            tx: {
              from: WALLET,
              to: BASE_USDC,
              value: "0",
              data: approveData(`0x${"9".repeat(40)}`, 10000000n),
            },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("does not match the swap contract");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses a swap transaction from another address", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /intents": {
          body: {
            tx: { from: `0x${"9".repeat(40)}`, to: ASSET_MANAGER, value: "0", data: "0x01" },
            intent: INTENT,
            relayData: { address: INTENT.creator, payload: "0x1234" },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("is not from the wallet address");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("resets the allowance first when SODAX asks for it", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /approve": {
          body: {
            resetTx: {
              from: WALLET,
              to: BASE_USDC,
              value: "0",
              data: approveData(ASSET_MANAGER, 0n),
            },
            tx: {
              from: WALLET,
              to: BASE_USDC,
              value: "0",
              data: approveData(ASSET_MANAGER, 10000000n),
            },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      wallet.sendTransaction
        .mockReset()
        .mockResolvedValueOnce(APPROVE_HASH)
        .mockResolvedValueOnce(APPROVE_HASH)
        .mockResolvedValueOnce(TX_HASH);

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("Submitted SODAX swap");
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(3);
      expect(wallet.sendTransaction.mock.calls[0][0].data).toBe(approveData(ASSET_MANAGER, 0n));
      expect(wallet.sendTransaction.mock.calls[1][0].data).toBe(
        approveData(ASSET_MANAGER, 10000000n),
      );
    });

    it("stops when the approval reverts", async () => {
      wallet.waitForTransactionReceipt
        .mockReset()
        .mockResolvedValueOnce({ status: "reverted", transactionHash: APPROVE_HASH });

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain(`the approval transaction ${APPROVE_HASH} failed`);
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("refuses an approval for more than the swap amount", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /approve": {
          body: {
            tx: {
              from: WALLET,
              to: BASE_USDC,
              value: "0",
              data: approveData(ASSET_MANAGER, 2n ** 256n - 1n),
            },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("does not match the expected amount");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses an approval that sends native value", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /approve": {
          body: {
            tx: {
              from: WALLET,
              to: BASE_USDC,
              value: "1",
              data: approveData(ASSET_MANAGER, 10000000n),
            },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("must not send native value");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses a token swap transaction that sends native value", async () => {
      fetchMock = mockSodaxApi({
        ...defaultRoutes(),
        "POST /intents": {
          body: {
            tx: { from: WALLET, to: ASSET_MANAGER, value: "5", data: "0xc6b4180b" },
            intent: INTENT,
            relayData: { address: INTENT.creator, payload: "0x1234" },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("value 5 does not match the expected 0");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("fails when the wallet returns no receipt", async () => {
      wallet.waitForTransactionReceipt.mockReset().mockResolvedValue(undefined);

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain("No receipt returned");
      expect(fetchMock.mock.calls.some(([url]) => (url as string).endsWith("/submit-tx"))).toBe(
        false,
      );
    });

    it("does not submit a reverted swap transaction", async () => {
      wallet.waitForTransactionReceipt
        .mockReset()
        .mockResolvedValueOnce({ status: "success", transactionHash: APPROVE_HASH })
        .mockResolvedValueOnce({ status: "reverted", transactionHash: TX_HASH });

      const result = await provider.swap(wallet, swapArgs);
      expect(result).toContain(`the swap transaction ${TX_HASH} reverted`);
      expect(fetchMock.mock.calls.some(([url]) => (url as string).endsWith("/submit-tx"))).toBe(
        false,
      );
    });

    it("submits the onchain hash for smart wallet user operations", async () => {
      const userOpHash = `0x${"ef".repeat(32)}`;
      wallet.sendTransaction.mockReset().mockResolvedValue(userOpHash as `0x${string}`);
      wallet.waitForTransactionReceipt
        .mockReset()
        .mockResolvedValue({ status: "complete", transactionHash: TX_HASH });

      await provider.swap(wallet, swapArgs);
      expect(bodyOf(fetchMock, "/submit-tx").txHash).toBe(TX_HASH);
    });
  });

  describe("get_swap_status", () => {
    it("reports a solved swap", async () => {
      fetchMock = mockSodaxApi({
        "GET /submit-tx/status": {
          body: {
            success: true,
            data: {
              status: "solved",
              result: { dstIntentTxHash: APPROVE_HASH, fillTxHash: "fill-hash" },
            },
          },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.getSwapStatus(wallet, {
        txHash: TX_HASH,
        sourceChainKey: null,
      });
      expect(fetchMock.mock.calls[0][0]).toBe(
        `https://api.sodax.com/v1/swaps/submit-tx/status?txHash=${TX_HASH}&srcChainKey=0x2105.base`,
      );
      expect(result).toContain("solved");
      expect(result).toContain("Fill transaction: fill-hash");
    });

    it("reports a failed swap with its message", async () => {
      fetchMock = mockSodaxApi({
        "GET /submit-tx/status": {
          body: { success: true, data: { status: "failed", userMessage: "Intent expired" } },
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.getSwapStatus(wallet, {
        txHash: TX_HASH,
        sourceChainKey: "0xa4b1.arbitrum",
      });
      expect(result).toContain("The swap failed: Intent expired");
      expect(result).toContain("can be cancelled");
    });

    it("returns not found errors", async () => {
      const result = await provider.getSwapStatus(wallet, {
        txHash: TX_HASH,
        sourceChainKey: null,
      });
      expect(result).toContain("Error getting SODAX swap status");
    });
  });
});
