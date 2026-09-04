/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { privateKeyToAccount } from "viem/accounts";
import { EvmWalletProvider } from "../../wallet-providers";
import { agentGuildActionProvider } from "./agentGuildActionProvider";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TREASURY = "0xaa4E3ba0Eb5f564cAb54dDC08f5BaAfb3D4cA8E5";
const TEST_PRIVATE_KEY = `0x${"1".padStart(64, "0")}` as `0x${string}`;

describe("Agent Guild official x402 client interoperability", () => {
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("signs only the exact approved requirement and returns settlement evidence", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const walletProvider = {
      toSigner: jest.fn().mockReturnValue(account),
      readContract: jest.fn(),
    } as unknown as EvmWalletProvider;
    const provider = agentGuildActionProvider({
      baseUrl: "https://guild.example",
      allowPaymentsToOverriddenBaseUrl: true,
      maxPaymentUsdc: 0.01,
    });
    const url = "https://guild.example/check?capability=code-review&signed=false&ttl_seconds=3600";
    const selectedPaymentOption = {
      scheme: "exact" as const,
      network: "eip155:8453" as const,
      asset: BASE_USDC,
      amount: "10000",
      payTo: TREASURY,
      maxTimeoutSeconds: 300,
      extra: { name: "USD Coin", version: "2" },
    };
    const paymentRequired = {
      x402Version: 2,
      error: "payment required",
      resource: {
        url,
        description: "Agent Guild trust decision",
        mimeType: "application/json",
      },
      accepts: [selectedPaymentOption],
      extensions: {},
    };
    const settlement = {
      success: true,
      transaction: `0x${"2".repeat(64)}`,
      network: "eip155:8453",
      payer: account.address,
    };
    let callCount = 0;

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(JSON.stringify({ error: "payment required" }), {
          status: 402,
          headers: {
            "content-type": "application/json",
            "payment-required": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
          },
        });
      }

      const headers = input instanceof Request ? input.headers : new Headers(init?.headers);
      const encodedPayload = headers.get("payment-signature");
      expect(encodedPayload).toBeTruthy();
      const paymentPayload = JSON.parse(atob(encodedPayload!));
      expect(paymentPayload.accepted).toEqual(selectedPaymentOption);
      expect(paymentPayload.resource.url).toBe(url);

      return new Response(JSON.stringify({ capability: "code-review", status: "supply" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "payment-response": Buffer.from(JSON.stringify(settlement)).toString("base64"),
        },
      });
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

    expect(callCount).toBe(2);
    expect(result.success).toBe(true);
    expect(result.paid).toBe(true);
    expect(result.settlementStatus).toBe("evidence_returned");
    expect(result.settlement).toEqual(settlement);
  });
});
