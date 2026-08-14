/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { EvmWalletProvider } from "../../wallet-providers";
import { agentGuildActionProvider, AgentGuildActionProvider } from "./agentGuildActionProvider";

let mockSelector: ((version: number, requirements: PaymentOption[]) => PaymentOption) | undefined;
let mockPolicy: ((version: number, requirements: PaymentOption[]) => PaymentOption[]) | undefined;
let mockBeforePayment:
  | ((context: {
      paymentRequired: { resource: { url: string } };
      selectedRequirements: PaymentOption;
    }) => Promise<void | { abort: true; reason: string }>)
  | undefined;
const mockWrapFetchWithPayment = jest.fn();
const mockRegisterExactEvmScheme = jest.fn();

jest.mock("@x402/fetch", () => ({
  x402Client: class MockX402Client {
    /** Captures the requirements selector installed by the provider. */
    constructor(selector: (version: number, requirements: PaymentOption[]) => PaymentOption) {
      mockSelector = selector;
    }

    /** Captures the policy installed by the provider. */
    registerPolicy(policy: (version: number, requirements: PaymentOption[]) => PaymentOption[]) {
      mockPolicy = policy;
      return this;
    }

    /** Captures the final pre-signing guard installed by the provider. */
    onBeforePaymentCreation(
      hook: (context: {
        paymentRequired: { resource: { url: string } };
        selectedRequirements: PaymentOption;
      }) => Promise<void | { abort: true; reason: string }>,
    ) {
      mockBeforePayment = hook;
      return this;
    }
  },
  wrapFetchWithPayment: (...args: unknown[]) => mockWrapFetchWithPayment(...args),
}));

jest.mock("@x402/evm/exact/client", () => ({
  registerExactEvmScheme: (...args: unknown[]) => mockRegisterExactEvmScheme(...args),
}));

interface PaymentOption {
  scheme: "exact";
  network: "eip155:8453";
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TREASURY = "0xaa4E3ba0Eb5f564cAb54dDC08f5BaAfb3D4cA8E5";
const selectedPaymentOption: PaymentOption = {
  scheme: "exact",
  network: "eip155:8453",
  asset: BASE_USDC,
  amount: "10000",
  payTo: TREASURY,
  maxTimeoutSeconds: 300,
  extra: { name: "USD Coin", version: "2" },
};

const originalFetch = global.fetch;

describe("AgentGuildActionProvider", () => {
  let provider: AgentGuildActionProvider;
  let walletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelector = undefined;
    mockPolicy = undefined;
    mockBeforePayment = undefined;
    provider = agentGuildActionProvider({
      baseUrl: "https://guild.example",
      allowPaymentsToOverriddenBaseUrl: true,
      maxPaymentUsdc: 0.01,
    });
    walletProvider = {
      toSigner: jest
        .fn()
        .mockReturnValue({ address: "0x1111111111111111111111111111111111111111" }),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("quotes a trust decision without constructing a payment client", async () => {
    const paymentRequired = {
      x402Version: 2,
      resource: {
        url: "https://guild.example/check?capability=code-review&signed=false&ttl_seconds=3600",
      },
      accepts: [selectedPaymentOption],
    };
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: "payment required" }), {
        status: 402,
        headers: {
          "content-type": "application/json",
          "payment-required": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
        },
      }),
    );

    const result = JSON.parse(
      await provider.quoteAgentTrust({
        capability: "code-review",
        signed: false,
        ttlSeconds: 3600,
      }),
    );

    expect(result.status).toBe("payment_required");
    expect(result.paid).toBe(false);
    expect(result.acceptablePaymentOptions).toEqual([selectedPaymentOption]);
    expect(mockWrapFetchWithPayment).not.toHaveBeenCalled();
  });

  it("binds a payment-safety quote to the exact contemplated payment", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ available: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await provider.quotePaymentSafety({
      asset: BASE_USDC,
      amount: "500000",
      payTo: TREASURY,
      resource: "https://jobs.example/task/123",
      capability: "code-review",
      maxRisk: 20,
      minConfidence: 0.8,
      ttlSeconds: 300,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://guild.example/wallet-binding/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payment: {
            scheme: "exact",
            network: "eip155:8453",
            asset: BASE_USDC,
            amount: "500000",
            pay_to: TREASURY,
            resource: "https://jobs.example/task/123",
          },
          capability: "code-review",
          policy: { max_risk: 20, min_confidence: 0.8 },
          ttl_seconds: 300,
        }),
      }),
    );
  });

  it("does not label a wrong-asset or over-cap 402 option as acceptable", async () => {
    const paymentRequired = {
      x402Version: 2,
      resource: { url: "https://guild.example/check?capability=research" },
      accepts: [
        { ...selectedPaymentOption, asset: "0x2222222222222222222222222222222222222222" },
        { ...selectedPaymentOption, amount: "10001" },
      ],
    };
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: "payment required" }), {
        status: 402,
        headers: {
          "content-type": "application/json",
          "payment-required": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
        },
      }),
    );

    const result = JSON.parse(
      await provider.quoteAgentTrust({ capability: "research", signed: false, ttlSeconds: 3600 }),
    );

    expect(result.paid).toBe(false);
    expect(result.error).toContain("No compatible");
    expect(mockWrapFetchWithPayment).not.toHaveBeenCalled();
  });

  it("rejects an over-cap quote before constructing a payment payload", async () => {
    const result = JSON.parse(
      await provider.purchaseAgentTrust(walletProvider, {
        capability: "code-review",
        signed: false,
        ttlSeconds: 3600,
        selectedPaymentOption: { ...selectedPaymentOption, amount: "10001" },
        confirmPayment: true,
      }),
    );

    expect(result.paid).toBe(false);
    expect(result.settlementStatus).toBe("not_attempted");
    expect(result.error).toContain("exceeds");
    expect(walletProvider.toSigner).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation even when the method is called directly", async () => {
    const result = JSON.parse(
      await provider.purchaseAgentTrust(walletProvider, {
        capability: "code-review",
        signed: false,
        ttlSeconds: 3600,
        selectedPaymentOption,
        confirmPayment: false,
      } as never),
    );

    expect(result.paid).toBe(false);
    expect(result.settlementStatus).toBe("not_attempted");
    expect(result.error).toContain("confirmPayment=true");
    expect(walletProvider.toSigner).not.toHaveBeenCalled();
  });

  it("keeps an overridden service root quote-only unless payment is separately enabled", async () => {
    const quoteOnlyProvider = agentGuildActionProvider({
      baseUrl: "https://guild.example",
      maxPaymentUsdc: 0.01,
    });
    const result = JSON.parse(
      await quoteOnlyProvider.purchaseAgentTrust(walletProvider, {
        capability: "code-review",
        signed: false,
        ttlSeconds: 3600,
        selectedPaymentOption,
        confirmPayment: true,
      }),
    );

    expect(result.paid).toBe(false);
    expect(result.settlementStatus).toBe("not_attempted");
    expect(result.error).toContain("allowPaymentsToOverriddenBaseUrl=true");
    expect(walletProvider.toSigner).not.toHaveBeenCalled();
  });

  it("aborts before signing when the live 402 no longer matches the exact quote", async () => {
    mockWrapFetchWithPayment.mockImplementation(() => async (url: string) => {
      const live = { ...selectedPaymentOption, amount: "9999" };
      const filtered = mockPolicy?.(2, [live]) ?? [];
      mockSelector?.(2, filtered);
      throw new Error(`unexpected payment creation for ${url}`);
    });

    const result = JSON.parse(
      await provider.purchaseAgentTrust(walletProvider, {
        capability: "code-review",
        signed: false,
        ttlSeconds: 3600,
        selectedPaymentOption,
        confirmPayment: true,
      }),
    );

    expect(result.paid).toBe(false);
    expect(result.settlementStatus).toBe("not_attempted");
    expect(result.error).toContain("exactly one approved option");
  });

  it("aborts when the live resource URL changes even if the payment option is unchanged", async () => {
    mockWrapFetchWithPayment.mockImplementation(() => async () => {
      const filtered = mockPolicy?.(2, [selectedPaymentOption]) ?? [];
      const selected = mockSelector?.(2, filtered);
      const hookResult = await mockBeforePayment?.({
        paymentRequired: { resource: { url: "https://guild.example/check?capability=other" } },
        selectedRequirements: selected!,
      });
      if (hookResult && "abort" in hookResult) {
        throw new Error(hookResult.reason);
      }
      throw new Error("payment should have been aborted");
    });

    const result = JSON.parse(
      await provider.purchaseAgentTrust(walletProvider, {
        capability: "code-review",
        signed: false,
        ttlSeconds: 3600,
        selectedPaymentOption,
        confirmPayment: true,
      }),
    );

    expect(result.paid).toBe(false);
    expect(result.settlementStatus).toBe("not_attempted");
    expect(result.error).toContain("requirements changed");
  });

  it("reports settlement as unknown if transport fails after payment creation is authorized", async () => {
    mockWrapFetchWithPayment.mockImplementation(() => async (url: string) => {
      const filtered = mockPolicy?.(2, [selectedPaymentOption]) ?? [];
      const selected = mockSelector?.(2, filtered);
      await mockBeforePayment?.({
        paymentRequired: { resource: { url } },
        selectedRequirements: selected!,
      });
      throw new Error("network connection lost after signing began");
    });

    const result = JSON.parse(
      await provider.purchaseAgentTrust(walletProvider, {
        capability: "code-review",
        signed: false,
        ttlSeconds: 3600,
        selectedPaymentOption,
        confirmPayment: true,
      }),
    );

    expect(result.paid).toBe("unknown");
    expect(result.settlementStatus).toBe("unknown");
    expect(result.error).toContain("network connection lost");
  });

  it("only supports Base mainnet EVM wallets", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
      false,
    );
  });
});
