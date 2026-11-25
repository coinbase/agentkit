import { TolcaActionProvider, tolcaActionProvider } from "./tolcaActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("@x402/svm/exact/client");

const mockFetch = jest.fn();
const mockPaidFetch = jest.fn();
const mockX402Client = { registerScheme: jest.fn() };

jest
  .mocked(x402Client)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockPaidFetch);
jest
  .mocked(registerExactEvmScheme)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);
jest
  .mocked(registerExactSvmScheme)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);

global.fetch = mockFetch;

const TOLCA_BASE_PAY_TO = "0x35F0B86a7E33F561faf7cfa5654CAd9162C4A17d";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const makeWallet = (networkId = "base-mainnet") => {
  const wallet = Object.create(EvmWalletProvider.prototype);
  wallet.toSigner = jest.fn().mockReturnValue({ address: "0x1234" });
  wallet.readContract = jest.fn();
  wallet.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId });
  return wallet as EvmWalletProvider;
};

const jsonResponse = (status: number, data: unknown, headers: Record<string, string> = {}) =>
  ({
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    json: jest.fn().mockResolvedValue(data),
  }) as unknown as Response;

const paymentRequired = (accepts: Array<Record<string, string>>) =>
  jsonResponse(
    402,
    {},
    {
      "payment-required": Buffer.from(JSON.stringify({ x402Version: 2, accepts })).toString(
        "base64",
      ),
    },
  );

const tolcaAccepts = (amount = "10000") => [
  {
    scheme: "exact",
    network: "eip155:8453",
    amount,
    asset: BASE_USDC,
    payTo: TOLCA_BASE_PAY_TO,
  },
];

describe("TolcaActionProvider", () => {
  let provider: TolcaActionProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(wrapFetchWithPayment).mockReturnValue(mockPaidFetch);
    provider = tolcaActionProvider();
  });

  describe("supportsNetwork", () => {
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

  describe("check_x402_seller", () => {
    it("asks for a url or a payment request", async () => {
      const result = JSON.parse(
        await provider.checkX402Seller(makeWallet(), {
          url: null,
          paymentRequired: null,
          sellerName: null,
        }),
      );
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("checks the 402 terms, pays Tolca and returns the verdict", async () => {
      mockFetch.mockResolvedValueOnce(paymentRequired(tolcaAccepts()));
      mockPaidFetch.mockResolvedValueOnce(
        jsonResponse(200, { action: "allow", risk_score: 5, reasons: [] }),
      );

      const result = JSON.parse(
        await provider.checkX402Seller(makeWallet(), {
          url: "https://seller.example/api",
          paymentRequired: null,
          sellerName: "Acme Data Inc.",
        }),
      );

      expect(result.success).toBe(true);
      expect(result.verdict).toBe("allow");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://tolca.tonbot.ca/v1/payment-check",
        expect.objectContaining({ method: "POST" }),
      );
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody).toEqual({
        url: "https://seller.example/api",
        seller_name: "Acme Data Inc.",
      });
      expect(wrapFetchWithPayment).toHaveBeenCalledWith(fetch, mockX402Client);
      expect(mockPaidFetch).toHaveBeenCalledTimes(1);
    });

    it("sends the payment request when one is given", async () => {
      mockFetch.mockResolvedValueOnce(paymentRequired(tolcaAccepts()));
      mockPaidFetch.mockResolvedValueOnce(jsonResponse(200, { action: "block" }));
      const seller402 = { x402Version: 2, accepts: [{ payTo: "0xabc" }] };

      const result = JSON.parse(
        await provider.checkX402Seller(makeWallet(), {
          url: null,
          paymentRequired: seller402,
          sellerName: null,
        }),
      );

      expect(result.verdict).toBe("block");
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ payment_required: seller402 });
    });

    it("refuses to pay a wallet that is not Tolca's", async () => {
      mockFetch.mockResolvedValueOnce(
        paymentRequired([
          { ...tolcaAccepts()[0], payTo: "0x0000000000000000000000000000000000000bad" },
        ]),
      );

      const result = JSON.parse(
        await provider.checkX402Seller(makeWallet(), {
          url: "https://seller.example/api",
          paymentRequired: null,
          sellerName: null,
        }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("nothing was paid");
      expect(mockPaidFetch).not.toHaveBeenCalled();
    });

    it("refuses to pay above the price cap", async () => {
      mockFetch.mockResolvedValueOnce(paymentRequired(tolcaAccepts("50000")));

      const result = JSON.parse(
        await provider.checkX402Seller(makeWallet(), {
          url: "https://seller.example/api",
          paymentRequired: null,
          sellerName: null,
        }),
      );

      expect(result.success).toBe(false);
      expect(mockPaidFetch).not.toHaveBeenCalled();
    });

    it("refuses an asset that is not the official USDC", async () => {
      mockFetch.mockResolvedValueOnce(
        paymentRequired([
          { ...tolcaAccepts()[0], asset: "0x1111111111111111111111111111111111111111" },
        ]),
      );

      const result = JSON.parse(
        await provider.checkX402Seller(makeWallet(), {
          url: "https://seller.example/api",
          paymentRequired: null,
          sellerName: null,
        }),
      );

      expect(result.success).toBe(false);
      expect(mockPaidFetch).not.toHaveBeenCalled();
    });

    it("returns Tolca's error without paying when it does not answer 402", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(400, { error: "url or payment_required" }));

      const result = JSON.parse(
        await provider.checkX402Seller(makeWallet(), {
          url: "https://seller.example/api",
          paymentRequired: null,
          sellerName: null,
        }),
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(mockPaidFetch).not.toHaveBeenCalled();
    });
  });

  describe("screen_sanctions", () => {
    it("screens a name and returns the verdict", async () => {
      mockFetch.mockResolvedValueOnce(paymentRequired(tolcaAccepts("5000")));
      mockPaidFetch.mockResolvedValueOnce(
        jsonResponse(200, { action: "block", risk_score: 95, matches: [{ list: "SDN" }] }),
      );

      const result = JSON.parse(
        await provider.screenSanctions(makeWallet(), { name: "Example Sanctioned Co." }),
      );

      expect(result.success).toBe(true);
      expect(result.verdict).toBe("block");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://tolca.tonbot.ca/v1/sanctions-check",
        expect.objectContaining({ method: "POST" }),
      );
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
        name: "Example Sanctioned Co.",
      });
    });
  });
});
