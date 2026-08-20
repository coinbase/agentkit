import { payperbyteActionProvider } from "./payperbyteActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256 } from "viem";
import {
  BYTE_ATTESTATION_DOMAIN_NAME,
  BYTE_ATTESTATION_CHAIN_ID,
  BYTE_ATTESTATION_VERIFYING_CONTRACT,
  PAYLOAD_ATTESTATION_TYPES,
} from "./constants";
import type { PaymentPolicy, PaymentRequirements } from "@x402/fetch";

// Mock @x402/fetch and @x402/evm so no real payment logic runs. The x402Client mock has a real
// registerPolicy() that captures whatever policy this provider registers, so tests can invoke
// that captured policy directly against synthetic PaymentRequirements and assert the filter
// result -- proving the cap is enforced against the server's actual 402 quote, not just the
// catalog's advertised price.
const mockWrapFetchWithPayment = jest.fn();
let capturedPolicy: PaymentPolicy | null = null;
const mockX402ClientInstance = {
  registerPolicy: jest.fn((policy: PaymentPolicy) => {
    capturedPolicy = policy;
    return mockX402ClientInstance;
  }),
};
jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn().mockImplementation(() => mockX402ClientInstance),
  wrapFetchWithPayment: (...args: unknown[]) => mockWrapFetchWithPayment(...args),
}));
const mockRegisterExactEvmScheme = jest.fn();
jest.mock("@x402/evm/exact/client", () => ({
  registerExactEvmScheme: (...args: unknown[]) => mockRegisterExactEvmScheme(...args),
}));

// Mock fetch globally to prevent any actual network requests.
global.fetch = jest.fn();

// A representative subset of the real catalog shape, captured via one read-only curl against
// https://x402.payperbyte.io/feeds (2026-08-20) — not fabricated field names.
const MOCK_CATALOG = {
  protocol: "PayPerByte x402 Gateway",
  version: "0.3.0",
  networks: ["eip155:8453"],
  facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  feeds: [
    {
      id: "weather",
      name: "Weather (US, multi-city)",
      description: "NWS weather forecasts for 5 US cities (NYC, LA, Chicago, Houston, Miami)",
      updateFrequency: "3600s",
      provenance: "eip712-attested",
      endpoint: "/feeds/weather",
      expectedSizeBytes: 4400,
      priceAtomic: "5000",
      price: "$0.0050",
      publisher: "0xa820763c023a929e83c59e4fd5a623e5a8efe941",
      disclaimerCategory: "general",
      method: ["GET"],
    },
    {
      id: "threat-intel",
      name: "Security Advisories Digest",
      description: "Recent CVE highlights + CISA known-exploited-vulnerability entries",
      updateFrequency: "3600s",
      provenance: "eip712-attested",
      endpoint: "/feeds/threat-intel",
      expectedSizeBytes: 5300,
      priceAtomic: "50000",
      price: "$0.050",
      publisher: "0xb90b00f891dc534a5b59c60170661b868f3c26de",
      disclaimerCategory: "general",
      method: ["GET", "POST"],
    },
  ],
};

/** Mocks the next global.fetch call to resolve with the representative catalog fixture. */
function mockCatalogFetch() {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => MOCK_CATALOG,
  });
}

describe("PayperbyteActionProvider", () => {
  const provider = payperbyteActionProvider();

  const mockWallet = {
    getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
    getNetwork: jest.fn().mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
    getName: jest.fn().mockReturnValue("test-wallet"),
    toSigner: jest.fn().mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
    }),
  } as unknown as EvmWalletProvider;
  Object.setPrototypeOf(mockWallet, EvmWalletProvider.prototype);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("supportsNetwork", () => {
    it("supports base-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "base-mainnet" } as never)).toBe(true);
    });
    it("supports base-sepolia", () => {
      expect(provider.supportsNetwork({ networkId: "base-sepolia" } as never)).toBe(true);
    });
    it("does not support other networks", () => {
      expect(provider.supportsNetwork({ networkId: "solana-mainnet" } as never)).toBe(false);
      expect(provider.supportsNetwork({ networkId: "ethereum-mainnet" } as never)).toBe(false);
    });
  });

  describe("payperbyte_list_feeds", () => {
    it("lists feeds with USDC prices computed from priceAtomic", async () => {
      mockCatalogFetch();

      const result = await provider.listFeeds(mockWallet, {});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.feeds).toHaveLength(2);
      expect(parsed.feeds[0].id).toBe("weather");
      expect(parsed.feeds[0].priceUsdc).toBeCloseTo(0.005, 6);
      expect(parsed.feeds[1].priceUsdc).toBeCloseTo(0.05, 6);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://x402.payperbyte.io/feeds",
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
      // No payment path touched for a free catalog listing.
      expect(mockWrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("returns an error JSON if the catalog fetch fails, without throwing", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Unavailable",
      });

      const result = await provider.listFeeds(mockWallet, {});
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
    });
  });

  describe("payperbyte_query_feed", () => {
    it("pays for and returns a feed, passing body and attestation through verbatim", async () => {
      mockCatalogFetch();
      const responseBody = '{"answer":"72F, sunny"}';
      const attestationHeader = JSON.stringify({
        alg: "EIP712-PayloadAttestation",
        domain: {
          name: "BYTE Library",
          version: "1",
          chainId: 421614,
          verifyingContract: "0x44729bB148F46d8Db509E47b0453edc271e06e95",
        },
        publisher: "0xa820763c023a929e83c59e4fd5a623e5a8efe941",
        payloadHash: keccak256(new TextEncoder().encode(responseBody)),
        payloadLength: responseBody.length,
        deadline: Math.floor(Date.now() / 1000) + 300,
        signature: "0xdeadbeef",
      });
      const mockPaidFetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: async () => responseBody,
        headers: {
          get: (name: string) => (name === "x-byte-attestation" ? attestationHeader : null),
        },
      });
      mockWrapFetchWithPayment.mockReturnValueOnce(mockPaidFetch);

      const result = await provider.queryFeed(mockWallet, { feedId: "weather", queryParams: null });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.body).toBe(responseBody);
      expect(parsed.attestation.publisher).toBe("0xa820763c023a929e83c59e4fd5a623e5a8efe941");
      expect(mockPaidFetch).toHaveBeenCalledWith(
        "https://x402.payperbyte.io/feeds/weather",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("refuses without paying when the feed price exceeds maxPaymentUsdc", async () => {
      const cappedProvider = payperbyteActionProvider({ maxPaymentUsdc: 0.01 });
      mockCatalogFetch();

      const result = await cappedProvider.queryFeed(mockWallet, {
        feedId: "threat-intel",
        queryParams: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("spend cap");
      expect(mockWrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("errors on an unknown feed id, without attempting payment", async () => {
      mockCatalogFetch();
      const result = await provider.queryFeed(mockWallet, {
        feedId: "does-not-exist",
        queryParams: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.availableFeedIds).toEqual(["weather", "threat-intel"]);
      expect(mockWrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("errors on a non-EvmWalletProvider without attempting payment", async () => {
      const nonEvmWallet = {} as unknown as EvmWalletProvider; // no prototype chain -> not instanceof EvmWalletProvider
      const result = await provider.queryFeed(nonEvmWallet, {
        feedId: "weather",
        queryParams: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Unsupported wallet provider");
      expect(mockWrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("errors on an unsupported network without attempting payment", async () => {
      const wrongNetworkWallet = {
        ...mockWallet,
        getNetwork: jest
          .fn()
          .mockReturnValue({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      } as unknown as EvmWalletProvider;
      Object.setPrototypeOf(wrongNetworkWallet, EvmWalletProvider.prototype);

      const result = await provider.queryFeed(wrongNetworkWallet, {
        feedId: "weather",
        queryParams: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Unsupported network");
      expect(mockWrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("restricts the payment scheme itself to Base networks, not the eip155:* default", async () => {
      mockCatalogFetch();
      const mockPaidFetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: async () => "{}",
        headers: { get: () => null },
      });
      mockWrapFetchWithPayment.mockReturnValueOnce(mockPaidFetch);

      await provider.queryFeed(mockWallet, { feedId: "weather", queryParams: null });

      expect(mockRegisterExactEvmScheme).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ networks: ["eip155:8453", "eip155:84532"] }),
      );
    });

    it("classifies a policy-rejection throw from @x402/core into a clean error, not a raw throw", async () => {
      mockCatalogFetch();
      mockWrapFetchWithPayment.mockReturnValueOnce(
        jest
          .fn()
          .mockRejectedValueOnce(
            new Error("All payment requirements were filtered out by policies for x402 version: 2"),
          ),
      );

      const result = await provider.queryFeed(mockWallet, { feedId: "weather", queryParams: null });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.noPaymentMade).toBe(true);
      expect(parsed.message).toContain("402 quote exceeds cap");
    });
  });

  describe("payment cap policy (protocol-level, enforced against the server's real 402 quote)", () => {
    const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    /**
     * Builds a synthetic PaymentRequirements object (a "402 quote"), defaulting to a valid
     * Base-mainnet USDC option within the default cap.
     *
     * @param overrides - Fields to override on the default requirement.
     * @returns A PaymentRequirements object for testing the cap policy directly.
     */
    function makeRequirement(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
      return {
        scheme: "exact",
        network: "eip155:8453",
        asset: USDC_BASE_MAINNET,
        amount: "500000", // $0.50 at 6 decimals
        payTo: "0x000000000000000000000000000000000000dEaD",
        maxTimeoutSeconds: 60,
        extra: {},
        ...overrides,
      };
    }

    beforeEach(async () => {
      // Trigger one successful queryFeed call purely to populate `capturedPolicy` via the
      // mocked x402Client.registerPolicy -- the policy itself is then tested directly below
      // against synthetic PaymentRequirements, independent of the mocked payment flow.
      capturedPolicy = null;
      mockCatalogFetch();
      const mockPaidFetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: async () => "{}",
        headers: { get: () => null },
      });
      mockWrapFetchWithPayment.mockReturnValueOnce(mockPaidFetch);
      await provider.queryFeed(mockWallet, { feedId: "weather", queryParams: null });
      expect(capturedPolicy).not.toBeNull();
    });

    it("(a) filters out a 402 quote priced above the cap", () => {
      const overCap = makeRequirement({ amount: "2000000" }); // $2.00 > default $1.00 cap
      expect(capturedPolicy!(2, [overCap])).toEqual([]);
    });

    it("(b) keeps a 402 quote priced within the cap", () => {
      const withinCap = makeRequirement({ amount: "500000" }); // $0.50 <= default $1.00 cap
      expect(capturedPolicy!(2, [withinCap])).toEqual([withinCap]);
    });

    it("keeps a 402 quote priced at EXACTLY the cap", () => {
      const atCap = makeRequirement({ amount: "1000000" }); // $1.00 == default $1.00 cap
      expect(capturedPolicy!(2, [atCap])).toEqual([atCap]);
    });

    it("L-7: filters out a quote with a NEGATIVE amount, instead of keeping it (negative <= cap is true)", () => {
      const negativeAmount = makeRequirement({ amount: "-1" });
      expect(capturedPolicy!(2, [negativeAmount])).toEqual([]);
    });

    it("(c) filters out a quote for a non-USDC asset", () => {
      const notUsdc = makeRequirement({ asset: "0x1111111111166b7FE7bd91427724B487980aFc69" }); // ZORA, not USDC
      expect(capturedPolicy!(2, [notUsdc])).toEqual([]);
    });

    it("(d) filters out a quote on a non-Base network", () => {
      const ethereumMainnet = makeRequirement({ network: "eip155:1", asset: USDC_BASE_MAINNET });
      expect(capturedPolicy!(2, [ethereumMainnet])).toEqual([]);
    });

    it(
      "M-9: a v1-shaped quote (maxAmountRequired, no amount field) within cap survives the " +
        "filter instead of being dropped as NaN",
      () => {
        // PaymentRequirementsV1 carries the price as `maxAmountRequired`, not `amount` --
        // the declared PaymentRequirements type is v2-only, but real v1 quotes at runtime
        // won't have `amount` set at all.
        const v1Quote = makeRequirement({ amount: undefined as unknown as string });
        (v1Quote as PaymentRequirements & { maxAmountRequired?: string }).maxAmountRequired =
          "500000"; // $0.50, within the default $1.00 cap
        expect(capturedPolicy!(2, [v1Quote])).toEqual([v1Quote]);
      },
    );

    it("M-9 regression: without the fallback this would silently drop a v1 quote as NaN <= cap (always false)", () => {
      const v1QuoteOverCap = makeRequirement({ amount: undefined as unknown as string });
      (v1QuoteOverCap as PaymentRequirements & { maxAmountRequired?: string }).maxAmountRequired =
        "5000000"; // $5.00, OVER the default $1.00 cap -- must still be correctly filtered OUT
      expect(capturedPolicy!(2, [v1QuoteOverCap])).toEqual([]);
    });

    it("mixed list: keeps only the within-cap Base/USDC option", () => {
      const good = makeRequirement({ amount: "500000" });
      const tooExpensive = makeRequirement({ amount: "5000000" });
      const wrongAsset = makeRequirement({ asset: "0x1111111111166b7FE7bd91427724B487980aFc69" });
      const wrongNetwork = makeRequirement({ network: "eip155:1" });
      expect(capturedPolicy!(2, [tooExpensive, wrongAsset, wrongNetwork, good])).toEqual([good]);
    });
  });

  describe("payperbyte_verify_attestation", () => {
    // Ephemeral throwaway key, generated fresh for this test run and never persisted anywhere.
    const ephemeralPrivateKey = generatePrivateKey();
    const ephemeralAccount = privateKeyToAccount(ephemeralPrivateKey);

    /**
     * Signs a sample body as a PayloadAttestation with the ephemeral test key, under a given
     * domain (defaults to the real pinned BYTE Library domain).
     *
     * @param body - The exact string to hash and sign over.
     * @param overrides - Optional publisher/deadline/domain overrides, for building negative test cases.
     * @returns The attestation object, matching the X-BYTE-Attestation header shape.
     */
    async function signSampleBody(
      body: string,
      overrides: Partial<{
        publisher: `0x${string}`;
        deadline: number;
        domainName: string;
        domainVersion: string;
        chainId: number;
        verifyingContract: `0x${string}`;
      }> = {},
    ) {
      const bodyBytes = new TextEncoder().encode(body);
      const payloadHash = keccak256(bodyBytes);
      const payloadLength = bodyBytes.length;
      const deadline = overrides.deadline ?? Math.floor(Date.now() / 1000) + 300;
      const publisher = overrides.publisher ?? ephemeralAccount.address;
      const domain = {
        name: overrides.domainName ?? BYTE_ATTESTATION_DOMAIN_NAME,
        version: overrides.domainVersion ?? "1",
        chainId: overrides.chainId ?? BYTE_ATTESTATION_CHAIN_ID,
        verifyingContract: overrides.verifyingContract ?? BYTE_ATTESTATION_VERIFYING_CONTRACT,
      };

      const signature = await ephemeralAccount.signTypedData({
        domain,
        types: PAYLOAD_ATTESTATION_TYPES,
        primaryType: "PayloadAttestation",
        message: {
          publisher,
          payloadHash,
          payloadLength: BigInt(payloadLength),
          deadline: BigInt(deadline),
        },
      });

      return {
        alg: "EIP712-PayloadAttestation",
        domain,
        publisher,
        payloadHash,
        payloadLength,
        deadline,
        signature,
      };
    }

    it("POSITIVE: verifies a freshly-signed attestation over the exact body", async () => {
      const body = '{"feed":"weather","data":{"tempF":72}}';
      const attestation = await signSampleBody(body);

      const result = await provider.verifyAttestation(mockWallet, { body, attestation });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(true);
      expect(parsed.publisher).toBe(ephemeralAccount.address);
      expect(parsed.recoveredSigner).toBe(ephemeralAccount.address);
      // No trustedPublishers configured on the default `provider` -> policy is left to the caller.
      expect(parsed.publisherTrusted).toBeNull();
    });

    it("NEGATIVE (tampered body): a modified body produces a hash mismatch", async () => {
      const originalBody = '{"feed":"weather","data":{"tempF":72}}';
      const attestation = await signSampleBody(originalBody);
      const tamperedBody = '{"feed":"weather","data":{"tempF":999}}';

      const result = await provider.verifyAttestation(mockWallet, {
        body: tamperedBody,
        attestation,
      });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(false);
      expect(parsed.reason).toContain("does not match the attested payloadHash");
    });

    it("NEGATIVE (wrong signer): attestation.publisher claims an address that did not sign it", async () => {
      const body = '{"feed":"weather","data":{"tempF":72}}';
      const wrongPublisher = "0x000000000000000000000000000000000000dEaD" as const;
      // Sign for real with the ephemeral key, but claim a different publisher in the message —
      // the recovered signer will not match the claimed publisher.
      const attestation = await signSampleBody(body, { publisher: wrongPublisher });

      const result = await provider.verifyAttestation(mockWallet, { body, attestation });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(false);
      expect(parsed.reason).toContain("does not match the claimed publisher");
      expect(parsed.claimedPublisher).toBe(wrongPublisher);
    });

    it("NEGATIVE (expired deadline): a past deadline fails closed even though hash+signature check out", async () => {
      const body = '{"feed":"weather","data":{"tempF":72}}';
      const pastDeadline = Math.floor(Date.now() / 1000) - 3600; // 1h in the past
      const attestation = await signSampleBody(body, { deadline: pastDeadline });

      const result = await provider.verifyAttestation(mockWallet, { body, attestation });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(false);
      expect(parsed.hashMatch).toBe(true);
      expect(parsed.signerMatch).toBe(true);
      expect(parsed.expired).toBe(true);
    });

    it("NEGATIVE (wrong domain name): rejects immediately, never renamed away from 'BYTE Library'", async () => {
      const body = '{"feed":"weather","data":{"tempF":72}}';
      const attestation = await signSampleBody(body, { domainName: "Not BYTE Library" });

      const result = await provider.verifyAttestation(mockWallet, { body, attestation });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(false);
      expect(parsed.reason).toContain("domain mismatch");
      expect(parsed.reason).toContain('"Not BYTE Library" != "BYTE Library"');
    });

    it(
      "BLOCKER regression (BL-2, forged domain): an attestation self-consistently signed and " +
        "claimed under a DIFFERENT chainId/verifyingContract must NOT verify, even though its " +
        "own hash/signature/publisher are all internally consistent",
      async () => {
        const body = '{"feed":"weather","data":{"tempF":72}}';
        // The attacker signs with THEIR OWN key, under a domain THEY chose (chainId 1, a
        // different verifyingContract), and claims to be the publisher of their own signature.
        // Every internal check (hash match, signer === claimed publisher) passes on its own
        // terms — the only thing that can catch this is pinning the domain independently of
        // what the attestation itself claims.
        const forged = await signSampleBody(body, {
          chainId: 1,
          verifyingContract: "0x000000000000000000000000000000000000dEaD",
        });

        const result = await provider.verifyAttestation(mockWallet, { body, attestation: forged });
        const parsed = JSON.parse(result);

        expect(parsed.verified).toBe(false);
        expect(parsed.reason).toContain("domain mismatch");
        expect(parsed.reason).toContain("chainId 1 != 421614");
      },
    );

    it("attestationDomain config override: verification uses the CONFIGURED pinned domain, not the default", async () => {
      const migratedProvider = payperbyteActionProvider({
        attestationDomain: {
          chainId: 84532,
          verifyingContract: "0x1111111111111111111111111111111111111111",
        },
      });
      const body = '{"feed":"weather","data":{"tempF":72}}';
      // Signed under the NEW configured domain, not the hardcoded default.
      const attestation = await signSampleBody(body, {
        chainId: 84532,
        verifyingContract: "0x1111111111111111111111111111111111111111",
      });

      const result = await migratedProvider.verifyAttestation(mockWallet, { body, attestation });
      const parsed = JSON.parse(result);
      expect(parsed.verified).toBe(true);

      // The SAME attestation against the default (unmigrated) provider must fail domain pinning.
      const defaultResult = await provider.verifyAttestation(mockWallet, { body, attestation });
      expect(JSON.parse(defaultResult).verified).toBe(false);
    });

    it("trustedPublishers: an allowlisted signer verifies with publisherTrusted:true", async () => {
      const trustingProvider = payperbyteActionProvider({
        trustedPublishers: [ephemeralAccount.address],
      });
      const body = '{"feed":"weather","data":{"tempF":72}}';
      const attestation = await signSampleBody(body);

      const result = await trustingProvider.verifyAttestation(mockWallet, { body, attestation });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(true);
      expect(parsed.publisherTrusted).toBe(true);
    });

    it("trustedPublishers: a signer NOT on the allowlist fails verification even with a valid signature", async () => {
      const trustingProvider = payperbyteActionProvider({
        trustedPublishers: ["0x000000000000000000000000000000000000dEaD"], // not the ephemeral signer
      });
      const body = '{"feed":"weather","data":{"tempF":72}}';
      const attestation = await signSampleBody(body);

      const result = await trustingProvider.verifyAttestation(mockWallet, { body, attestation });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(false);
      expect(parsed.publisherTrusted).toBe(false);
      expect(parsed.reason).toContain("not in the configured trustedPublishers allowlist");
    });

    it("M-1: malformed input (non-string payloadHash) fails closed instead of throwing", async () => {
      const body = '{"feed":"weather","data":{"tempF":72}}';
      const attestation = await signSampleBody(body);
      const malformed = { ...attestation, payloadHash: 12345 as unknown as string };

      // This must not throw, even though TypeScript's static types say it can't happen — the
      // point is defending a caller that bypasses the schema layer entirely (only the MCP
      // adapter zod-parses; a direct/programmatic caller does not).
      const result = await provider.verifyAttestation(mockWallet, { body, attestation: malformed });
      const parsed = JSON.parse(result);

      expect(parsed.verified).toBe(false);
      expect(parsed.reason).toContain("invalid input");
    });
  });
});
