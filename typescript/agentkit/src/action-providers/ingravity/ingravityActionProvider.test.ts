import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  BASE_CAIP2_NETWORK,
  BASE_USDC_CONTRACT,
  ERC8021_SUFFIX_HEX,
  INGRAVITY_PAY_TO_WALLET,
  INGRAVITY_ROUTES,
  INGRAVITY_WORKER_URL,
} from "./constants";
import {
  IngravityActionProvider,
  encodeErc8021Calldata,
  ingravityActionProvider,
} from "./ingravityActionProvider";
import {
  AuditSoliditySchema,
  DeepExploitBountySchema,
  DefiMathGuardSchema,
  FastPingSchema,
  ProtocolDossierSchema,
  TokenRugScannerSchema,
  TxFirewallSchema,
} from "./schemas";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockFetchWithPayment = jest.fn();
const mockX402ClientInstance = { registerScheme: jest.fn() };

jest
  .mocked(x402Client)
  .mockImplementation(() => mockX402ClientInstance as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest
  .mocked(registerExactEvmScheme)
  .mockImplementation(() => mockX402ClientInstance as unknown as InstanceType<typeof x402Client>);

/**
 * Builds a realistic HTTP 402 x402 v2 response matching Ingravity's live Cloudflare Worker.
 *
 * @param atomicAmount - Required Base USDC amount in 6-decimal atomic units (e.g. "10000")
 * @param routePath - Canonical /api/v1/... route path
 * @returns Mock Response-like object with PAYMENT-REQUIRED header and x402 v2 accepts body
 */
function build402ChallengeResponse(atomicAmount: string, routePath: string) {
  const challenge = {
    x402Version: 2,
    error: "Payment Required",
    resource: { url: `${INGRAVITY_WORKER_URL}${routePath}` },
    accepts: [
      {
        scheme: "exact",
        network: BASE_CAIP2_NETWORK,
        asset: BASE_USDC_CONTRACT,
        payTo: INGRAVITY_PAY_TO_WALLET,
        amount: atomicAmount,
      },
    ],
  };
  const encodedHeader = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
  return {
    ok: false,
    status: 402,
    headers: new Headers({
      "PAYMENT-REQUIRED": encodedHeader,
    }),
    json: async () => challenge,
    text: async () => JSON.stringify(challenge),
  };
}

describe("IngravityActionProvider", () => {
  const MOCK_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890";
  const MOCK_USDC_ADDRESS = BASE_USDC_CONTRACT;

  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue(MOCK_WALLET_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      toSigner: jest.fn().mockReturnValue({
        address: MOCK_WALLET_ADDRESS,
        signTypedData: jest.fn().mockResolvedValue("0xmocksignature"),
      }),
      readContract: jest.fn().mockResolvedValue(BigInt(0)),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    mockFetchWithPayment.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe("Constructor & Network Support", () => {
    it("should instantiate with defaults and support EVM networks only", () => {
      const provider = ingravityActionProvider();
      expect(provider).toBeInstanceOf(IngravityActionProvider);
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as Network),
      ).toBe(true);
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" } as Network),
      ).toBe(false);
    });
  });

  describe("ERC-8021 Builder Attribution Helper", () => {
    it("should append ERC-8021 suffix once and reject malformed hex", () => {
      const tagged = encodeErc8021Calldata("0xa9059cbb");
      expect(tagged).toBe(`0xa9059cbb${ERC8021_SUFFIX_HEX.toLowerCase()}`);
      expect(encodeErc8021Calldata(tagged)).toBe(tagged);
      expect(() => encodeErc8021Calldata("not-hex")).toThrow();
    });
  });

  describe("Zod Schemas Validation", () => {
    it("should validate all 7 schemas with canonical Worker field names", () => {
      expect(FastPingSchema.parse({ address: MOCK_USDC_ADDRESS }).address).toBe(MOCK_USDC_ADDRESS);
      expect(() => FastPingSchema.parse({ address: "bad" })).toThrow();

      expect(TxFirewallSchema.parse({ to: MOCK_USDC_ADDRESS }).to).toBe(MOCK_USDC_ADDRESS);

      expect(
        TokenRugScannerSchema.parse({ tokenAddress: MOCK_USDC_ADDRESS, tier: "ESSENTIAL" }).tier,
      ).toBe("ESSENTIAL");
      expect(() => TokenRugScannerSchema.parse({})).toThrow();

      expect(
        DefiMathGuardSchema.parse({
          amm: { reserveIn: "1000", reserveOut: "2000", amountIn: "10" },
        }).amm?.amountIn,
      ).toBe("10");
      expect(() => DefiMathGuardSchema.parse({})).toThrow();

      expect(
        AuditSoliditySchema.parse({
          code: "pragma solidity ^0.8.20; contract A {}",
          contractName: "A.sol",
        }).code,
      ).toContain("pragma solidity");

      expect(
        ProtocolDossierSchema.parse({
          protocolName: "Aegis",
          contracts: [{ name: "Vault.sol", code: "pragma solidity ^0.8.20; contract Vault {}" }],
        }).contracts.length,
      ).toBe(1);

      expect(
        DeepExploitBountySchema.parse({
          protocolName: "BaseLendingPool",
          poolAddress: MOCK_USDC_ADDRESS,
        }).protocolName,
      ).toBe("BaseLendingPool");
    });
  });

  describe("x402 v2 Settlement & Endpoint Alignment (/api/v1/...)", () => {
    it("should call /api/v1/fast-ping, validate atomic amount 10000 ($0.01), and settle via @x402/fetch", async () => {
      const provider = new IngravityActionProvider({ maxSpendUsdc: 0.05 });

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(build402ChallengeResponse("10000", INGRAVITY_ROUTES.FAST_PING));

      mockFetchWithPayment.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "PAYMENT-RESPONSE": Buffer.from(JSON.stringify({ success: true })).toString("base64"),
          "X-Ingravity-Receipt-Token": "receipt-fast-ping-001",
        }),
        json: async () => ({
          settled: true,
          status: "SAFE",
          verdict: "SAFE",
          action: "PROCEED",
          isSafe: true,
        }),
      });

      const output = await provider.fastPing(mockWalletProvider, {
        address: MOCK_USDC_ADDRESS,
        chainId: 8453,
      });

      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.verdict).toBe("SAFE");
      expect(parsed.settled).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `${INGRAVITY_WORKER_URL}${INGRAVITY_ROUTES.FAST_PING}?address=${encodeURIComponent(MOCK_USDC_ADDRESS)}&chainId=8453`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(registerExactEvmScheme).toHaveBeenCalledTimes(1);
      expect(mockFetchWithPayment).toHaveBeenCalledTimes(1);
    });

    it("should call /api/v1/audit-solidity with canonical 'code' field", async () => {
      const provider = new IngravityActionProvider({ maxSpendUsdc: 1.0 });

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          build402ChallengeResponse("850000", INGRAVITY_ROUTES.AUDIT_SOLIDITY),
        );

      mockFetchWithPayment.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ settled: true, grade: "A", securityScore: 98 }),
      });

      const sol = "pragma solidity ^0.8.20; contract Clean {}";
      const output = await provider.auditSolidity(mockWalletProvider, {
        code: sol,
        contractName: "Clean.sol",
      });

      expect((JSON.parse(output) as Record<string, unknown>).grade).toBe("A");
      expect(global.fetch).toHaveBeenCalledWith(
        `${INGRAVITY_WORKER_URL}${INGRAVITY_ROUTES.AUDIT_SOLIDITY}`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"code":"pragma solidity'),
        }),
      );
    });

    it("should enforce maxSpendUsdc against atomic accepts[0].amount and block before signing", async () => {
      const provider = new IngravityActionProvider({ maxSpendUsdc: 0.05 });

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(build402ChallengeResponse("100000", INGRAVITY_ROUTES.TX_FIREWALL));

      await expect(
        provider.txFirewall(mockWalletProvider, {
          to: MOCK_USDC_ADDRESS,
          data: "0x",
        }),
      ).rejects.toThrow(/exceeding configured maxSpendUsdc limit of \$0.05/);

      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("should reuse cached X-Ingravity-Receipt-Token on repeated calls without paying twice", async () => {
      const provider = new IngravityActionProvider({ enableReceiptCache: true });

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(build402ChallengeResponse("10000", INGRAVITY_ROUTES.FAST_PING))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ settled: true, verdict: "SAFE", receiptReused: true }),
        });

      mockFetchWithPayment.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "X-Ingravity-Receipt-Token": "receipt-token-777" }),
        json: async () => ({ settled: true, verdict: "SAFE" }),
      });

      await provider.fastPing(mockWalletProvider, { address: MOCK_USDC_ADDRESS });
      const second = await provider.fastPing(mockWalletProvider, { address: MOCK_USDC_ADDRESS });

      expect((JSON.parse(second) as Record<string, unknown>).receiptReused).toBe(true);
      expect(mockFetchWithPayment).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining(INGRAVITY_ROUTES.FAST_PING),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Ingravity-Receipt-Token": "receipt-token-777",
          }),
        }),
      );
    });

    it("should fail closed with zero verdict leakage when x402 payment settlement fails", async () => {
      const provider = new IngravityActionProvider();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(build402ChallengeResponse("10000", INGRAVITY_ROUTES.FAST_PING));

      mockFetchWithPayment.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => '{"error":"Payment Rejected"}',
      });

      await expect(
        provider.fastPing(mockWalletProvider, { address: MOCK_USDC_ADDRESS }),
      ).rejects.toThrow(/rejected x402 payment \(402\)/);
    });
  });
});
