import { privateKeyToAccount } from "viem/accounts";
import { AgentumActionProvider, agentumActionProvider } from "./agentumActionProvider";
import {
  BatchResolveSchema,
  CheckVendorSchema,
  ResolveEntitySchema,
  ScreenAddressSchema,
  ScreenSanctionsSchema,
  VerifyBankPayeeSchema,
  VerifyVatSchema,
} from "./schemas";
import { AGENTUM_BASE_URL, AGENTUM_ENDPOINTS } from "./constants";
import { atomicUsdcToUsd } from "./utils";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

// Well-known public test key (Hardhat account #0). Used only to sign locally in tests; never funded.
const TEST_ACCOUNT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0xea7f1083bacf69d3e3aa0c02ad5fbe4f09024f1e";

/**
 * Builds the HTTP 402 response the Agentum server returns for a paid call (x402 v2, exact, USDC on Base).
 *
 * @param amount - Atomic USDC amount (6 decimals)
 * @returns A 402 Response carrying the PAYMENT-REQUIRED header
 */
const paymentRequiredResponse = (amount: string): Response => {
  const paymentRequired = {
    x402Version: 2,
    error: "Payment Required",
    resource: {
      url: `${AGENTUM_BASE_URL}/v1/entity/sanctions-screen`,
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount,
        asset: USDC_BASE,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: { name: "USD Coin", version: "2", assetTransferMethod: "eip3009" },
      },
    ],
  };
  return new Response(JSON.stringify({ error: "Payment Required" }), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
    },
  });
};

/**
 * The x402 fetch wrapper hands fetch a Request object, so normalise (input, init) calls and
 * Request calls into a single Request for assertions.
 *
 * @param call - The arguments of one recorded fetch call
 * @returns The request that was sent
 */
const requestOf = (call: unknown[]): Request =>
  call[0] instanceof Request ? call[0] : new Request(call[0] as string, call[1] as RequestInit);

describe("AgentumActionProvider", () => {
  const mockFetch = jest.fn();
  const originalFetch = global.fetch;

  const mockWallet = {
    toSigner: jest.fn().mockReturnValue(TEST_ACCOUNT),
    readContract: jest.fn(),
    getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
  } as unknown as jest.Mocked<EvmWalletProvider>;

  let provider: AgentumActionProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockWallet.toSigner.mockReturnValue(TEST_ACCOUNT);
    provider = new AgentumActionProvider({ agentId: "test-agent" });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should be named agentum with the 7 expected actions", () => {
      expect(provider.name).toBe("agentum");
      const names = provider
        .getActions(mockWallet)
        .map(action => action.name)
        .sort();
      expect(names).toEqual(
        Object.keys(AGENTUM_ENDPOINTS)
          .map(name => `AgentumActionProvider_${name}`)
          .sort(),
      );
    });

    it("should expose a factory", () => {
      expect(agentumActionProvider()).toBeInstanceOf(AgentumActionProvider);
    });

    it("should reject a negative maxPriceUsd", () => {
      expect(() => new AgentumActionProvider({ maxPriceUsd: -1 })).toThrow(
        "maxPriceUsd must be a non-negative number",
      );
    });
  });

  describe("supportsNetwork", () => {
    it("should support Base mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
    });

    it("should not support other EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
    });

    it("should not support non-EVM networks or a missing networkId", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "solana", networkId: "solana-mainnet" }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "evm" } as Network)).toBe(false);
    });
  });

  describe("schemas", () => {
    it("should accept valid inputs and strip unknown fields", () => {
      expect(ResolveEntitySchema.parse({ query: "Siemens AG", extra: 1 })).toEqual({
        query: "Siemens AG",
      });
      expect(VerifyVatSchema.safeParse({ vatNumber: "DE129274202" }).success).toBe(true);
      expect(ScreenSanctionsSchema.safeParse({ name: "Acme", threshold: 0.8 }).success).toBe(true);
      expect(CheckVendorSchema.safeParse({ name: "Acme GmbH", country: "DE" }).success).toBe(true);
      expect(VerifyBankPayeeSchema.safeParse({ iban: "DE89 3704 0044 0532 0130 00" }).success).toBe(
        true,
      );
      expect(BatchResolveSchema.safeParse({ items: [{ query: "Acme" }] }).success).toBe(true);
      expect(ScreenAddressSchema.safeParse({ address: "0xabc", chain: "evm" }).success).toBe(true);
    });

    it("should reject invalid inputs", () => {
      expect(ResolveEntitySchema.safeParse({ query: "" }).success).toBe(false);
      expect(VerifyVatSchema.safeParse({ vatNumber: "DE" }).success).toBe(false);
      expect(ScreenSanctionsSchema.safeParse({ name: "Acme", threshold: 2 }).success).toBe(false);
      expect(BatchResolveSchema.safeParse({ items: [] }).success).toBe(false);
      expect(
        BatchResolveSchema.safeParse({ items: Array(26).fill({ query: "Acme" }) }).success,
      ).toBe(false);
      expect(ScreenAddressSchema.safeParse({ address: "0xabc", chain: "dogecoin" }).success).toBe(
        false,
      );
    });
  });

  describe("free-tier call (no payment)", () => {
    it("should POST to the endpoint and return the JSON result", async () => {
      const body = { sanctioned: false, riskLevel: "CLEAR" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await provider.screenSanctions(mockWallet, { name: "Acme Trading" });

      expect(JSON.parse(result)).toEqual(body);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const request = requestOf(mockFetch.mock.calls[0]);
      expect(request.url).toBe(`${AGENTUM_BASE_URL}${AGENTUM_ENDPOINTS.screen_sanctions}`);
      expect(request.method).toBe("POST");
      expect(await request.clone().json()).toEqual({ name: "Acme Trading" });
      expect(request.headers.get("X-Agent-Id")).toBe("test-agent");
    });

    it.each([
      ["resolveEntity", "resolve_entity", { query: "Siemens AG" }],
      ["verifyEuVat", "verify_eu_vat", { vatNumber: "DE129274202" }],
      ["screenSanctions", "screen_sanctions", { name: "Acme" }],
      ["checkVendor", "check_vendor", { name: "Acme GmbH" }],
      ["verifyBankPayee", "verify_bank_payee", { iban: "DE89370400440532013000" }],
      ["batchResolve", "batch_resolve", { items: [{ query: "Acme" }] }],
      [
        "screenAddress",
        "screen_address",
        { address: "0x0000000000000000000000000000000000000001" },
      ],
    ] as const)("%s should call %s", async (method, name, args) => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const result = await (
        provider[method] as (w: EvmWalletProvider, a: unknown) => Promise<string>
      ).call(provider, mockWallet, args);

      expect(JSON.parse(result)).toEqual({ ok: true });
      expect(requestOf(mockFetch.mock.calls[0]).url).toBe(
        `${AGENTUM_BASE_URL}${AGENTUM_ENDPOINTS[name]}`,
      );
    });

    it("should honour a custom baseUrl without a trailing slash", async () => {
      const custom = new AgentumActionProvider({ baseUrl: "https://example.test/" });
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      await custom.verifyEuVat(mockWallet, { vatNumber: "DE129274202" });

      expect(requestOf(mockFetch.mock.calls[0]).url).toBe(
        "https://example.test/v1/entity/vat-verify",
      );
    });
  });

  describe("paid call (HTTP 402 then x402 payment)", () => {
    it("should sign a payment from the wallet signer and retry with PAYMENT-SIGNATURE", async () => {
      mockFetch.mockResolvedValueOnce(paymentRequiredResponse("5000")).mockResolvedValueOnce(
        new Response(JSON.stringify({ sanctioned: false, riskLevel: "CLEAR" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await provider.screenSanctions(mockWallet, { name: "Acme Trading" });

      expect(JSON.parse(result)).toEqual({ sanctioned: false, riskLevel: "CLEAR" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockWallet.toSigner).toHaveBeenCalled();

      const retryRequest = requestOf(mockFetch.mock.calls[1]);
      const signature = retryRequest.headers.get("PAYMENT-SIGNATURE");
      expect(signature).toBeTruthy();

      const payload = JSON.parse(Buffer.from(signature as string, "base64").toString("utf8"));
      expect(payload.accepted.network).toBe("eip155:8453");
      expect(payload.accepted.payTo.toLowerCase()).toBe(PAY_TO);
      expect(payload.payload.authorization.from.toLowerCase()).toBe(
        TEST_ACCOUNT.address.toLowerCase(),
      );
      expect(payload.payload.authorization.value).toBe("5000");
    });

    it("should attach the x402 receipt when the server returns PAYMENT-RESPONSE", async () => {
      const receipt = {
        success: true,
        transaction: "0xabc",
        network: "eip155:8453",
        payer: "0xdef",
      };
      mockFetch.mockResolvedValueOnce(paymentRequiredResponse("5000")).mockResolvedValueOnce(
        new Response(JSON.stringify({ riskLevel: "CLEAR" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(receipt)).toString("base64"),
          },
        }),
      );

      const result = JSON.parse(await provider.screenAddress(mockWallet, { address: "0xabc" }));

      expect(result.riskLevel).toBe("CLEAR");
      expect(result.x402Receipt).toEqual(receipt);
    });

    it("should refuse to sign when the price exceeds maxPriceUsd", async () => {
      const capped = new AgentumActionProvider({ maxPriceUsd: 0.01 });
      mockFetch.mockResolvedValueOnce(paymentRequiredResponse("25000"));

      const result = await capped.batchResolve(mockWallet, { items: [{ query: "Acme" }] });

      expect(result).toContain("Error calling Agentum batch_resolve");
      expect(result).toContain("maxPriceUsd is $0.01");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should return an error string for a non-2xx response", async () => {
      mockFetch.mockResolvedValueOnce(new Response("bad request", { status: 400 }));

      const result = await provider.verifyEuVat(mockWallet, { vatNumber: "XX1234" });

      expect(result).toBe("Error calling Agentum verify_eu_vat: HTTP 400: bad request");
    });

    it("should return an error string when fetch rejects", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network down"));

      const result = await provider.checkVendor(mockWallet, { name: "Acme" });

      expect(result).toBe("Error calling Agentum check_vendor: network down");
    });
  });

  describe("atomicUsdcToUsd", () => {
    it("should convert 6-decimal atomic USDC to USD", () => {
      expect(atomicUsdcToUsd("5000")).toBe(0.005);
      expect(atomicUsdcToUsd("25000")).toBe(0.025);
      expect(atomicUsdcToUsd("2000")).toBe(0.002);
    });
  });
});
