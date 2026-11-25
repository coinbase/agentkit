import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { tokenVerdictActionProvider } from "./tokenVerdictActionProvider";
import { isTradeAllowed, validateTokenVerdictPayment } from "./utils";
import { TOKEN_VERDICT_PAY_TO } from "./constants";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockFetch = jest.fn();
const mockFetchWithPayment = jest.fn();
global.fetch = mockFetch;

jest
  .mocked(x402Client)
  .mockImplementation(() => ({}) as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest
  .mocked(registerExactEvmScheme)
  .mockImplementation(() => ({}) as unknown as InstanceType<typeof x402Client>);

const USDC_ON_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const makeWalletProvider = () => {
  const wp = Object.create(EvmWalletProvider.prototype);
  wp.toSigner = jest
    .fn()
    .mockReturnValue({ address: "0x0000000000000000000000000000000000000001" });
  wp.readContract = jest.fn();
  wp.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" });
  return wp as EvmWalletProvider;
};

const paymentRequiredHeader = (overrides: Record<string, string> = {}) =>
  Buffer.from(
    JSON.stringify({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "20000",
          asset: USDC_ON_BASE,
          payTo: TOKEN_VERDICT_PAY_TO,
          ...overrides,
        },
      ],
    }),
  ).toString("base64");

const mock402 = (header: string) => ({
  status: 402,
  ok: false,
  headers: { get: (name: string) => (name === "payment-required" ? header : null) },
  json: jest.fn(),
});

const mockCardResponse = (card: Record<string, unknown>) => ({
  status: 200,
  ok: true,
  headers: { get: () => null },
  json: jest.fn().mockResolvedValue(card),
});

describe("TokenVerdictActionProvider", () => {
  const provider = tokenVerdictActionProvider();
  const walletProvider = makeWalletProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  describe("supportsNetwork", () => {
    it("supports base-mainnet only", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as Network),
      ).toBe(true);
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" } as Network),
      ).toBe(false);
      expect(
        provider.supportsNetwork({
          protocolFamily: "svm",
          networkId: "solana-mainnet",
        } as unknown as Network),
      ).toBe(false);
    });
  });

  describe("gate rule (isTradeAllowed)", () => {
    it("allows clean and caution, blocks everything else", () => {
      expect(isTradeAllowed({ verdict: "clean" })).toBe(true);
      expect(isTradeAllowed({ verdict: "caution" })).toBe(true);
      expect(isTradeAllowed({ verdict: "rug_risk" })).toBe(false);
      expect(isTradeAllowed({ verdict: "exit_trap" })).toBe(false);
      expect(isTradeAllowed({ verdict: "unknown" })).toBe(false);
      expect(isTradeAllowed(null)).toBe(false);
      expect(isTradeAllowed(undefined)).toBe(false);
    });
  });

  describe("payment validation", () => {
    const good = [
      { scheme: "exact", network: "eip155:8453", amount: "20000", payTo: TOKEN_VERDICT_PAY_TO },
    ];
    it("accepts the expected $0.02 Base ask", () => {
      expect(validateTokenVerdictPayment(good)).toBeNull();
    });
    it("rejects a higher price, a wrong network, and a wrong recipient", () => {
      expect(validateTokenVerdictPayment([{ ...good[0], amount: "30000" }])).toContain("exceeds");
      expect(validateTokenVerdictPayment([{ ...good[0], network: "eip155:1" }])).toContain(
        "network",
      );
      expect(
        validateTokenVerdictPayment([
          { ...good[0], payTo: "0x0000000000000000000000000000000000000002" },
        ]),
      ).toContain("recipient");
      expect(validateTokenVerdictPayment([])).not.toBeNull();
      expect(validateTokenVerdictPayment(undefined)).not.toBeNull();
    });
  });

  describe("checkToken", () => {
    it("returns allowed:true for a clean verdict", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader()));
      mockFetchWithPayment.mockResolvedValueOnce(
        mockCardResponse({ verdict: "clean", score: 88, reasons: [], facts: {} }),
      );
      const result = JSON.parse(
        await provider.checkToken(walletProvider, { tokenAddress: USDC_ON_BASE }),
      );
      expect(result.success).toBe(true);
      expect(result.allowed).toBe(true);
      expect(result.card.verdict).toBe("clean");
      // Paid call went to the constant endpoint with the documented body.
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        "https://crypto-intel-agent.vercel.app/api/token-verdict",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ address: USDC_ON_BASE, chain: "base" }),
        }),
      );
    });

    it("returns allowed:false for rug_risk and exit_trap", async () => {
      for (const verdict of ["rug_risk", "exit_trap"]) {
        mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader()));
        mockFetchWithPayment.mockResolvedValueOnce(
          mockCardResponse({ verdict, score: 5, reasons: [], facts: {} }),
        );
        const result = JSON.parse(
          await provider.checkToken(walletProvider, { tokenAddress: USDC_ON_BASE }),
        );
        expect(result.allowed).toBe(false);
      }
    });

    it("refuses to pay when the 402 asks for more than $0.02", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader({ amount: "999999" })));
      const result = JSON.parse(
        await provider.checkToken(walletProvider, { tokenAddress: USDC_ON_BASE }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Refusing to pay");
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("refuses to pay a different recipient", async () => {
      mockFetch.mockResolvedValueOnce(
        mock402(paymentRequiredHeader({ payTo: "0x0000000000000000000000000000000000000002" })),
      );
      const result = JSON.parse(
        await provider.checkToken(walletProvider, { tokenAddress: USDC_ON_BASE }),
      );
      expect(result.success).toBe(false);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("reports a 502 as an uncharged failure", async () => {
      mockFetch.mockResolvedValueOnce(mock402(paymentRequiredHeader()));
      mockFetchWithPayment.mockResolvedValueOnce({
        status: 502,
        ok: false,
        headers: { get: () => null },
        json: jest.fn(),
      });
      const result = JSON.parse(
        await provider.checkToken(walletProvider, { tokenAddress: USDC_ON_BASE }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("502");
    });

    it("reports a non-402 preflight failure without paying", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        headers: { get: () => null },
        json: jest.fn(),
      });
      const result = JSON.parse(
        await provider.checkToken(walletProvider, { tokenAddress: USDC_ON_BASE }),
      );
      expect(result.success).toBe(false);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });
  });
});
