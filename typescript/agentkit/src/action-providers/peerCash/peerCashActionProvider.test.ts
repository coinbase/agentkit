import { PeerCashActionProvider, peerCashActionProvider } from "./peerCashActionProvider";
import { CashoutSchema, EstimateSchema, TopUpSchema, WithdrawSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { createCashClient, CashError } from "@zkp2p/cash";

jest.mock("@zkp2p/cash", () => {
  interface MockCashErrorShape {
    code: string;
    message: string;
    retryable: boolean;
    remediation: string;
    recovery?: unknown;
  }

  /**
   * Runtime stand-in for the SDK's CashError. Tests construct these with real
   * error codes; the provider only reads code, message, retryable,
   * remediation, and recovery.
   */
  class MockCashError extends Error {
    code: string;
    retryable: boolean;
    remediation: string;
    recovery?: unknown;

    /**
     * Constructor for the MockCashError class.
     *
     * @param shape - The error shape (code, message, retryable, remediation, recovery).
     */
    constructor(shape: MockCashErrorShape) {
      super(shape.message);
      this.name = "CashError";
      this.code = shape.code;
      this.retryable = shape.retryable;
      this.remediation = shape.remediation;
      if (shape.recovery) this.recovery = shape.recovery;
    }
  }

  return {
    createCashClient: jest.fn(),
    CashError: MockCashError,
    isCashError: (value: unknown) => value instanceof MockCashError,
    usdc: (amount: string | number) => {
      const [whole = "0", frac = ""] = String(amount).split(".");
      return BigInt(whole) * 1000000n + BigInt((frac + "000000").slice(0, 6));
    },
    capabilitiesToJson: jest.fn(value => value),
    cashErrorToJson: jest.fn((error: { code: string; recovery?: unknown }) => ({
      code: error.code,
      ...(error.recovery ? { recovery: error.recovery } : {}),
    })),
    estimateToJson: jest.fn((estimate: { amount: bigint }) => ({
      ...estimate,
      amount: estimate.amount.toString(),
    })),
    fillStatsToJson: jest.fn(value => value),
    orderToJson: jest.fn((order: { depositId: string; state: string }) => ({
      depositId: order.depositId,
      state: order.state,
    })),
  };
});

const mockCreateCashClient = createCashClient as jest.MockedFunction<typeof createCashClient>;

const MOCK_ADDRESS = "0x9876543210987654321098765432109876543210";
const MOCK_DEPOSIT_ID = "0x1111111111111111111111111111111111111111_42";
const MOCK_TX = {
  to: "0x2222222222222222222222222222222222222222" as `0x${string}`,
  data: "0xdeadbeef" as `0x${string}`,
  value: 0n,
  chainId: 8453,
};
const MOCK_ORDER = {
  depositId: MOCK_DEPOSIT_ID,
  state: "awaiting-buyer",
  fills: [],
  totalAmount: 250000000n,
  filledAmount: 0n,
  pendingAmount: 0n,
  returnedAmount: 0n,
  nextActions: ["wait", "withdraw"],
  isInFlight: true,
  explain: () => "Your order is live and waiting for a buyer.",
};

/**
 * Builds the mocked CashClient surface used across the tests.
 *
 * @returns An object with every client method the provider calls, as jest mocks.
 */
function buildMockClient() {
  return {
    capabilities: jest.fn(),
    fillStats: jest.fn(),
    estimate: jest.fn(),
    prepare: jest.fn(),
    finalizePreparedCashout: jest.fn(),
    prepareAccessPolicy: jest.fn(),
    order: jest.fn(),
    orders: jest.fn(),
    prepareWithdraw: jest.fn(),
    prepareTopUp: jest.fn(),
  };
}

describe("PeerCashActionProvider", () => {
  let mockClient: ReturnType<typeof buildMockClient>;
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let provider: PeerCashActionProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = buildMockClient();
    mockCreateCashClient.mockReturnValue(
      mockClient as unknown as ReturnType<typeof createCashClient>,
    );
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getName: jest.fn().mockReturnValue("mock_wallet_provider"),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
      sendTransaction: jest.fn().mockResolvedValue("0xhash1" as `0x${string}`),
      waitForTransactionReceipt: jest
        .fn()
        .mockResolvedValue({ status: "success", transactionHash: "0xhash1", logs: [] }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    provider = new PeerCashActionProvider();
  });

  describe("constructor", () => {
    it("defaults to the production environment", () => {
      expect(mockCreateCashClient).toHaveBeenCalledWith(
        expect.objectContaining({ environment: "production" }),
      );
    });

    it("forwards environment, referralCode, referrer, and rpcUrl", () => {
      peerCashActionProvider({
        environment: "staging",
        referralCode: "ABC123",
        referrer: "acme-app",
        rpcUrl: "https://base.example.com",
      });
      expect(mockCreateCashClient).toHaveBeenLastCalledWith({
        environment: "staging",
        referralCode: "ABC123",
        referrer: "acme-app",
        rpcUrl: "https://base.example.com",
      });
    });
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
    });

    it("does not support Base Sepolia", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
    });

    it("does not support other EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum" })).toBe(
        false,
      );
    });

    it("does not support non-EVM protocol families", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "base-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("estimate", () => {
    const ESTIMATE = {
      kind: "oracle-estimate",
      currency: "EUR",
      amount: 250000000n,
      rate: 0.92,
      receiveAmount: 230,
      asOf: 1700000000,
      eta: { seconds: 1800, label: "about 30 minutes" },
    };

    it("returns the oracle estimate with the ETA", async () => {
      mockClient.estimate.mockResolvedValue(ESTIMATE);

      const response = await provider.estimate({ amountUsdc: "250", currency: "EUR" });

      expect(mockClient.estimate).toHaveBeenCalledWith(
        { amount: 250000000n, currency: "EUR" },
        { includeEta: true },
      );
      expect(response).toContain("Approximately 230 EUR for 250 USDC");
      expect(response).toContain("not a locked");
      expect(response).toContain("about 30 minutes");
    });

    it("skips the ETA when includeEta is false", async () => {
      const { eta: _, ...withoutEta } = ESTIMATE;
      mockClient.estimate.mockResolvedValue(withoutEta);

      const response = await provider.estimate({
        amountUsdc: "250",
        currency: "EUR",
        includeEta: false,
      });

      expect(mockClient.estimate).toHaveBeenCalledWith(
        { amount: 250000000n, currency: "EUR" },
        { includeEta: false },
      );
      expect(response).not.toContain("Estimated time to first fill");
    });

    it("maps CashErrors to actionable messages", async () => {
      mockClient.estimate.mockRejectedValue(
        new CashError({
          code: "ORACLE_UNSUPPORTED_CURRENCY",
          message: "XYZ has no live Chainlink oracle feed; Peer Cash is market-rate only.",
          retryable: false,
          remediation: "Pick a currency listed in capabilities().",
        }),
      );

      const response = await provider.estimate({ amountUsdc: "250", currency: "XYZ" });

      expect(response).toContain("Error (ORACLE_UNSUPPORTED_CURRENCY)");
      expect(response).toContain("Remediation: Pick a currency listed in capabilities().");
      expect(response).toContain("Retryable: no");
    });
  });

  describe("capabilities", () => {
    const CAPABILITIES = {
      chainId: 8453,
      environment: "production",
      platforms: [{ platform: "venmo", currencies: ["USD"] }],
      currencies: ["USD"],
    };

    it("returns the catalog without fill stats by default", async () => {
      mockClient.capabilities.mockReturnValue(CAPABILITIES);

      const response = await provider.capabilities({});

      expect(response).toContain("environment: production");
      expect(response).toContain("venmo");
      expect(mockClient.fillStats).not.toHaveBeenCalled();
    });

    it("includes fill stats when requested", async () => {
      mockClient.capabilities.mockReturnValue(CAPABILITIES);
      mockClient.fillStats.mockResolvedValue({
        "venmo:USD": { fills: 42, medianFillSeconds: 900 },
      });

      const response = await provider.capabilities({ includeFillStats: true });

      expect(response).toContain("30-day fill stats");
      expect(response).toContain("venmo:USD");
    });

    it("fails open to the catalog when fill stats are unavailable", async () => {
      mockClient.capabilities.mockReturnValue(CAPABILITIES);
      mockClient.fillStats.mockRejectedValue(
        new CashError({
          code: "INDEXER_UNAVAILABLE",
          message: "The indexer could not be reached.",
          retryable: true,
          remediation: "Retry the read.",
        }),
      );

      const response = await provider.capabilities({ includeFillStats: true });

      expect(response).toContain("venmo");
      expect(response).toContain("Error (INDEXER_UNAVAILABLE)");
      expect(response).toContain("capabilities above are unaffected");
    });
  });

  describe("cashout", () => {
    const PREPARE_RESULT = {
      txs: [MOCK_TX, { ...MOCK_TX, data: "0xfeedface" as `0x${string}` }],
      steps: [
        { kind: "approve", description: "Allow the escrow to pull the USDC." },
        { kind: "createDeposit", description: "Create the protocol-held cash-out order." },
      ],
      register: { hashedOnchainIds: ["0xabc"] },
      accessPolicyRequired: false,
    };
    const CASHOUT_RESULT = {
      depositId: MOCK_DEPOSIT_ID,
      txHash: "0xhash2",
      escrowAddress: "0x3333333333333333333333333333333333333333",
      onchainDepositId: 42n,
      order: MOCK_ORDER,
    };

    beforeEach(() => {
      mockWallet.sendTransaction
        .mockResolvedValueOnce("0xhash1" as `0x${string}`)
        .mockResolvedValueOnce("0xhash2" as `0x${string}`)
        .mockResolvedValueOnce("0xhash3" as `0x${string}`);
      mockWallet.waitForTransactionReceipt.mockImplementation(async txHash => ({
        status: "success",
        transactionHash: txHash,
        logs: [{ address: "0x3333333333333333333333333333333333333333" }],
      }));
      mockClient.prepare.mockResolvedValue(PREPARE_RESULT);
      mockClient.finalizePreparedCashout.mockReturnValue(CASHOUT_RESULT);
    });

    it("submits the prepared transactions in order and finalizes", async () => {
      const response = await provider.cashout(mockWallet, {
        amountUsdc: "250",
        platform: "venmo",
        currency: "USD",
        payee: "@alice",
      });

      expect(mockClient.prepare).toHaveBeenCalledWith({
        amount: 250000000n,
        receive: { platform: "venmo", currency: "USD", payee: "@alice" },
      });
      expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(1, {
        to: MOCK_TX.to,
        data: MOCK_TX.data,
        value: 0n,
      });
      expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(2, {
        to: MOCK_TX.to,
        data: "0xfeedface",
        value: 0n,
      });
      expect(mockClient.finalizePreparedCashout).toHaveBeenCalledWith({
        transactionHash: "0xhash2",
        status: "success",
        logs: [{ address: "0x3333333333333333333333333333333333333333" }],
      });
      expect(response).toContain(`Created Peer Cash cash-out order ${MOCK_DEPOSIT_ID}`);
      expect(response).toContain("approve: 0xhash1");
      expect(response).toContain("createDeposit: 0xhash2");
      expect(response).toContain("awaiting-buyer");
    });

    it("passes a multi-currency receive leg through", async () => {
      await provider.cashout(mockWallet, {
        amountUsdc: "250",
        platform: "revolut",
        currencies: ["EUR", "GBP"],
        payee: "revtag",
      });

      expect(mockClient.prepare).toHaveBeenCalledWith({
        amount: 250000000n,
        receive: { platform: "revolut", currencies: ["EUR", "GBP"], payee: "revtag" },
      });
    });

    it("submits the access policy for restricted platforms", async () => {
      mockClient.prepare.mockResolvedValue({ ...PREPARE_RESULT, accessPolicyRequired: true });
      mockClient.prepareAccessPolicy.mockReturnValue(MOCK_TX);

      const response = await provider.cashout(mockWallet, {
        amountUsdc: "250",
        platform: "venmo",
        currency: "USD",
        payee: "@alice",
      });

      expect(mockClient.prepareAccessPolicy).toHaveBeenCalledWith(MOCK_DEPOSIT_ID);
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(3);
      expect(response).toContain("access policy was configured (transaction: 0xhash3)");
    });

    it("reports a reverted step without creating an order", async () => {
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "reverted",
        transactionHash: "0xhash1",
        logs: [],
      });

      const response = await provider.cashout(mockWallet, {
        amountUsdc: "250",
        platform: "venmo",
        currency: "USD",
        payee: "@alice",
      });

      expect(response).toContain("Error: the approve transaction of the cash-out reverted");
      expect(response).toContain("No cash-out order was created");
      expect(mockClient.finalizePreparedCashout).not.toHaveBeenCalled();
    });

    it("keeps the deposit and points at configure_access_policy when the policy fails", async () => {
      mockClient.prepare.mockResolvedValue({ ...PREPARE_RESULT, accessPolicyRequired: true });
      mockClient.prepareAccessPolicy.mockReturnValue(MOCK_TX);
      mockWallet.waitForTransactionReceipt
        .mockResolvedValueOnce({ status: "success", transactionHash: "0xhash1", logs: [] })
        .mockResolvedValueOnce({ status: "success", transactionHash: "0xhash2", logs: [] })
        .mockResolvedValueOnce({ status: "failed", transactionHash: "0xhash3", logs: [] });

      const response = await provider.cashout(mockWallet, {
        amountUsdc: "250",
        platform: "venmo",
        currency: "USD",
        payee: "@alice",
      });

      expect(response).toContain(`Created Peer Cash cash-out order ${MOCK_DEPOSIT_ID}`);
      expect(response).toContain("access policy transaction reverted");
      expect(response).toContain("never create another cash-out");
      expect(response).toContain("configure_access_policy");
    });

    it("maps CashErrors from prepare", async () => {
      mockClient.prepare.mockRejectedValue(
        new CashError({
          code: "AMOUNT_BELOW_MINIMUM",
          message: "The amount is below the protocol minimum.",
          retryable: false,
          remediation: "Cash out at least the minimum from capabilities().",
        }),
      );

      const response = await provider.cashout(mockWallet, {
        amountUsdc: "0.5",
        platform: "venmo",
        currency: "USD",
        payee: "@alice",
      });

      expect(response).toContain("Error (AMOUNT_BELOW_MINIMUM)");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("orderStatus", () => {
    it("returns the state, explanation, and next actions", async () => {
      mockClient.order.mockResolvedValue(MOCK_ORDER);

      const response = await provider.orderStatus({ depositId: MOCK_DEPOSIT_ID });

      expect(mockClient.order).toHaveBeenCalledWith(MOCK_DEPOSIT_ID);
      expect(response).toContain(`Order ${MOCK_DEPOSIT_ID} is awaiting-buyer`);
      expect(response).toContain("waiting for a buyer");
      expect(response).toContain("Next actions: wait, withdraw");
    });

    it("maps ORDER_NOT_FOUND", async () => {
      mockClient.order.mockRejectedValue(
        new CashError({
          code: "ORDER_NOT_FOUND",
          message: "No order exists for that deposit id.",
          retryable: false,
          remediation: "Check the deposit id.",
        }),
      );

      const response = await provider.orderStatus({ depositId: "bogus" });

      expect(response).toContain("Error (ORDER_NOT_FOUND)");
    });
  });

  describe("listOrders", () => {
    it("defaults to the connected wallet address", async () => {
      mockClient.orders.mockResolvedValue([MOCK_ORDER]);

      const response = await provider.listOrders(mockWallet, {});

      expect(mockClient.orders).toHaveBeenCalledWith(MOCK_ADDRESS, {});
      expect(response).toContain(`Found 1 Peer Cash order(s) for ${MOCK_ADDRESS}`);
      expect(response).toContain(MOCK_DEPOSIT_ID);
    });

    it("uses an explicit address and the in-flight filter", async () => {
      mockClient.orders.mockResolvedValue([]);
      const other = "0x1234567890123456789012345678901234567890";

      const response = await provider.listOrders(mockWallet, {
        address: other,
        inFlightOnly: true,
      });

      expect(mockClient.orders).toHaveBeenCalledWith(other, { inFlight: true });
      expect(response).toBe(`No Peer Cash orders found for ${other}.`);
    });
  });

  describe("withdraw", () => {
    it("closes the order fully when no amount is given", async () => {
      mockClient.prepareWithdraw.mockResolvedValue({
        txs: [MOCK_TX, MOCK_TX],
        steps: [
          { kind: "pruneExpiredIntents", description: "Prune expired intents." },
          { kind: "withdrawDeposit", description: "Withdraw the deposit." },
        ],
      });
      mockWallet.sendTransaction
        .mockResolvedValueOnce("0xhash1" as `0x${string}`)
        .mockResolvedValueOnce("0xhash2" as `0x${string}`);

      const response = await provider.withdraw(mockWallet, { depositId: MOCK_DEPOSIT_ID });

      expect(mockClient.prepareWithdraw).toHaveBeenCalledWith(MOCK_DEPOSIT_ID, {});
      expect(response).toContain(`Closed order ${MOCK_DEPOSIT_ID}`);
      expect(response).toContain("pruneExpiredIntents: 0xhash1");
      expect(response).toContain("withdrawDeposit: 0xhash2");
    });

    it("withdraws a partial amount", async () => {
      mockClient.prepareWithdraw.mockResolvedValue({
        txs: [MOCK_TX],
        steps: [{ kind: "removeFunds", description: "Withdraw part of the deposit." }],
      });

      const response = await provider.withdraw(mockWallet, {
        depositId: MOCK_DEPOSIT_ID,
        amountUsdc: "100",
      });

      expect(mockClient.prepareWithdraw).toHaveBeenCalledWith(MOCK_DEPOSIT_ID, {
        amount: 100000000n,
      });
      expect(response).toContain(`Withdrew 100 USDC from order ${MOCK_DEPOSIT_ID}`);
    });

    it("reports a reverted withdrawal step", async () => {
      mockClient.prepareWithdraw.mockResolvedValue({
        txs: [MOCK_TX],
        steps: [{ kind: "withdrawDeposit", description: "Withdraw the deposit." }],
      });
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "reverted",
        transactionHash: "0xhash1",
        logs: [],
      });

      const response = await provider.withdraw(mockWallet, { depositId: MOCK_DEPOSIT_ID });

      expect(response).toContain("Error: the withdrawDeposit transaction of the withdrawal");
      expect(response).toContain("order_status");
    });

    it("maps NOTHING_TO_WITHDRAW", async () => {
      mockClient.prepareWithdraw.mockRejectedValue(
        new CashError({
          code: "NOTHING_TO_WITHDRAW",
          message: "The order has no withdrawable funds.",
          retryable: false,
          remediation: "Check the order state.",
        }),
      );

      const response = await provider.withdraw(mockWallet, { depositId: MOCK_DEPOSIT_ID });

      expect(response).toContain("Error (NOTHING_TO_WITHDRAW)");
    });
  });

  describe("topUp", () => {
    it("submits the prepared top up plan", async () => {
      mockClient.prepareTopUp.mockResolvedValue({
        txs: [MOCK_TX, MOCK_TX],
        steps: [
          { kind: "approve", description: "Allow the escrow to pull the USDC." },
          { kind: "addFunds", description: "Add funds to the deposit." },
        ],
      });
      mockWallet.sendTransaction
        .mockResolvedValueOnce("0xhash1" as `0x${string}`)
        .mockResolvedValueOnce("0xhash2" as `0x${string}`);

      const response = await provider.topUp(mockWallet, {
        depositId: MOCK_DEPOSIT_ID,
        amountUsdc: "100",
      });

      expect(mockClient.prepareTopUp).toHaveBeenCalledWith(MOCK_DEPOSIT_ID, 100000000n);
      expect(response).toContain(`Added 100 USDC to order ${MOCK_DEPOSIT_ID}`);
      expect(response).toContain("addFunds: 0xhash2");
    });

    it("reports a reverted top up without changing the order", async () => {
      mockClient.prepareTopUp.mockResolvedValue({
        txs: [MOCK_TX],
        steps: [{ kind: "addFunds", description: "Add funds to the deposit." }],
      });
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "reverted",
        transactionHash: "0xhash1",
        logs: [],
      });

      const response = await provider.topUp(mockWallet, {
        depositId: MOCK_DEPOSIT_ID,
        amountUsdc: "100",
      });

      expect(response).toContain("Error: the addFunds transaction of the top up reverted");
      expect(response).toContain("The order is unchanged");
    });
  });

  describe("configureAccessPolicy", () => {
    it("submits and confirms the policy transaction", async () => {
      mockClient.prepareAccessPolicy.mockReturnValue(MOCK_TX);

      const response = await provider.configureAccessPolicy(mockWallet, {
        depositId: MOCK_DEPOSIT_ID,
      });

      expect(mockClient.prepareAccessPolicy).toHaveBeenCalledWith(MOCK_DEPOSIT_ID);
      expect(response).toContain(`Access policy configured for order ${MOCK_DEPOSIT_ID}`);
    });

    it("reports a reverted policy transaction", async () => {
      mockClient.prepareAccessPolicy.mockReturnValue(MOCK_TX);
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "reverted",
        transactionHash: "0xhash1",
        logs: [],
      });

      const response = await provider.configureAccessPolicy(mockWallet, {
        depositId: MOCK_DEPOSIT_ID,
      });

      expect(response).toContain("Error: the access policy transaction reverted");
      expect(response).toContain("never create another cash-out");
    });

    it("maps CashErrors from prepareAccessPolicy", async () => {
      mockClient.prepareAccessPolicy.mockImplementation(() => {
        throw new CashError({
          code: "ORDER_NOT_FOUND",
          message: "No order exists for that deposit id.",
          retryable: false,
          remediation: "Check the deposit id.",
        });
      });

      const response = await provider.configureAccessPolicy(mockWallet, {
        depositId: "bogus",
      });

      expect(response).toContain("Error (ORDER_NOT_FOUND)");
    });
  });

  describe("schemas", () => {
    it("requires exactly one of currency or currencies", () => {
      const base = { amountUsdc: "250", platform: "venmo", payee: "@alice" };
      expect(CashoutSchema.safeParse({ ...base, currency: "USD" }).success).toBe(true);
      expect(CashoutSchema.safeParse({ ...base, currencies: ["EUR", "GBP"] }).success).toBe(true);
      expect(CashoutSchema.safeParse(base).success).toBe(false);
      expect(
        CashoutSchema.safeParse({ ...base, currency: "USD", currencies: ["EUR"] }).success,
      ).toBe(false);
    });

    it("rejects malformed USDC amounts", () => {
      expect(EstimateSchema.safeParse({ amountUsdc: "250", currency: "USD" }).success).toBe(true);
      expect(EstimateSchema.safeParse({ amountUsdc: "12.34", currency: "USD" }).success).toBe(true);
      expect(EstimateSchema.safeParse({ amountUsdc: "-5", currency: "USD" }).success).toBe(false);
      expect(EstimateSchema.safeParse({ amountUsdc: "1.1234567", currency: "USD" }).success).toBe(
        false,
      );
      expect(EstimateSchema.safeParse({ amountUsdc: "usd", currency: "USD" }).success).toBe(false);
    });

    it("rejects lowercase or malformed currency codes", () => {
      expect(EstimateSchema.safeParse({ amountUsdc: "250", currency: "usd" }).success).toBe(false);
      expect(EstimateSchema.safeParse({ amountUsdc: "250", currency: "USDT" }).success).toBe(false);
    });

    it("allows omitting the withdraw amount but validates it when present", () => {
      expect(WithdrawSchema.safeParse({ depositId: MOCK_DEPOSIT_ID }).success).toBe(true);
      expect(
        WithdrawSchema.safeParse({ depositId: MOCK_DEPOSIT_ID, amountUsdc: "10" }).success,
      ).toBe(true);
      expect(
        WithdrawSchema.safeParse({ depositId: MOCK_DEPOSIT_ID, amountUsdc: "ten" }).success,
      ).toBe(false);
    });

    it("requires an amount for top ups", () => {
      expect(TopUpSchema.safeParse({ depositId: MOCK_DEPOSIT_ID }).success).toBe(false);
      expect(TopUpSchema.safeParse({ depositId: MOCK_DEPOSIT_ID, amountUsdc: "10" }).success).toBe(
        true,
      );
    });
  });
});
