import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider } from "../../wallet-providers";
import { TOKEN_ADDRESSES_BY_SYMBOLS } from "../erc20/constants";
import { stablecoinGatewaysActionProvider } from "./stablecoinGatewaysActionProvider";
import { CounterpartyCheckSchema, MerchantCheckSchema, ScreenCryptoAddressSchema } from "./schemas";

jest.mock("../../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const USDC_MAINNET = TOKEN_ADDRESSES_BY_SYMBOLS["base-mainnet"].USDC;
const USDC_SEPOLIA = TOKEN_ADDRESSES_BY_SYMBOLS["base-sepolia"].USDC;
const VALID_ADDRESS = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";
const PAYMENT_TX_HASH = "0xcbc385789d3744b52af5106c32809534f64adcbe097e050ec03d6b53fed5d305";

const mockFetchWithPayment = jest.fn();
const mockRegisterPolicy = jest.fn();
const mockClient = { registerPolicy: mockRegisterPolicy };

jest
  .mocked(x402Client)
  .mockImplementation(() => mockClient as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest
  .mocked(registerExactEvmScheme)
  .mockImplementation(client => client as unknown as InstanceType<typeof x402Client>);

const paymentHeader = (payload: unknown): string =>
  Buffer.from(JSON.stringify(payload)).toString("base64");

const createMockResponse = (options: {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}): Response => {
  const headersMap = new Map(
    Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const raw = options.data === undefined ? "" : JSON.stringify(options.data);
  return {
    status: options.status,
    ok: options.status >= 200 && options.status < 300,
    headers: {
      get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
    },
    text: jest.fn().mockResolvedValue(raw),
  } as unknown as Response;
};

/**
 * A 402 quote. The live API offers USDC and XRP together; tests do the same.
 *
 * @param accepts - Payment options.
 * @returns A mock 402 response with a PAYMENT-REQUIRED header.
 */
function quoteResponse(
  accepts: Array<{ network: string; asset: string; amount: string }>,
): Response {
  return createMockResponse({
    status: 402,
    data: { ignored: true },
    headers: {
      "content-type": "application/json",
      "payment-required": paymentHeader({
        x402Version: 2,
        accepts: accepts.map(option => ({
          scheme: "exact",
          network: option.network,
          asset: option.asset,
          amount: option.amount,
          payTo: "0x39BF4378b74f9E19c5113b00b01f57d94537bad1",
          maxTimeoutSeconds: 600,
          extra: { name: "USDC", version: "2" },
        })),
      }),
    },
  });
}

/**
 * Wallet on Base. `instanceof EvmWalletProvider` must hold so the USDC address lookup runs.
 *
 * @param networkId - base-mainnet or base-sepolia.
 * @returns A mock wallet.
 */
function makeWallet(networkId: "base-mainnet" | "base-sepolia"): EvmWalletProvider {
  const wallet = Object.create(EvmWalletProvider.prototype) as EvmWalletProvider & {
    toSigner: jest.Mock;
  };
  wallet.getAddress = jest.fn().mockReturnValue("0x1111111111111111111111111111111111111111");
  wallet.getName = jest.fn().mockReturnValue("evm_wallet_provider");
  wallet.getNetwork = jest.fn().mockReturnValue({
    protocolFamily: "evm",
    networkId,
    chainId: networkId === "base-mainnet" ? "8453" : "84532",
  });
  wallet.toSigner = jest.fn().mockReturnValue({
    address: "0x1111111111111111111111111111111111111111",
    signTypedData: jest.fn(),
  });
  wallet.readContract = jest.fn();
  return wallet;
}

describe("StablecoinGatewaysActionProvider", () => {
  let fetchSpy: jest.SpyInstance;
  const sepoliaWallet = makeWallet("base-sepolia");

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterPolicy.mockReturnThis();
    jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
    jest
      .mocked(x402Client)
      .mockImplementation(() => mockClient as unknown as InstanceType<typeof x402Client>);
    jest
      .mocked(registerExactEvmScheme)
      .mockImplementation(client => client as unknown as InstanceType<typeof x402Client>);
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("supportsNetwork", () => {
    const provider = stablecoinGatewaysActionProvider();

    it("supports Base mainnet and Base Sepolia", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        true,
      );
    });

    it("rejects other EVM networks, non-EVM networks, and a missing network id", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "base-mainnet" })).toBe(
        false,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(false);
    });
  });

  describe("constructor", () => {
    it("rejects a negative cap and a non-URL base", () => {
      expect(() => stablecoinGatewaysActionProvider({ maxPaymentUsdc: -1 })).toThrow(
        /maxPaymentUsdc/,
      );
      expect(() => stablecoinGatewaysActionProvider({ baseUrl: "not a url" })).toThrow(/baseUrl/);
    });
  });

  describe("actions", () => {
    const provider = stablecoinGatewaysActionProvider();

    it("describes every action as neutral facts and does not screen individuals", () => {
      const actions = provider.getActions(sepoliaWallet);
      const names = actions.map(action => action.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "StablecoinGatewaysActionProvider_screen_crypto_address",
          "StablecoinGatewaysActionProvider_counterparty_check",
          "StablecoinGatewaysActionProvider_merchant_check",
        ]),
      );
      expect(actions).toHaveLength(3);
      for (const action of actions) {
        expect(action.description).toContain(
          "Results are neutral sourced facts, not a compliance determination; individuals are not screened.",
        );
      }
    });
  });

  describe("paid GET", () => {
    const provider = stablecoinGatewaysActionProvider();

    /**
     * Arms the unpaid quote and the paid 200 that follows it.
     *
     * @param accepts - Quote options.
     * @param data - JSON body returned after payment.
     */
    function mockPayThenSucceed(
      accepts: Array<{ network: string; asset: string; amount: string }>,
      data: unknown,
    ): void {
      fetchSpy.mockResolvedValue(quoteResponse(accepts));
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse({
          status: 200,
          data,
          headers: {
            "content-type": "application/json",
            "payment-response": paymentHeader({
              success: true,
              transaction: PAYMENT_TX_HASH,
              network: "eip155:84532",
              payer: "0xa8c1a5D3C372C65c04f91f87a43F549619A9483f",
            }),
          },
        }),
      );
    }

    it("pays a USDC quote and returns the JSON body plus the payment tx hash", async () => {
      const body = { data: { listed: false }, receipt: { v: 1 } };
      mockPayThenSucceed(
        [
          { network: "eip155:84532", asset: USDC_SEPOLIA, amount: "2000" },
          { network: "xrpl:1", asset: "XRP", amount: "1573" },
        ],
        body,
      );

      const result = await provider.screenCryptoAddress(sepoliaWallet, { address: VALID_ADDRESS });
      const parsed = JSON.parse(result);

      const quoteUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(quoteUrl.origin).toBe("https://api.stablecoingateways.com");
      expect(quoteUrl.pathname).toBe("/v1/sanctions/address");
      expect(quoteUrl.searchParams.get("address")).toBe(VALID_ADDRESS);
      expect(fetchSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "GET" }));

      expect(sepoliaWallet.toSigner).toHaveBeenCalled();
      expect(registerExactEvmScheme).toHaveBeenCalled();
      expect(wrapFetchWithPayment).toHaveBeenCalledWith(fetch, mockClient);
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        quoteUrl.toString(),
        expect.objectContaining({ method: "GET" }),
      );

      const policy = mockRegisterPolicy.mock.calls[0][0] as (
        version: number,
        requirements: Array<{
          scheme: string;
          network: string;
          asset: string;
          amount: string;
          payTo: string;
          maxTimeoutSeconds: number;
          extra: Record<string, unknown>;
        }>,
      ) => unknown[];
      const allowed = policy(2, [
        {
          scheme: "exact",
          network: "eip155:84532",
          asset: USDC_SEPOLIA,
          amount: "2000",
          payTo: "0x0",
          maxTimeoutSeconds: 60,
          extra: {},
        },
        {
          scheme: "exact",
          network: "eip155:84532",
          asset: "0x000000000000000000000000000000000000dead",
          amount: "1",
          payTo: "0x0",
          maxTimeoutSeconds: 60,
          extra: {},
        },
        {
          scheme: "exact",
          network: "eip155:8453",
          asset: USDC_MAINNET,
          amount: "2000",
          payTo: "0x0",
          maxTimeoutSeconds: 60,
          extra: {},
        },
        {
          scheme: "exact",
          network: "eip155:84532",
          asset: USDC_SEPOLIA,
          amount: "1000000",
          payTo: "0x0",
          maxTimeoutSeconds: 60,
          extra: {},
        },
      ]);
      expect(allowed).toHaveLength(1);
      expect(allowed[0]).toEqual(expect.objectContaining({ amount: "2000", asset: USDC_SEPOLIA }));

      expect(parsed).toEqual({ success: true, data: body, paymentTxHash: PAYMENT_TX_HASH });
    });

    it("sends only the provided counterparty query params", async () => {
      mockPayThenSucceed([{ network: "eip155:84532", asset: USDC_SEPOLIA, amount: "10000" }], {
        data: { notice: "facts" },
      });

      await provider.counterpartyCheck(sepoliaWallet, {
        name: "Siemens AG",
        vat: "DE129274202",
      });

      const quoteUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(quoteUrl.pathname).toBe("/v1/counterparty-check");
      expect(quoteUrl.searchParams.get("name")).toBe("Siemens AG");
      expect(quoteUrl.searchParams.get("vat")).toBe("DE129274202");
      expect(quoteUrl.searchParams.has("domain")).toBe(false);
      expect(quoteUrl.searchParams.has("lei")).toBe(false);
      expect(quoteUrl.searchParams.has("address")).toBe(false);
    });

    it("uses a configured base URL for merchant_check", async () => {
      const custom = stablecoinGatewaysActionProvider({ baseUrl: "https://gateways.test/" });
      mockPayThenSucceed([{ network: "eip155:84532", asset: USDC_SEPOLIA, amount: "10000" }], {
        data: { domain: "apple.com" },
      });

      const result = await custom.merchantCheck(sepoliaWallet, {
        domain: "apple.com",
        name: "Apple Inc.",
        ticker: "AAPL",
      });

      const quoteUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(quoteUrl.origin).toBe("https://gateways.test");
      expect(quoteUrl.pathname).toBe("/v1/merchant-check");
      expect(quoteUrl.searchParams.get("domain")).toBe("apple.com");
      expect(quoteUrl.searchParams.get("ticker")).toBe("AAPL");
      expect(JSON.parse(result).paymentTxHash).toBe(PAYMENT_TX_HASH);
    });

    it("refuses a price above maxPaymentUsdc without signing", async () => {
      fetchSpy.mockResolvedValue(
        quoteResponse([
          { network: "eip155:84532", asset: USDC_SEPOLIA, amount: "1000000" },
          { network: "xrpl:1", asset: "XRP", amount: "1" },
        ]),
      );

      const result = await provider.screenCryptoAddress(sepoliaWallet, { address: VALID_ADDRESS });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Payment exceeds limit");
      expect(parsed.details).toContain("1");
      expect(parsed.details).toContain("0.05");
      expect(parsed.maxPaymentUsdc).toBe(0.05);
      expect(sepoliaWallet.toSigner).not.toHaveBeenCalled();
      expect(registerExactEvmScheme).not.toHaveBeenCalled();
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("refuses a mainnet USDC quote above the cap even when Sepolia USDC is cheaper", async () => {
      const mainnetWallet = makeWallet("base-mainnet");
      fetchSpy.mockResolvedValue(
        quoteResponse([
          { network: "eip155:8453", asset: USDC_MAINNET, amount: "1000000" },
          { network: "eip155:84532", asset: USDC_SEPOLIA, amount: "2000" },
        ]),
      );

      const result = await provider.screenCryptoAddress(mainnetWallet, { address: VALID_ADDRESS });
      expect(JSON.parse(result).message).toBe("Payment exceeds limit");
      expect(mainnetWallet.toSigner).not.toHaveBeenCalled();
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("refuses a quote whose asset is not USDC without signing", async () => {
      fetchSpy.mockResolvedValue(
        quoteResponse([{ network: "eip155:84532", asset: "XRP", amount: "1" }]),
      );

      const result = await provider.screenCryptoAddress(sepoliaWallet, { address: VALID_ADDRESS });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Only USDC payments are supported");
      expect(sepoliaWallet.toSigner).not.toHaveBeenCalled();
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("does not pay when the unpaid request is not a 402", async () => {
      fetchSpy.mockResolvedValue(
        createMockResponse({
          status: 500,
          data: { error: "down" },
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await provider.screenCryptoAddress(sepoliaWallet, { address: VALID_ADDRESS });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.status).toBe(500);
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
      expect(sepoliaWallet.toSigner).not.toHaveBeenCalled();
    });

    it("returns an unpaid 200 body without a transaction hash", async () => {
      fetchSpy.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { listed: false },
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await provider.screenCryptoAddress(sepoliaWallet, { address: VALID_ADDRESS });
      expect(JSON.parse(result)).toEqual({
        success: true,
        data: { listed: false },
        paymentTxHash: null,
      });
      expect(sepoliaWallet.toSigner).not.toHaveBeenCalled();
    });
  });

  describe("schemas", () => {
    const validLei = "5493001KJTIIGC8Y1R12";

    it("rejects a crypto address that is too short or too long", () => {
      expect(ScreenCryptoAddressSchema.safeParse({ address: "0x1234" }).success).toBe(false);
      expect(ScreenCryptoAddressSchema.safeParse({ address: "a".repeat(121) }).success).toBe(false);
      expect(ScreenCryptoAddressSchema.safeParse({ address: VALID_ADDRESS }).success).toBe(true);
      expect(ScreenCryptoAddressSchema.safeParse({ address: "a".repeat(20) }).success).toBe(true);
    });

    it("requires a counterparty identifier and rejects malformed fields", () => {
      expect(CounterpartyCheckSchema.safeParse({}).success).toBe(false);
      expect(CounterpartyCheckSchema.safeParse({ vat: "DE129274202" }).success).toBe(false);
      expect(CounterpartyCheckSchema.safeParse({ country: "DE" }).success).toBe(false);
      expect(CounterpartyCheckSchema.safeParse({ name: "A" }).success).toBe(false);
      expect(CounterpartyCheckSchema.safeParse({ domain: "ab" }).success).toBe(false);
      expect(CounterpartyCheckSchema.safeParse({ domain: "bad domain.com" }).success).toBe(false);
      expect(CounterpartyCheckSchema.safeParse({ lei: "5493001KJTIIGC8Y1R1A" }).success).toBe(
        false,
      );
      expect(
        CounterpartyCheckSchema.safeParse({ vat: "de129274202", name: "Siemens AG" }).success,
      ).toBe(false);
      expect(
        CounterpartyCheckSchema.safeParse({ country: "DEU", name: "Siemens AG" }).success,
      ).toBe(false);

      expect(CounterpartyCheckSchema.safeParse({ name: "Siemens AG" }).success).toBe(true);
      expect(CounterpartyCheckSchema.safeParse({ domain: "siemens.com" }).success).toBe(true);
      expect(CounterpartyCheckSchema.safeParse({ lei: validLei }).success).toBe(true);
      expect(CounterpartyCheckSchema.safeParse({ address: VALID_ADDRESS }).success).toBe(true);
      expect(
        CounterpartyCheckSchema.safeParse({
          name: "Siemens AG",
          domain: "siemens.com",
          lei: validLei,
          vat: "DE129274202",
          country: "de",
          address: VALID_ADDRESS,
        }).success,
      ).toBe(true);
    });

    it("requires a merchant domain and rejects a bad ticker or LEI", () => {
      expect(MerchantCheckSchema.safeParse({}).success).toBe(false);
      expect(MerchantCheckSchema.safeParse({ name: "Apple Inc." }).success).toBe(false);
      expect(MerchantCheckSchema.safeParse({ domain: "not a domain" }).success).toBe(false);
      expect(
        MerchantCheckSchema.safeParse({ domain: "apple.com", ticker: "this-is-too-long" }).success,
      ).toBe(false);
      expect(MerchantCheckSchema.safeParse({ domain: "apple.com", lei: "short" }).success).toBe(
        false,
      );

      expect(MerchantCheckSchema.safeParse({ domain: "apple.com" }).success).toBe(true);
      expect(
        MerchantCheckSchema.safeParse({
          domain: "apple.com",
          name: "Apple Inc.",
          ticker: "AAPL",
          lei: validLei,
          country: "US",
        }).success,
      ).toBe(true);
    });
  });
});
