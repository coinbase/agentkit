import { TokenSafetyActionProvider, priceFromPaymentRequired } from "./tokenSafetyActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockFetch = jest.fn();
const mockFetchWithPayment = jest.fn();

jest
  .mocked(x402Client)
  .mockImplementation(() => ({}) as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest.mocked(registerExactEvmScheme).mockImplementation(() => ({}) as never);

global.fetch = mockFetch;

const makeMockWalletProvider = () => {
  const provider = Object.create(EvmWalletProvider.prototype);
  provider.toSigner = jest
    .fn()
    .mockReturnValue({ address: "0x1234567890123456789012345678901234567890" });
  provider.readContract = jest.fn();
  provider.getNetwork = jest
    .fn()
    .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" });
  return provider as EvmWalletProvider;
};

// A 402 challenge priced at `atomic` USDC units (10000 = $0.01).
const challenge = (atomic: string) =>
  new Response(JSON.stringify({}), {
    status: 402,
    headers: {
      "payment-required": btoa(
        JSON.stringify({
          x402Version: 2,
          accepts: [{ scheme: "exact", network: "eip155:8453", amount: atomic }],
        }),
      ),
    },
  });

const RESULT = {
  address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  chain: "base",
  name: "Degen",
  symbol: "DEGEN",
  risk: {
    score: 15,
    level: "low",
    reasons: [{ code: "can-pause", points: 10, text: "The owner can pause all transfers." }],
    summary: "Low risk: the owner can pause all transfers.",
  },
  watch: { fingerprint: "eyJzIjoxNX0", changes: null },
};

describe("TokenSafetyActionProvider", () => {
  let provider: TokenSafetyActionProvider;
  let wallet: EvmWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new TokenSafetyActionProvider();
    wallet = makeMockWalletProvider();
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet, where the check is paid", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as Network),
      ).toBe(true);
    });

    it("does not support other networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" } as Network),
      ).toBe(false);
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" } as Network),
      ).toBe(false);
    });
  });

  describe("checkTokenSafety", () => {
    it("pays for the check and returns the risk report", async () => {
      mockFetch.mockResolvedValueOnce(challenge("10000"));
      mockFetchWithPayment.mockResolvedValueOnce(
        new Response(JSON.stringify(RESULT), { status: 200 }),
      );

      const result = JSON.parse(
        await provider.checkTokenSafety(wallet, { address: RESULT.address, chain: "base" }),
      );

      expect(result.risk.score).toBe(15);
      expect(result.watch.fingerprint).toBe("eyJzIjoxNX0");
      expect(registerExactEvmScheme).toHaveBeenCalled();
      const paidUrl = new URL(mockFetchWithPayment.mock.calls[0][0]);
      expect(paidUrl.searchParams.get("address")).toBe(RESULT.address);
      expect(paidUrl.searchParams.get("chain")).toBe("base");
    });

    it("passes since to get what changed", async () => {
      mockFetch.mockResolvedValueOnce(challenge("10000"));
      mockFetchWithPayment.mockResolvedValueOnce(
        new Response(JSON.stringify(RESULT), { status: 200 }),
      );

      await provider.checkTokenSafety(wallet, { address: RESULT.address, since: "eyJzIjoxNX0" });

      const paidUrl = new URL(mockFetchWithPayment.mock.calls[0][0]);
      expect(paidUrl.searchParams.get("since")).toBe("eyJzIjoxNX0");
      expect(paidUrl.searchParams.has("chain")).toBe(false);
    });

    it("refuses to pay above the spending cap", async () => {
      mockFetch.mockResolvedValueOnce(challenge("100000")); // $0.10

      const result = JSON.parse(
        await provider.checkTokenSafety(wallet, { address: RESULT.address }),
      );

      expect(result.error).toBe(true);
      expect(result.message).toBe("Payment exceeds limit");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("honours a custom spending cap", async () => {
      provider = new TokenSafetyActionProvider({ maxPaymentUsdc: 0.005 });
      mockFetch.mockResolvedValueOnce(challenge("10000"));

      const result = JSON.parse(
        await provider.checkTokenSafety(wallet, { address: RESULT.address }),
      );

      expect(result.message).toBe("Payment exceeds limit");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("returns the endpoint's error message for invalid input", async () => {
      mockFetch.mockResolvedValueOnce(challenge("10000"));
      mockFetchWithPayment.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "address must be a 0x-prefixed 20-byte hex address" }),
          { status: 400 },
        ),
      );

      const result = JSON.parse(
        await provider.checkTokenSafety(wallet, { address: "not-an-address" }),
      );

      expect(result.error).toBe(true);
      expect(result.message).toBe("address must be a 0x-prefixed 20-byte hex address");
    });

    it("returns an error when the price can't be read", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 402 }));

      const result = JSON.parse(
        await provider.checkTokenSafety(wallet, { address: RESULT.address }),
      );

      expect(result.error).toBe(true);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("returns an error when the request throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network down"));

      const result = JSON.parse(
        await provider.checkTokenSafety(wallet, { address: RESULT.address }),
      );

      expect(result.error).toBe(true);
      expect(result.message).toContain("network down");
    });
  });

  describe("priceFromPaymentRequired", () => {
    it("reads the amount in USDC", () => {
      expect(priceFromPaymentRequired(challenge("10000"))).toBe(0.01);
    });

    it("returns null without a readable header", () => {
      expect(priceFromPaymentRequired(new Response("{}", { status: 402 }))).toBeNull();
      expect(
        priceFromPaymentRequired(
          new Response("{}", { status: 402, headers: { "payment-required": "%%%" } }),
        ),
      ).toBeNull();
    });
  });
});
