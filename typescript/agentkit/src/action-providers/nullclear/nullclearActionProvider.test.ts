import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { buildNullClearGuardedRpcUrl, nullclearActionProvider } from "./index";

describe("NullClearActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const createMockWallet = (
    protocolFamily: string,
    networkId: string,
    chainId?: string,
    address = "0x1234567890123456789012345678901234567890",
  ): WalletProvider =>
    ({
      getAddress: jest.fn().mockReturnValue(address),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily, networkId, chainId }),
      getName: jest.fn().mockReturnValue("mock-wallet"),
    }) as unknown as WalletProvider;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("supportsNetwork", () => {
    it("should support EVM and Solana networks and reject unsupported families", () => {
      const provider = nullclearActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        true,
      );
      expect(
        provider.supportsNetwork({
          protocolFamily: "bitcoin",
          networkId: "btc-mainnet",
        } as Network),
      ).toBe(false);
    });
  });

  describe("preflightGuard", () => {
    it("should call POST /v1/guard with inferred wallet network and Bearer apiKey", async () => {
      const mockGuard = {
        recommendedAgentAction: "ABORT_DRAINER_APPROVAL",
        riskFlags: ["UNLIMITED_APPROVAL_TO_UNVERIFIED_SPENDER"],
      };
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockGuard),
      });

      const provider = nullclearActionProvider({ apiKey: "nc_live_test123" });
      const wallet = createMockWallet("evm", "base-mainnet", "8453");
      const approveCalldata =
        "0x095ea7b3000000000000000000000000000000000000000000000000000000000000beef" +
        "f".repeat(64);

      const res = await provider.preflightGuard(wallet, {
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        data: approveCalldata,
      });

      expect(JSON.parse(res)).toEqual(mockGuard);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.nullclear.dev/v1/guard");
      expect(init.method).toBe("POST");
      expect(init.headers.get("Authorization")).toBe("Bearer nc_live_test123");
      expect(JSON.parse(init.body)).toMatchObject({
        chain: "base",
        from: "0x1234567890123456789012345678901234567890",
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        data: approveCalldata,
      });
    });

    it("should return upgrade guidance cleanly when receiving HTTP 402", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 402,
        json: jest.fn().mockResolvedValue({ error: "Payment Required" }),
      });

      const provider = nullclearActionProvider();
      const wallet = createMockWallet("evm", "base-mainnet", "8453");
      const res = await provider.preflightGuard(wallet, {
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        data: "0x",
      });

      const parsed = JSON.parse(res);
      expect(parsed.upgradeInstructions).toContain("/v1/pass/buy");
    });
  });

  describe("scanToken", () => {
    it("should infer solana chain from svm wallet and return scan JSON", async () => {
      const mockScan = {
        chain: "solana",
        recommendedAgentAction: "EXECUTE_SAFE",
        score: 98,
      };
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockScan),
      });

      const provider = nullclearActionProvider();
      const solWallet = createMockWallet(
        "svm",
        "solana-mainnet",
        undefined,
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      const res = await provider.scanToken(solWallet, {
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      });

      expect(JSON.parse(res)).toEqual(mockScan);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.nullclear.dev/v1/scan/solana/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
    });
  });

  describe("inspectContract", () => {
    it("should return friendly error when called on a Solana wallet without an EVM chain override", async () => {
      const provider = nullclearActionProvider();
      const solWallet = createMockWallet("svm", "solana-mainnet");
      const res = await provider.inspectContract(solWallet, {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      });

      expect(res).toContain("supports EVM chains");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should call GET /v1/inspect/:chain/:address on Arbitrum", async () => {
      const mockInspect = { proxyType: "EIP-1967", recommendedAgentAction: "EXECUTE_SAFE" };
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockInspect),
      });

      const provider = nullclearActionProvider();
      const arbWallet = createMockWallet("evm", "arbitrum-mainnet", "42161");
      const res = await provider.inspectContract(arbWallet, {
        address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      });

      expect(JSON.parse(res)).toEqual(mockInspect);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.nullclear.dev/v1/inspect/arbitrum/0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      );
    });
  });

  describe("decodeCalldata and simulateTx", () => {
    it("should post to /v1/decode and /v1/simulate", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true }),
      });

      const provider = nullclearActionProvider();
      const wallet = createMockWallet("evm", "ethereum-mainnet", "1");

      await provider.decodeCalldata(wallet, { input: "0xa9059cbb" });
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.nullclear.dev/v1/decode");
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        input: "0xa9059cbb",
        chain: "eth",
      });

      await provider.simulateTx(wallet, {
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        data: "0xa9059cbb",
      });
      expect(fetchMock.mock.calls[1][0]).toBe("https://api.nullclear.dev/v1/simulate");
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
        chain: "eth",
        from: "0x1234567890123456789012345678901234567890",
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      });
    });
  });

  describe("buildNullClearGuardedRpcUrl", () => {
    it("should construct a Guarded JSON-RPC URL with query options", () => {
      const url = buildNullClearGuardedRpcUrl({
        chain: "base",
        apiKey: "nc_live_abc",
        failMode: "open",
        timeoutMs: 800,
      });
      expect(url).toBe(
        "https://api.nullclear.dev/rpc/base/nc_live_abc?failMode=open&timeoutMs=800",
      );
    });
  });
});
