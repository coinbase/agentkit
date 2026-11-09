import { EvmWalletProvider } from "../../wallet-providers";
import { indexfyActionProvider } from "./indexfyActionProvider";
import { INDEXFY_ZAPPER_BASE, USDC_BASE } from "./constants";
import { BuyIndexSchema, SellIndexSchema } from "./schemas";

const API = "https://api.indexfy.xyz/mcp";
const WALLET = "0x1111111111111111111111111111111111111111";
const I5 = "0x85d169AF5000c070Af5C6Edb0Abf2ca3c4278AdF";
const INDEXES = {
  indexes: [
    { address: I5.toLowerCase(), name: "INDEXFY TOP5", symbol: "I5" },
    { address: "0x1f5f467562595cf6e09cc9db722f16a8493c6175", name: "INDEXFY MAG7", symbol: "M7" },
  ],
};

/** Responses keyed by MCP tool name; a function receives the tool arguments. */
type Tools = Record<string, unknown | ((args: Record<string, unknown>) => unknown)>;
let tools: Tools;
const toolCalls: { name: string; args: Record<string, unknown> }[] = [];

/**
 * Wraps a value as an MCP tools/call response.
 *
 * @param value - The tool result, or an error message when isError is true
 * @param isError - Whether the tool reported an error
 * @returns A fetch Response-like object
 */
function mcpResponse(value: unknown, isError = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return {
    ok: true,
    json: async () => ({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text }], isError },
    }),
  };
}

global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
  if (url !== API) return { ok: true, json: async () => ({}), text: async () => "" }; // AgentKit analytics
  const { params } = JSON.parse(String(init?.body));
  toolCalls.push({ name: params.name, args: params.arguments });
  const handler = tools[params.name];
  if (handler === undefined) return mcpResponse(`unknown tool ${params.name}`, true);
  const value =
    typeof handler === "function"
      ? (handler as (a: Record<string, unknown>) => unknown)(params.arguments)
      : handler;
  if (value instanceof Error) return mcpResponse(value.message, true);
  return mcpResponse(value);
}) as unknown as typeof fetch;

/**
 * A build_* tool result for a 5 USDC I5 buy from WALLET.
 *
 * @param overrides - Fields to replace
 * @returns The built transaction
 */
function built(overrides: Record<string, unknown> = {}) {
  return {
    chainId: 8453,
    from: WALLET,
    calls: [
      { to: USDC_BASE, data: "0x095ea7b3", value: "0", description: "Approve 5 USDC" },
      {
        to: INDEXFY_ZAPPER_BASE,
        data: "0x307c9008",
        value: "0",
        description: "Buy I5 with up to 5 USDC",
      },
    ],
    simulation: { status: "success" },
    summary: { symbol: "I5", expectedShares: "5.66", minShares: "5.63" },
    ...overrides,
  };
}

describe("IndexfyActionProvider", () => {
  let wallet: jest.Mocked<EvmWalletProvider>;
  const provider = indexfyActionProvider();

  beforeEach(() => {
    toolCalls.length = 0;
    tools = { list_indexes: INDEXES };
    wallet = {
      getAddress: jest.fn().mockReturnValue(WALLET),
      getName: jest.fn().mockReturnValue("mock"),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
      sendTransaction: jest.fn().mockResolvedValueOnce("0xaaa").mockResolvedValueOnce("0xbbb"),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet only", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("schemas", () => {
    it("validates amounts", () => {
      expect(BuyIndexSchema.safeParse({ index: "I5", usdcAmount: "25" }).success).toBe(true);
      expect(BuyIndexSchema.safeParse({ index: "I5", usdcAmount: "-5" }).success).toBe(false);
      expect(BuyIndexSchema.safeParse({ index: "I5", usdcAmount: "abc" }).success).toBe(false);
      expect(SellIndexSchema.safeParse({ index: "I5", shares: "all" }).success).toBe(true);
      expect(SellIndexSchema.safeParse({ index: "I5", shares: "1.5" }).success).toBe(true);
    });
  });

  it("exposes five actions", () => {
    const names = provider.getActions(wallet).map(a => a.name);
    expect(names).toEqual(
      expect.arrayContaining(
        ["list_indexes", "get_index", "get_portfolio", "buy_index", "sell_index"].map(
          n => `IndexfyActionProvider_${n}`,
        ),
      ),
    );
  });

  describe("reads", () => {
    it("lists indexes", async () => {
      const res = JSON.parse(await provider.listIndexes({ sort: "tvl", limit: 20 }));
      expect(res.success).toBe(true);
      expect(res.indexes).toHaveLength(2);
    });

    it("resolves a ticker for get_index", async () => {
      tools.get_index = (args: Record<string, unknown>) => ({
        address: args.address,
        holdings: [],
      });
      const res = JSON.parse(await provider.getIndex({ index: "i5" }));
      expect(res.success).toBe(true);
      expect(toolCalls.find(c => c.name === "get_index")?.args.address).toBe(I5);
    });

    it("rejects an unknown ticker and lists the available ones", async () => {
      const res = JSON.parse(await provider.getIndex({ index: "NOPE" }));
      expect(res.success).toBe(false);
      expect(res.error).toContain("I5, M7");
    });

    it("defaults the portfolio to the agent's wallet", async () => {
      tools.get_wallet_portfolio = { positions: [] };
      await provider.getPortfolio(wallet, {});
      expect(toolCalls.find(c => c.name === "get_wallet_portfolio")?.args.wallet).toBe(WALLET);
    });
  });

  describe("buy_index", () => {
    it("sends the approval then the buy, each after the previous confirms", async () => {
      tools.build_buy_index = built();
      const res = JSON.parse(await provider.buyIndex(wallet, { index: "I5", usdcAmount: "5" }));

      expect(res.success).toBe(true);
      expect(res.summary.expectedShares).toBe("5.66");
      expect(res.transactions.map((t: { hash: string }) => t.hash)).toEqual(["0xaaa", "0xbbb"]);
      expect(wallet.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: USDC_BASE,
        data: "0x095ea7b3",
        value: BigInt(0),
      });
      expect(wallet.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
      expect(toolCalls.find(c => c.name === "build_buy_index")?.args).toEqual({
        wallet: WALLET,
        index: I5,
        usdcAmount: "5",
      });
    });

    it("does not send when the simulation reverted", async () => {
      tools.build_buy_index = built({
        simulation: { status: "reverted", error: "insufficient USDC" },
      });
      const res = JSON.parse(await provider.buyIndex(wallet, { index: "I5", usdcAmount: "5" }));
      expect(res.success).toBe(false);
      expect(res.error).toContain("insufficient USDC");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses calls to contracts outside the allow-list", async () => {
      tools.build_buy_index = built({
        calls: [
          {
            to: "0x9999999999999999999999999999999999999999",
            data: "0x",
            value: "0",
            description: "?",
          },
        ],
      });
      const res = JSON.parse(await provider.buyIndex(wallet, { index: "I5", usdcAmount: "5" }));
      expect(res.success).toBe(false);
      expect(res.error).toContain("unexpected contract");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses a transaction built for another wallet or chain", async () => {
      tools.build_buy_index = built({ from: "0x2222222222222222222222222222222222222222" });
      expect(
        JSON.parse(await provider.buyIndex(wallet, { index: "I5", usdcAmount: "5" })).success,
      ).toBe(false);
      tools.build_buy_index = built({ chainId: 1 });
      expect(
        JSON.parse(await provider.buyIndex(wallet, { index: "I5", usdcAmount: "5" })).success,
      ).toBe(false);
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("stops after a failed transaction", async () => {
      tools.build_buy_index = built();
      wallet.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
      const res = JSON.parse(await provider.buyIndex(wallet, { index: "I5", usdcAmount: "5" }));
      expect(res.success).toBe(false);
      expect(res.transactions).toHaveLength(1);
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("passes API errors through", async () => {
      tools.build_buy_index = new Error("wallet holds 0 USDC but this needs 5 USDC on Base");
      const res = JSON.parse(await provider.buyIndex(wallet, { index: "I5", usdcAmount: "5" }));
      expect(res).toEqual({
        success: false,
        error: "wallet holds 0 USDC but this needs 5 USDC on Base",
      });
    });
  });

  describe("sell_index", () => {
    const sellCalls = [
      { to: I5, data: "0x095ea7b3", value: "0", description: "Approve 2 I5" },
      {
        to: INDEXFY_ZAPPER_BASE,
        data: "0xdeadbeef",
        value: "0",
        description: "Sell 2 I5 for USDC",
      },
    ];

    it("sells the whole balance for 'all'", async () => {
      wallet.readContract.mockResolvedValue(BigInt("2500000000000000000"));
      tools.build_sell_index = built({ calls: sellCalls });
      const res = JSON.parse(await provider.sellIndex(wallet, { index: "I5", shares: "all" }));
      expect(res.success).toBe(true);
      expect(toolCalls.find(c => c.name === "build_sell_index")?.args.shares).toBe("2.5");
    });

    it("reports an empty position instead of building", async () => {
      wallet.readContract.mockResolvedValue(BigInt(0));
      const res = JSON.parse(await provider.sellIndex(wallet, { index: "I5", shares: "all" }));
      expect(res.success).toBe(false);
      expect(toolCalls.find(c => c.name === "build_sell_index")).toBeUndefined();
    });
  });
});
