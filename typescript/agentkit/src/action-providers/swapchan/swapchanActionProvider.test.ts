import { swapchanActionProvider, SwapChanActionProvider } from "./swapchanActionProvider";
import { SwapChanQuoteSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

global.fetch = jest.fn();

const MOCK_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const ok = (body: unknown) => ({ ok: true, json: async () => body });
const fail = (status: number, text: string) => ({
  ok: false,
  status,
  statusText: "Bad Request",
  text: async () => text,
});

const quote = (id: string, provider: string, extra: Record<string, unknown> = {}) => ({
  id,
  provider,
  toAmount: "1000000000000000000",
  toAmountMin: "990000000000000000",
  gasUsd: 0.01,
  feeUsd: 0.02,
  netUsd: 2500,
  etaSeconds: 30,
  expiresAt: Date.now() + 60000,
  ...extra,
});

const baseArgs = {
  fromToken: USDC,
  toToken: ETH,
  amount: "2500",
  toChainId: null,
  toAddress: null,
  slippageBps: 50,
};

describe("SwapChan Schema Validation", () => {
  it("accepts valid input and defaults slippage", () => {
    const r = SwapChanQuoteSchema.safeParse({ ...baseArgs, slippageBps: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slippageBps).toBe(50);
  });

  it("rejects an invalid fromToken", () => {
    expect(SwapChanQuoteSchema.safeParse({ ...baseArgs, fromToken: "nope" }).success).toBe(false);
  });

  it("allows a non-EVM toToken for cross-chain swaps", () => {
    const r = SwapChanQuoteSchema.safeParse({
      ...baseArgs,
      toToken: "11111111111111111111111111111111",
      toChainId: 792703809,
      toAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    });
    expect(r.success).toBe(true);
  });
});

describe("SwapChanActionProvider", () => {
  let provider: SwapChanActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;
  const fetchMock = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SWAPCHAN_PARTNER_ID;
    provider = swapchanActionProvider({ partnerId: "my-partner" });
    wallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ chainId: "8453", protocolFamily: "evm" }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("getQuote", () => {
    it("requests quotes with base units and partner id and formats results", async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ decimals: 6 }))
        .mockResolvedValueOnce(
          ok({ quotes: [quote("lifi:1", "lifi")], best: "lifi:1", errors: [] }),
        );

      const res = JSON.parse(await provider.getQuote(wallet, baseArgs));

      expect(res.success).toBe(true);
      expect(res.best).toBe("lifi:1");
      expect(res.quotes[0]).toMatchObject({ provider: "lifi", toAmount: "1", executable: true });
      const url = new URL(fetchMock.mock.calls[1][0]);
      expect(url.pathname).toBe("/quotes");
      expect(url.searchParams.get("fromChainId")).toBe("8453");
      expect(url.searchParams.get("toChainId")).toBe("8453");
      expect(url.searchParams.get("amount")).toBe("2500000000");
      expect(url.searchParams.get("partner")).toBe("my-partner");
      expect(url.searchParams.get("toAddress")).toBe(MOCK_ADDRESS);
    });

    it("omits partner when none configured", async () => {
      provider = swapchanActionProvider();
      fetchMock
        .mockResolvedValueOnce(ok({ decimals: 6 }))
        .mockResolvedValueOnce(ok({ quotes: [quote("a", "relay")], best: "a", errors: [] }));
      await provider.getQuote(wallet, baseArgs);
      expect(new URL(fetchMock.mock.calls[1][0]).searchParams.has("partner")).toBe(false);
    });

    it("returns an error when no routes are found", async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ decimals: 6 }))
        .mockResolvedValueOnce(
          ok({ quotes: [], best: null, errors: [{ provider: "lifi", message: "no route" }] }),
        );
      const res = JSON.parse(await provider.getQuote(wallet, baseArgs));
      expect(res.success).toBe(false);
      expect(res.error).toContain("lifi: no route");
    });

    it("returns an error on API failure", async () => {
      fetchMock.mockResolvedValueOnce(fail(400, "bad token"));
      const res = JSON.parse(await provider.getQuote(wallet, baseArgs));
      expect(res.success).toBe(false);
      expect(res.error).toContain("bad token");
    });
  });

  describe("swap", () => {
    it("sends approval then swap and returns hashes", async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ decimals: 6 }))
        .mockResolvedValueOnce(
          ok({ quotes: [quote("relay:1", "relay")], best: "relay:1", errors: [] }),
        )
        .mockResolvedValueOnce(
          ok({
            chainId: 8453,
            to: "0x00000000000000000000000000000000000000aa",
            data: "0x1234",
            value: "0",
            approval: {
              chainId: 8453,
              to: USDC,
              data: "0x095ea7b3",
              value: "0",
            },
          }),
        );
      wallet.sendTransaction.mockResolvedValueOnce("0xapprove").mockResolvedValueOnce("0xswap");

      const res = JSON.parse(await provider.swap(wallet, baseArgs));

      expect(res).toMatchObject({
        success: true,
        provider: "relay",
        txHash: "0xswap",
        approvalTxHash: "0xapprove",
      });
      expect(wallet.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: USDC,
        data: "0x095ea7b3",
        value: 0n,
      });
      expect(wallet.sendTransaction).toHaveBeenNthCalledWith(2, {
        to: "0x00000000000000000000000000000000000000aa",
        data: "0x1234",
        value: 0n,
      });
      const buildBody = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(buildBody).toEqual({ quoteId: "relay:1", taker: MOCK_ADDRESS });
    });

    it("skips order and Permit2 routes", async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ decimals: 6 }))
        .mockResolvedValueOnce(
          ok({
            quotes: [
              quote("cow:1", "cow", { execution: "order" }),
              quote("zerox:1", "zerox"),
              quote("lifi:1", "lifi"),
            ],
            best: "cow:1",
            errors: [],
          }),
        )
        .mockResolvedValueOnce(
          ok({ chainId: 8453, to: "0x1", data: "0x", value: "0", permit2: {} }),
        )
        .mockResolvedValueOnce(
          ok({
            chainId: 8453,
            to: "0x00000000000000000000000000000000000000bb",
            data: "0xab",
            value: "5",
          }),
        );
      wallet.sendTransaction.mockResolvedValueOnce("0xswap");

      const res = JSON.parse(await provider.swap(wallet, baseArgs));

      expect(res).toMatchObject({ success: true, provider: "lifi", txHash: "0xswap" });
      expect(res.approvalTxHash).toBeUndefined();
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
      expect(wallet.sendTransaction).toHaveBeenCalledWith({
        to: "0x00000000000000000000000000000000000000bb",
        data: "0xab",
        value: 5n,
      });
    });

    it("passes recipient for cross-chain swaps", async () => {
      const sol = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
      fetchMock
        .mockResolvedValueOnce(ok({ decimals: 6 }))
        .mockResolvedValueOnce(ok({ decimals: 9 }))
        .mockResolvedValueOnce(
          ok({ quotes: [quote("relay:2", "relay")], best: "relay:2", errors: [] }),
        )
        .mockResolvedValueOnce(
          ok({
            chainId: 8453,
            to: "0x00000000000000000000000000000000000000cc",
            data: "0x01",
            value: "0",
          }),
        );
      wallet.sendTransaction.mockResolvedValueOnce("0xswap");

      const res = JSON.parse(
        await provider.swap(wallet, {
          ...baseArgs,
          toToken: "11111111111111111111111111111111",
          toChainId: 792703809,
          toAddress: sol,
        }),
      );

      expect(res.success).toBe(true);
      expect(res.statusUrl).toContain("toChainId=792703809");
      expect(JSON.parse(fetchMock.mock.calls[3][1].body).recipient).toBe(sol);
    });

    it("fails when no route is executable", async () => {
      fetchMock.mockResolvedValueOnce(ok({ decimals: 6 })).mockResolvedValueOnce(
        ok({
          quotes: [quote("cow:1", "cow", { execution: "order" })],
          best: "cow:1",
          errors: [],
        }),
      );
      const res = JSON.parse(await provider.swap(wallet, baseArgs));
      expect(res.success).toBe(false);
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("reports a failed swap transaction", async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ decimals: 6 }))
        .mockResolvedValueOnce(ok({ quotes: [quote("a", "lifi")], best: "a", errors: [] }))
        .mockResolvedValueOnce(
          ok({
            chainId: 8453,
            to: "0x00000000000000000000000000000000000000dd",
            data: "0x01",
            value: "0",
          }),
        );
      wallet.sendTransaction.mockResolvedValueOnce("0xswap");
      wallet.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
      const res = JSON.parse(await provider.swap(wallet, baseArgs));
      expect(res).toMatchObject({ success: false, txHash: "0xswap" });
    });
  });

  describe("supportsNetwork", () => {
    it("supports EVM only", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
    });
  });
});
