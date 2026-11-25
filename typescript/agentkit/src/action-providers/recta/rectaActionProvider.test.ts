import { rectaActionProvider, RectaActionProvider } from "./rectaActionProvider";
import { RectaCompareRouteSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

const SENDER = "0x1234567890123456789012345678901234567890";

const TEMPLATE = {
  schema: "RECTA_REQUEST_TEMPLATE_V1",
  covered: true,
  body: {
    schema: "RECTA_COMMERCIAL_ECONOMIC_REQUEST_V1",
    source_network: "ethereum",
    source_asset: "USDC",
    destination_network: "base",
    destination_asset: "USDC",
    amount: "6000",
    constraints: { guarantee_class: "ANY", latency_class: "ANY", destination_execution: "NONE" },
    sender: "<YOUR_SENDER>",
    recipient: "<RECIPIENT>",
    baseline_provider: "stargate_v2",
    execution_authority: {
      headroom: "0.2",
      source_max_fee_per_gas_wei: "<MAX_FEE_PER_GAS_WEI>",
      source_max_priority_fee_per_gas_wei: "<MAX_PRIORITY_FEE_PER_GAS_WEI>",
    },
  },
};

const TRIAL = { status: "TRIAL", outcome: "SAVING_FOUND", saving_usdc: "2.39903" };

/**
 * A fetch response.
 *
 * @param body - The JSON body.
 * @param status - The HTTP status.
 * @returns The response.
 */
function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

describe("RectaActionProvider", () => {
  let provider: RectaActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    provider = rectaActionProvider();
    wallet = {
      getAddress: jest.fn().mockReturnValue(SENDER),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "ethereum-mainnet", chainId: "1" }),
      getPublicClient: jest.fn().mockReturnValue({
        estimateFeesPerGas: jest.fn().mockResolvedValue({ maxFeePerGas: 20_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n }),
      }),
      sendTransaction: jest.fn(),
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("supportsNetwork", () => {
    it("supports EVM networks a Recta route can start from", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "42161" })).toBe(true);
    });

    it("does not support other networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "84532" })).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(false);
    });
  });

  describe("schema", () => {
    it("refuses an amount that is not a decimal number", () => {
      const parsed = RectaCompareRouteSchema.safeParse({
        destinationNetwork: "base",
        asset: null,
        amount: "6e3",
        baselineProvider: "stargate_v2",
        recipient: null,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("checkRouteCoverage", () => {
    it("reads the corridor from the wallet's network", async () => {
      fetchMock.mockResolvedValue(json({ covered: true }));
      const result = await provider.checkRouteCoverage(wallet, { destinationNetwork: "base", asset: "USDC" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.recta.build/v1/golden-corridor/fit?source_network=ethereum&source_asset=USDC&destination_network=base&destination_asset=USDC",
        expect.anything(),
      );
      expect(JSON.parse(result)).toEqual({ covered: true });
    });

    it("refuses a wallet on a chain Recta does not serve", async () => {
      wallet.getNetwork.mockReturnValue({ protocolFamily: "evm", chainId: "84532" });
      const result = await provider.checkRouteCoverage(wallet, { destinationNetwork: "base", asset: "USDC" });
      expect(result).toContain("cannot start on chain 84532");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("compareBridgeRoute", () => {
    const args = {
      destinationNetwork: "base",
      asset: "USDC",
      amount: "6000",
      baselineProvider: "stargate_v2" as const,
      recipient: null,
    };

    it("fills the template with the wallet's address and fees, and never signs or sends", async () => {
      fetchMock.mockResolvedValueOnce(json(TEMPLATE)).mockResolvedValueOnce(json(TRIAL));
      const result = await provider.compareBridgeRoute(wallet, args);

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.recta.build/v1/golden-corridor/request-template?source_network=ethereum&source_asset=USDC&destination_network=base&destination_asset=USDC&amount=6000&baseline_provider=stargate_v2",
      );
      const [url, init] = fetchMock.mock.calls[1];
      expect(url).toBe("https://api.recta.build/v1/golden-corridor/trial-evaluation");
      expect(init.method).toBe("POST");
      const sent = JSON.parse(init.body);
      expect(sent.sender).toBe(SENDER);
      expect(sent.recipient).toBe(SENDER);
      expect(sent.execution_authority).toEqual({
        headroom: "0.2",
        source_max_fee_per_gas_wei: "20000000000",
        source_max_priority_fee_per_gas_wei: "2000000000",
      });
      expect(JSON.parse(result)).toEqual(TRIAL);
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
      expect(wallet.signMessage).not.toHaveBeenCalled();
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("uses the given recipient", async () => {
      const recipient = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      fetchMock.mockResolvedValueOnce(json(TEMPLATE)).mockResolvedValueOnce(json(TRIAL));
      await provider.compareBridgeRoute(wallet, { ...args, recipient });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).recipient).toBe(recipient);
    });

    it("stops when Recta does not cover the transfer", async () => {
      fetchMock.mockResolvedValueOnce(json({ covered: false, reason: "UNSERVED_CORRIDOR" }));
      const result = await provider.compareBridgeRoute(wallet, args);
      expect(result).toContain("Recta does not cover this transfer");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("returns Recta's refusal as it came", async () => {
      fetchMock
        .mockResolvedValueOnce(json(TEMPLATE))
        .mockResolvedValueOnce(json({ status: "REFUSED", reason_code: "TRIAL_LIMIT_REACHED" }, 429));
      const result = await provider.compareBridgeRoute(wallet, args);
      expect(JSON.parse(result)).toEqual({ status: "REFUSED", reason_code: "TRIAL_LIMIT_REACHED" });
    });

    it("reports a network error", async () => {
      fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED"));
      const result = await provider.compareBridgeRoute(wallet, args);
      expect(result).toBe("Error comparing the route with Recta: connect ECONNREFUSED");
    });
  });
});
