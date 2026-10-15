import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { x402DoctorActionProvider, X402_DOCTOR_URL } from "./x402DoctorActionProvider";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("@x402/svm/exact/client");

const mockFetchWithPayment = jest.fn();
let registeredPolicy: ((version: number, reqs: unknown[]) => unknown[]) | undefined;
const mockClient = {
  registerPolicy: jest.fn((policy: typeof registeredPolicy) => {
    registeredPolicy = policy;
    return mockClient;
  }),
};
jest.mocked(x402Client).mockImplementation(() => mockClient as unknown as x402Client);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);

const makeWallet = (networkId: string) => {
  const wallet = Object.create(EvmWalletProvider.prototype);
  wallet.toSigner = jest.fn().mockReturnValue({ address: "0x1234" });
  wallet.readContract = jest.fn();
  wallet.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId });
  return wallet as EvmWalletProvider;
};

const PREFLIGHT_GO = {
  url: "https://api.example.com/data",
  method: "GET",
  verdict: "go",
  safe_to_pay: true,
  summary: "OK to pay: $0.02 on Base.",
  recommended_option: 0,
  options: [{ index: 0, network: "eip155:8453", usd: 0.02, payable: true, problems: [] }],
  signals: { https: true, listed_in_cdp_bazaar: true },
  reasons: [],
};

const receipt = btoa(
  JSON.stringify({ success: true, transaction: "0xabc", network: "eip155:8453" }),
);
const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

describe("X402DoctorActionProvider", () => {
  const provider = x402DoctorActionProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    registeredPolicy = undefined;
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet and Solana mainnet only", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(false);
    });
  });

  describe("preflight_x402_endpoint", () => {
    it("pays the preflight and returns the verdict, advice, option and receipt", async () => {
      mockFetchWithPayment.mockResolvedValue(
        jsonResponse(PREFLIGHT_GO, 200, { "payment-response": receipt }),
      );

      const result = JSON.parse(
        await provider.preflightX402Endpoint(makeWallet("base-mainnet"), {
          url: "https://api.example.com/data",
          method: "GET",
          maxUsd: 0.05,
        }),
      );

      const called = new URL(mockFetchWithPayment.mock.calls[0][0]);
      expect(called.origin + called.pathname).toBe(`${X402_DOCTOR_URL}/api/v1/preflight`);
      expect(Object.fromEntries(called.searchParams)).toEqual({
        url: "https://api.example.com/data",
        method: "GET",
        network: "eip155:8453",
        max_usd: "0.05",
      });
      expect(registerExactEvmScheme).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: true,
        verdict: "go",
        summary: "OK to pay: $0.02 on Base.",
        recommendedOption: { network: "eip155:8453", usd: 0.02 },
        paymentProof: { transaction: "0xabc" },
      });
      expect(result.advice).toMatch(/retry_http_request_with_x402/);
    });

    it("tells the agent not to pay on no_go and to ask on caution", async () => {
      mockFetchWithPayment.mockResolvedValueOnce(
        jsonResponse({
          ...PREFLIGHT_GO,
          verdict: "no_go",
          summary: "Do not pay: over budget",
          recommended_option: null,
        }),
      );
      const noGo = JSON.parse(
        await provider.preflightX402Endpoint(makeWallet("base-mainnet"), {
          url: "https://api.example.com/data",
        }),
      );
      expect(noGo.verdict).toBe("no_go");
      expect(noGo.advice).toMatch(/Do not pay/);
      expect(noGo.recommendedOption).toBeNull();

      mockFetchWithPayment.mockResolvedValueOnce(
        jsonResponse({ ...PREFLIGHT_GO, verdict: "caution" }),
      );
      const caution = JSON.parse(
        await provider.preflightX402Endpoint(makeWallet("base-mainnet"), {
          url: "https://api.example.com/data",
        }),
      );
      expect(caution.advice).toMatch(/confirm/);
    });

    it("defaults to GET and leaves out the budget when none is given", async () => {
      mockFetchWithPayment.mockResolvedValue(jsonResponse(PREFLIGHT_GO));
      await provider.preflightX402Endpoint(makeWallet("base-mainnet"), {
        url: "https://api.example.com/data",
      });
      const params = new URL(mockFetchWithPayment.mock.calls[0][0]).searchParams;
      expect(params.get("method")).toBe("GET");
      expect(params.has("max_usd")).toBe(false);
    });

    it("only pays on the wallet's network and never more than $0.002", async () => {
      mockFetchWithPayment.mockResolvedValue(jsonResponse(PREFLIGHT_GO));
      await provider.preflightX402Endpoint(makeWallet("base-mainnet"), {
        url: "https://api.example.com/data",
      });
      const allowed = registeredPolicy!(2, [
        { network: "eip155:8453", amount: "1000" },
        { network: "eip155:8453", amount: "5000" },
        { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", amount: "1000" },
      ]);
      expect(allowed).toEqual([{ network: "eip155:8453", amount: "1000" }]);
    });

    it("returns an error without paying on an unsupported network", async () => {
      const result = JSON.parse(
        await provider.preflightX402Endpoint(makeWallet("base-sepolia"), {
          url: "https://api.example.com/data",
        }),
      );
      expect(result).toMatchObject({ error: true, message: "Unsupported network" });
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("returns an error for a wallet provider that cannot pay", async () => {
      const wallet = {
        getNetwork: () => ({ protocolFamily: "evm", networkId: "base-mainnet" }),
      } as unknown as WalletProvider;
      const result = JSON.parse(
        await provider.preflightX402Endpoint(wallet, { url: "https://api.example.com/data" }),
      );
      expect(result.message).toBe("Unsupported wallet provider");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("reports a failed preflight as no verdict", async () => {
      mockFetchWithPayment.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 502));
      const failed = JSON.parse(
        await provider.preflightX402Endpoint(makeWallet("base-mainnet"), {
          url: "https://api.example.com/data",
        }),
      );
      expect(failed).toMatchObject({ error: true, message: "Preflight failed with status 502" });

      mockFetchWithPayment.mockRejectedValueOnce(new Error("network down"));
      const thrown = JSON.parse(
        await provider.preflightX402Endpoint(makeWallet("base-mainnet"), {
          url: "https://api.example.com/data",
        }),
      );
      expect(thrown).toMatchObject({ error: true, details: "network down" });
    });

    it("uses a custom Doctor URL", async () => {
      mockFetchWithPayment.mockResolvedValue(jsonResponse(PREFLIGHT_GO));
      await x402DoctorActionProvider({ doctorUrl: "https://doctor.test/" }).preflightX402Endpoint(
        makeWallet("base-mainnet"),
        { url: "https://api.example.com/data" },
      );
      expect(mockFetchWithPayment.mock.calls[0][0]).toMatch(
        /^https:\/\/doctor\.test\/api\/v1\/preflight\?/,
      );
    });
  });
});
