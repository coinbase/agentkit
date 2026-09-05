import { encodeFunctionData, parseUnits } from "viem";
import { wrapFetchWithPayment } from "@x402/fetch";
import { EvmWalletProvider } from "../../wallet-providers";
import { SpraayActionProvider } from "./spraayActionProvider";
import {
  SprayEthSchema,
  SprayTokenSchema,
  SpraayValidateBatchSchema,
  SpraayEstimateBatchSchema,
  SpraayCreateEscrowSchema,
} from "./schemas";
import {
  SPRAAY_CONTRACT_ADDRESS,
  SPRAAY_ABI,
  ZERO_ADDRESS,
  SPRAAY_BPA_VERSION,
  SPRAAY_FREE_VALIDATE_BATCH_PATH,
  SPRAAY_FREE_ESTIMATE_BATCH_PATH,
  SPRAAY_GATEWAY_BATCH_EXECUTE_PATH,
  SPRAAY_GATEWAY_ESCROW_CREATE_PATH,
  SPRAAY_GATEWAY_BASE_URL,
} from "./constants";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockFetchWithPayment = jest.fn();
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);

// Mock the wallet provider
const mockSendTransaction = jest.fn();
const mockWaitForTransactionReceipt = jest.fn();
const mockGetAddress = jest.fn();
const mockReadContract = jest.fn();
const mockSignTypedData = jest.fn();
const mockToSigner = jest.fn();

const mockWalletProvider = {
  sendTransaction: mockSendTransaction,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
  getAddress: mockGetAddress,
  readContract: mockReadContract,
  signTypedData: mockSignTypedData,
  toSigner: mockToSigner,
  getNetwork: jest.fn().mockReturnValue({
    protocolFamily: "evm",
    networkId: "base-mainnet",
    chainId: "8453",
  }),
} as unknown as EvmWalletProvider;

const WALLET_ADDRESS = "0x1234567890123456789012345678901234567890";
const RECIPIENT_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECIPIENT_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TOKEN_ADDRESS = "0xcccccccccccccccccccccccccccccccccccccccc";
const MOCK_SIGNATURE = `0x${"11".repeat(32)}${"22".repeat(32)}1b` as `0x${string}`;

/**
 * Creates a mock fetch Response.
 *
 * @param options - The status, data, and headers for the response.
 * @param options.status - The HTTP status code.
 * @param options.data - The JSON body.
 * @param options.headers - Additional response headers.
 * @returns A Response-like object.
 */
const createMockResponse = (options: {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}): Response => {
  const headersMap = new Map(
    Object.entries({ "content-type": "application/json", ...(options.headers ?? {}) }),
  );
  return {
    status: options.status,
    ok: options.status >= 200 && options.status < 300,
    headers: {
      get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
    },
    json: jest.fn().mockResolvedValue(options.data),
    text: jest.fn().mockResolvedValue(JSON.stringify(options.data)),
  } as unknown as Response;
};

/**
 * Configures readContract responses keyed by functionName.
 *
 * @param overrides - Return values (or Error to throw) per function name.
 */
const setupReadContract = (overrides: Record<string, unknown> = {}) => {
  const defaults: Record<string, unknown> = {
    feeBps: 30n,
    decimals: 6,
    symbol: "USDC",
    name: "USD Coin",
    version: "2",
    nonces: 0n,
  };
  const values = { ...defaults, ...overrides };
  // Default allowance is stateful: 0 before the permit/approve lands, large after.
  let allowanceReads = 0;
  mockReadContract.mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === "allowance" && !("allowance" in overrides)) {
      allowanceReads += 1;
      return Promise.resolve(allowanceReads === 1 ? 0n : 2n ** 255n);
    }
    const value = values[functionName];
    if (value instanceof Error) {
      return Promise.reject(value);
    }
    return Promise.resolve(value);
  });
};

describe("SpraayActionProvider", () => {
  let provider: SpraayActionProvider;

  beforeEach(() => {
    provider = new SpraayActionProvider();
    jest.clearAllMocks();
    jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);

    mockGetAddress.mockReturnValue(WALLET_ADDRESS);
    mockSendTransaction.mockResolvedValue("0xmocktxhash123");
    mockWaitForTransactionReceipt.mockResolvedValue({ blockNumber: 12345n });
    mockSignTypedData.mockResolvedValue(MOCK_SIGNATURE);
    mockToSigner.mockReturnValue({});
    setupReadContract();
  });

  describe("supportsNetwork", () => {
    it("should support Base mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
    });

    it("should not support other networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("input schemas", () => {
    it("should accept a valid ETH batch", () => {
      const result = SprayEthSchema.safeParse({
        recipients: [RECIPIENT_A, RECIPIENT_B],
        amountPerRecipient: "0.01",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty recipient lists", () => {
      const result = SprayEthSchema.safeParse({ recipients: [], amountPerRecipient: "0.01" });
      expect(result.success).toBe(false);
    });

    it("should reject more than 200 recipients", () => {
      const recipients = Array.from(
        { length: 201 },
        (_, i) => `0x${i.toString(16).padStart(40, "0")}`,
      );
      const result = SprayEthSchema.safeParse({ recipients, amountPerRecipient: "0.01" });
      expect(result.success).toBe(false);
    });

    it("should reject malformed addresses", () => {
      const result = SprayEthSchema.safeParse({
        recipients: ["0xnotanaddress"],
        amountPerRecipient: "0.01",
      });
      expect(result.success).toBe(false);
    });

    it("should reject case-normalized duplicate recipients", () => {
      const result = SprayEthSchema.safeParse({
        recipients: [RECIPIENT_A, RECIPIENT_A.toUpperCase().replace("0X", "0x")],
        amountPerRecipient: "0.01",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-positive and malformed amounts", () => {
      expect(
        SprayEthSchema.safeParse({ recipients: [RECIPIENT_A], amountPerRecipient: "0" }).success,
      ).toBe(false);
      expect(
        SprayEthSchema.safeParse({ recipients: [RECIPIENT_A], amountPerRecipient: "-1" }).success,
      ).toBe(false);
      expect(
        SprayEthSchema.safeParse({ recipients: [RECIPIENT_A], amountPerRecipient: "abc" }).success,
      ).toBe(false);
    });

    it("should reject duplicate amounts arrays of the wrong shape for token batches", () => {
      const result = SprayTokenSchema.safeParse({
        tokenAddress: "not-an-address",
        recipients: [RECIPIENT_A],
        amountPerRecipient: "1",
      });
      expect(result.success).toBe(false);
    });

    it("should reject duplicate recipients in gateway batches", () => {
      const result = SpraayValidateBatchSchema.safeParse({
        token: "USDC",
        recipients: [
          { recipient: RECIPIENT_A, amount: "1.00" },
          { recipient: RECIPIENT_A.toLowerCase(), amount: "2.00" },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("should default chain to base for gateway batches", () => {
      const result = SpraayValidateBatchSchema.parse({
        token: "USDC",
        recipients: [{ recipient: RECIPIENT_A, amount: "1.00" }],
      });
      expect(result.chain).toBe("base");
    });

    it("should bound the estimate recipient count", () => {
      expect(SpraayEstimateBatchSchema.safeParse({ recipients: 0 }).success).toBe(false);
      expect(SpraayEstimateBatchSchema.safeParse({ recipients: 201 }).success).toBe(false);
      expect(SpraayEstimateBatchSchema.safeParse({ recipients: 50 }).success).toBe(true);
      expect(
        SpraayEstimateBatchSchema.safeParse({ recipients: 50, amount: "1000.00" }).success,
      ).toBe(true);
      expect(SpraayEstimateBatchSchema.safeParse({ recipients: 50, amount: "-1" }).success).toBe(
        false,
      );
    });

    it("should validate escrow input", () => {
      expect(
        SpraayCreateEscrowSchema.safeParse({
          token: "USDC",
          amount: "250.00",
          beneficiary: RECIPIENT_A,
        }).success,
      ).toBe(true);
      expect(
        SpraayCreateEscrowSchema.safeParse({
          token: "USDC",
          amount: "250.00",
          beneficiary: RECIPIENT_A,
          depositor: RECIPIENT_B,
          arbiter: TOKEN_ADDRESS,
          conditions: ["Design approved"],
          expiresIn: 72,
        }).success,
      ).toBe(true);
      expect(
        SpraayCreateEscrowSchema.safeParse({
          token: "USDC",
          amount: "0",
          beneficiary: RECIPIENT_A,
        }).success,
      ).toBe(false);
      expect(
        SpraayCreateEscrowSchema.safeParse({
          token: "USDC",
          amount: "250.00",
          beneficiary: RECIPIENT_A,
          expiresIn: -5,
        }).success,
      ).toBe(false);
    });
  });

  describe("sprayEth", () => {
    it("should spray ETH via sprayEqual with the zero address", async () => {
      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: [RECIPIENT_A, RECIPIENT_B],
        amountPerRecipient: "0.01",
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      const callArgs = mockSendTransaction.mock.calls[0][0];
      expect(callArgs.to).toBe(SPRAAY_CONTRACT_ADDRESS);
      expect(callArgs.data).toBe(
        encodeFunctionData({
          abi: SPRAAY_ABI,
          functionName: "sprayEqual",
          args: [ZERO_ADDRESS, [RECIPIENT_A, RECIPIENT_B], parseUnits("0.01", 18)],
        }),
      );
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith("0xmocktxhash123");
      expect(result).toContain("Successfully sprayed");
      expect(result).toContain("2 recipients");
      expect(result).toContain("basescan.org");
    });

    it("should include the live protocol fee in the total value", async () => {
      await provider.sprayEth(mockWalletProvider, {
        recipients: [RECIPIENT_A],
        amountPerRecipient: "1",
      });

      const callArgs = mockSendTransaction.mock.calls[0][0];
      // 1 ETH + 0.3% fee = 1.003 ETH in wei
      expect(callArgs.value).toBe(parseUnits("1.003", 18));
    });

    it("should fall back to the default fee when the feeBps read fails", async () => {
      setupReadContract({ feeBps: new Error("no rpc") });

      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: [RECIPIENT_A],
        amountPerRecipient: "1",
      });

      const callArgs = mockSendTransaction.mock.calls[0][0];
      expect(callArgs.value).toBe(parseUnits("1.003", 18));
      expect(result).toContain("Successfully sprayed");
    });

    it("should return error message on failure", async () => {
      mockSendTransaction.mockRejectedValue(new Error("Insufficient funds"));

      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: [RECIPIENT_A],
        amountPerRecipient: "100",
      });

      expect(result).toContain("Error spraying ETH");
      expect(result).toContain("Insufficient funds");
    });
  });

  describe("preflight", () => {
    it("should proceed on-chain when the gateway is unreachable", async () => {
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: [RECIPIENT_A],
        amountPerRecipient: "0.01",
        preflight: true,
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      expect(result).toContain("Pre-flight validation skipped");
      expect(result).toContain("Successfully sprayed");
    });

    it("should abort before signing when the gateway reports the batch invalid", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { valid: false, errors: ["recipient 0 is a contract"] },
        }),
      );

      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: [RECIPIENT_A],
        amountPerRecipient: "0.01",
        preflight: true,
      });

      expect(mockSendTransaction).not.toHaveBeenCalled();
      expect(result).toContain("failed Spraay gateway pre-flight validation");
      expect(result).toContain("no transaction was signed");
    });

    it("should surface the pre-flight report on success", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ status: 200, data: { valid: true, warnings: [] } }),
      );

      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: [RECIPIENT_A],
        amountPerRecipient: "0.01",
        preflight: true,
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      expect(result).toContain("Pre-flight validation");
      expect(result).toContain("Successfully sprayed");
    });
  });

  describe("sprayToken", () => {
    it("should use an EIP-2612 permit when the token supports it", async () => {
      const result = await provider.sprayToken(mockWalletProvider, {
        tokenAddress: TOKEN_ADDRESS,
        recipients: [RECIPIENT_A, RECIPIENT_B],
        amountPerRecipient: "100",
      });

      // permit tx + spray tx
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
      expect(mockSignTypedData).toHaveBeenCalledTimes(1);
      const typedData = mockSignTypedData.mock.calls[0][0];
      expect(typedData.primaryType).toBe("Permit");
      expect(typedData.domain).toMatchObject({
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        verifyingContract: TOKEN_ADDRESS,
      });
      expect(typedData.message.spender).toBe(SPRAAY_CONTRACT_ADDRESS);
      expect(result).toContain("EIP-2612 permit");
      expect(result).toContain("Successfully sprayed");
      expect(result).toContain("USDC");
    });

    it("should fall back to approve for non-permit tokens", async () => {
      setupReadContract({
        nonces: new Error("execution reverted"),
        symbol: "DAI",
        name: "Dai Stablecoin",
        decimals: 18,
      });

      const result = await provider.sprayToken(mockWalletProvider, {
        tokenAddress: TOKEN_ADDRESS,
        recipients: [RECIPIENT_A],
        amountPerRecipient: "100",
      });

      // approve tx + spray tx
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
      expect(mockSignTypedData).not.toHaveBeenCalled();
      expect(result).toContain("Token approval granted");
      expect(result).toContain("does not support EIP-2612 permit");
      expect(result).toContain("Successfully sprayed");
    });

    it("should fall back to approve when the permit does not take effect on-chain", async () => {
      // Allowance stays 0 even after the permit tx (e.g. an ERC-1271 smart-wallet
      // signature that permit's ecrecover does not accept).
      setupReadContract({ allowance: 0n });

      const result = await provider.sprayToken(mockWalletProvider, {
        tokenAddress: TOKEN_ADDRESS,
        recipients: [RECIPIENT_A],
        amountPerRecipient: "100",
      });

      // permit tx + approve tx + spray tx
      expect(mockSendTransaction).toHaveBeenCalledTimes(3);
      expect(result).toContain("Token approval granted");
      expect(result).toContain("Successfully sprayed");
    });

    it("should fall back to approve when typed-data signing fails", async () => {
      mockSignTypedData.mockRejectedValue(new Error("signTypedData not supported"));

      const result = await provider.sprayToken(mockWalletProvider, {
        tokenAddress: TOKEN_ADDRESS,
        recipients: [RECIPIENT_A],
        amountPerRecipient: "100",
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
      expect(result).toContain("Token approval granted");
      expect(result).toContain("Successfully sprayed");
    });

    it("should skip allowance handling if the allowance is sufficient", async () => {
      setupReadContract({ allowance: parseUnits("1000000", 6) });

      const result = await provider.sprayToken(mockWalletProvider, {
        tokenAddress: TOKEN_ADDRESS,
        recipients: [RECIPIENT_A],
        amountPerRecipient: "10",
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      expect(mockSignTypedData).not.toHaveBeenCalled();
      expect(result).not.toContain("permit");
      expect(result).not.toContain("approval");
    });
  });

  describe("sprayEthVariable", () => {
    it("should spray variable ETH amounts using the struct-based sprayETH", async () => {
      const result = await provider.sprayEthVariable(mockWalletProvider, {
        recipients: [RECIPIENT_A, RECIPIENT_B],
        amounts: ["0.01", "0.05"],
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      const callArgs = mockSendTransaction.mock.calls[0][0];
      expect(callArgs.data).toBe(
        encodeFunctionData({
          abi: SPRAAY_ABI,
          functionName: "sprayETH",
          args: [
            [
              { recipient: RECIPIENT_A, amount: parseUnits("0.01", 18) },
              { recipient: RECIPIENT_B, amount: parseUnits("0.05", 18) },
            ],
          ],
        }),
      );
      expect(result).toContain("Successfully sprayed variable ETH");
      expect(result).toContain("2 recipients");
    });

    it("should reject mismatched arrays", async () => {
      const result = await provider.sprayEthVariable(mockWalletProvider, {
        recipients: [RECIPIENT_A, RECIPIENT_B],
        amounts: ["0.01"],
      });

      expect(result).toContain("Error: recipients array length");
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("sprayTokenVariable", () => {
    it("should spray variable token amounts with permit and struct encoding", async () => {
      const result = await provider.sprayTokenVariable(mockWalletProvider, {
        tokenAddress: TOKEN_ADDRESS,
        recipients: [RECIPIENT_A, RECIPIENT_B],
        amounts: ["100", "200"],
      });

      // permit tx + spray tx
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
      const sprayCall = mockSendTransaction.mock.calls[1][0];
      expect(sprayCall.data).toBe(
        encodeFunctionData({
          abi: SPRAAY_ABI,
          functionName: "sprayToken",
          args: [
            TOKEN_ADDRESS,
            [
              { recipient: RECIPIENT_A, amount: parseUnits("100", 6) },
              { recipient: RECIPIENT_B, amount: parseUnits("200", 6) },
            ],
          ],
        }),
      );
      expect(result).toContain("Successfully sprayed variable USDC");
      expect(result).toContain("2 recipients");
    });
  });

  describe("validateBatch", () => {
    it("should post a BPA 1.0 body with a recipients key and return the verdict", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { valid: true, errors: [], warnings: [], summary: { total: "1.00" } },
        }),
      );

      const result = await provider.validateBatch(mockWalletProvider, {
        token: "USDC",
        recipients: [{ recipient: RECIPIENT_A, amount: "1.00" }],
        chain: "base",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_FREE_VALIDATE_BATCH_PATH}`,
        expect.objectContaining({ method: "POST" }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        bpa_version: SPRAAY_BPA_VERSION,
        chain: "base",
        token: "USDC",
        recipients: [{ to: RECIPIENT_A, amount: "1.00" }],
      });
      expect(body.payments).toBeUndefined();

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.validation.valid).toBe(true);
    });

    it("should report gateway unreachability without throwing", async () => {
      mockFetch.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

      const result = await provider.validateBatch(mockWalletProvider, {
        token: "USDC",
        recipients: [{ recipient: RECIPIENT_A, amount: "1.00" }],
        chain: "base",
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.note).toContain("on-chain batch actions remain available");
    });
  });

  describe("estimateBatch", () => {
    it("should call the free estimate endpoint with query parameters", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { estimate: { estimatedGasUSD: 0.15, protocolFeeUSD: 3 } },
        }),
      );

      const result = await provider.estimateBatch(mockWalletProvider, {
        recipients: 150,
        chain: "base",
        amount: "1000.00",
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(SPRAAY_FREE_ESTIMATE_BATCH_PATH);
      expect(calledUrl).toContain("recipients=150");
      expect(calledUrl).toContain("chain=base");
      expect(calledUrl).toContain("amount=1000.00");
      expect(calledUrl).not.toContain("token=");

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.estimate.estimate.protocolFeeUSD).toBe(3);
    });

    it("should omit the amount query parameter when not provided", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ status: 200, data: { estimate: { estimatedGasUSD: 0.15 } } }),
      );

      await provider.estimateBatch(mockWalletProvider, { recipients: 10, chain: "base" });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).not.toContain("amount=");
    });
  });

  describe("executeBatchGateway", () => {
    const batchArgs = {
      token: "USDC",
      recipients: [{ recipient: RECIPIENT_A, amount: "1.00" }],
      chain: "base",
    };

    it("should return directly when no payment is required", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ status: 200, data: { executed: true, batchId: "b-1" } }),
      );

      const result = await provider.executeBatchGateway(mockWalletProvider, batchArgs);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      // The gateway's execute handler expects {address, amount} entries plus sender
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        token: "USDC",
        recipients: [{ address: RECIPIENT_A, amount: "1.00" }],
        sender: WALLET_ADDRESS,
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.batchId).toBe("b-1");
    });

    it("should refuse to pay quotes above the configured limit", async () => {
      // 2 USDC quote vs default 1.0 limit
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 402,
          data: { accepts: [{ network: "base", asset: "0xusdc", maxAmountRequired: "2000000" }] },
        }),
      );

      const result = await provider.executeBatchGateway(mockWalletProvider, batchArgs);

      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Gateway payment exceeds limit");
      expect(parsed.details).toContain("No payment was made");
    });

    it("should settle the 402 challenge by signing with the wallet provider", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 402,
          data: { accepts: [{ network: "base", asset: "0xusdc", maxAmountRequired: "10000" }] },
        }),
      );
      const paymentProof = { transaction: "0xproof", network: "base" };
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse({
          status: 200,
          data: { executed: true, batchId: "b-2" },
          headers: {
            "payment-response": Buffer.from(JSON.stringify(paymentProof)).toString("base64"),
          },
        }),
      );

      const result = await provider.executeBatchGateway(mockWalletProvider, batchArgs);

      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        `${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_GATEWAY_BATCH_EXECUTE_PATH}`,
        expect.objectContaining({ method: "POST" }),
      );
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain("x402 payment");
      expect(parsed.paymentProof).toEqual(paymentProof);
    });

    it("should use a pre-funded payment header when configured", async () => {
      provider = new SpraayActionProvider({ x402PaymentHeader: "prefunded-header" });
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            status: 402,
            data: { accepts: [{ network: "base", asset: "0xusdc", maxAmountRequired: "10000" }] },
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ status: 200, data: { executed: true } }));

      const result = await provider.executeBatchGateway(mockWalletProvider, batchArgs);

      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const retryHeaders = mockFetch.mock.calls[1][1].headers;
      // v2 header with v1 fallback — the gateway middleware reads both
      expect(retryHeaders["Payment-Signature"]).toBe("prefunded-header");
      expect(retryHeaders["X-PAYMENT"]).toBe("prefunded-header");
      expect(retryHeaders["PAYMENT"]).toBeUndefined();
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it("should report gateway errors without paying", async () => {
      mockFetch.mockRejectedValue(new Error("socket hang up"));

      const result = await provider.executeBatchGateway(mockWalletProvider, batchArgs);

      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("Error calling the Spraay gateway");
    });

    it("should flag unsettled payments when the paid retry fails", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 402,
          data: { accepts: [{ network: "base", asset: "0xusdc", maxAmountRequired: "10000" }] },
        }),
      );
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse({ status: 500, data: { error: "internal" } }),
      );

      const result = await provider.executeBatchGateway(mockWalletProvider, batchArgs);

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("Payment was not settled");
    });
  });

  describe("createEscrow", () => {
    it("should create an escrow through the paid gateway endpoint", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 402,
          data: { accepts: [{ network: "base", asset: "0xusdc", maxAmountRequired: "10000" }] },
        }),
      );
      mockFetchWithPayment.mockResolvedValue(
        createMockResponse({ status: 200, data: { escrow: { id: "ESC-1" }, status: "created" } }),
      );

      const result = await provider.createEscrow(mockWalletProvider, {
        token: "USDC",
        amount: "250.00",
        beneficiary: RECIPIENT_A,
        arbiter: TOKEN_ADDRESS,
        description: "Milestone 1",
        conditions: ["Design approved", "Dev complete"],
        expiresIn: 72,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_GATEWAY_ESCROW_CREATE_PATH}`,
        expect.objectContaining({ method: "POST" }),
      );
      // The gateway requires depositor/beneficiary/token/amount; depositor
      // defaults to the connected wallet address
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        depositor: WALLET_ADDRESS,
        beneficiary: RECIPIENT_A,
        token: "USDC",
        amount: "250.00",
        arbiter: TOKEN_ADDRESS,
        description: "Milestone 1",
        conditions: ["Design approved", "Dev complete"],
        expiresIn: 72,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.escrow.id).toBe("ESC-1");
    });

    it("should reject depositor === beneficiary before paying anything", async () => {
      const result = await provider.createEscrow(mockWalletProvider, {
        token: "USDC",
        amount: "250.00",
        beneficiary: WALLET_ADDRESS,
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain("cannot be the same");
      expect(parsed.details).toContain("No payment was made");
    });

    it("should respect the payment limit for escrow creation", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 402,
          data: { accepts: [{ network: "base", asset: "0xusdc", maxAmountRequired: "5000000" }] },
        }),
      );

      const result = await provider.createEscrow(mockWalletProvider, {
        token: "USDC",
        amount: "250.00",
        beneficiary: RECIPIENT_A,
      });

      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Gateway payment exceeds limit");
    });
  });
});
