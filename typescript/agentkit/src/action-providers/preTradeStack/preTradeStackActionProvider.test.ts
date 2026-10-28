/**
 * Provider tests. ALL payments are mocked: fetch is stubbed (first call
 * replays the 402 challenge captured from production, second returns an
 * example response in the service's documented shape), and the wallet is
 * a throwaway account generated at test time. The real x402 client stack
 * (the @x402/fetch wrapper and the @x402/evm exact scheme) runs against
 * the stub, so the paid-flow test verifies a genuine EIP-3009
 * authorization signature. No key material lives in this repo and no
 * test touches the network.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { preTradeStackActionProvider } from "./preTradeStackActionProvider";
import {
  CounterpartyReportSchema,
  PreTradeGuardSchema,
  ReceiptVerifySchema,
} from "./schemas";

// The production 402 challenge for POST /v1/pre-trade-guard (bazaar
// discovery extension trimmed; the payment requirement is
// byte-identical).
const CHALLENGE = {
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://stall-row-production.up.railway.app/v1/pre-trade-guard",
    "description": "Pre-Trade Guard \u2014 before you pay an x402 listing, screen the payTo you are about to pay: its Verdict Index catalog history (first seen, payTo rotations, listings added or removed across the snapshots held), an OFAC SDN exact-match check, and the wallet's Base age and activity, combined into PROCEED, CAUTION, or ABORT with itemized reasons. Use this when an agent is about to pay a payTo it has never paid before.",
    "mimeType": "application/json",
    "serviceName": "stall-row",
    "tags": [
      "x402",
      "security",
      "sanctions",
      "verdict",
      "payments",
      "agents"
    ]
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "5000",
      "payTo": "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USD Coin",
        "version": "2"
      }
    }
  ]
};

// An example response in the service's documented shape.
const RESULT = {
  "pay_to": "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F",
  "verdict": "PROCEED",
  "risk": 8,
  "reasons": [
    "Catalog history held across snapshots; no payTo rotation.",
    "No OFAC SDN exact match.",
    "Wallet has aged Base activity."
  ],
  "catalog_history": {
    "status": "ok",
    "ever_listed": true,
    "listed_now": 24
  },
  "sanctions": {
    "status": "ok",
    "match": false
  },
  "wallet": {
    "status": "ok"
  }
};

const SELLER = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F";

const PAY_TO = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");

interface RecordedCall {
  url: string;
  headers: Headers;
}

function mockFetch(account: { address: string }, payload: unknown, challenge: unknown = CHALLENGE) {
  const calls: RecordedCall[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    calls.push({ url: request.url, headers: request.headers });
    if (calls.length === 1) {
      return new Response("{}", {
        status: 402,
        headers: {
          "content-type": "application/json",
          "payment-required": b64(challenge),
        },
      });
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "payment-response": b64({
          success: true,
          transaction: `0x${"ab".repeat(32)}`,
          network: "eip155:8453",
          payer: account.address,
        }),
      },
    });
  };
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function fakeWalletProvider(account: ReturnType<typeof privateKeyToAccount>) {
  return {
    getName: () => "provider-test-wallet",
    getAddress: async () => account.address,
    toSigner: () => account,
    getNetwork: () => ({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
  } as unknown as EvmWalletProvider;
}

async function expectSignedPayment(calls: RecordedCall[], account: { address: string }, amount: string) {
  expect(calls).toHaveLength(2);
  expect(calls[0].headers.get("payment-signature")).toBeNull();
  const header = calls[1].headers.get("payment-signature");
  expect(header).toBeTruthy();
  const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
  expect(payload.x402Version).toBe(2);
  expect(payload.accepted.amount).toBe(amount);
  expect(payload.accepted.asset).toBe(USDC);
  expect(payload.accepted.network).toBe("eip155:8453");
  const auth = payload.payload.authorization;
  expect(auth.from).toBe(account.address);
  expect(auth.to).toBe(PAY_TO);
  expect(auth.value).toBe(amount);
  expect(BigInt(auth.validAfter)).toBeGreaterThan(0n);
  const recovered = await recoverTypedDataAddress({
    domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: auth.from,
      to: auth.to,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce,
    },
    signature: payload.payload.signature,
  });
  expect(recovered).toBe(account.address);
}

describe("PreTradeStackActionProvider", () => {
  it("exposes exactly three actions (AgentKit prefixes them with the class name)", () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const provider = preTradeStackActionProvider();
    const actions = provider.getActions(fakeWalletProvider(account));
    expect(actions.map(a => a.name)).toEqual([
      "PreTradeStackActionProvider_pre_trade_guard",
      "PreTradeStackActionProvider_counterparty_report",
      "PreTradeStackActionProvider_receipt_verify",
    ]);
  });

  it("supports Base EVM only", () => {
    const provider = preTradeStackActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" })).toBe(false);
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(false);
  });

  it("pre_trade_guard pays the real 402 challenge (EIP-3009) and returns the verdict", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockFetch(account, RESULT);
    const provider = preTradeStackActionProvider({ fetchImpl });
    const [action] = provider.getActions(fakeWalletProvider(account));

    const output = await action.invoke({ pay_to: SELLER });
    const result = JSON.parse(output);
    expect(result.verdict).toBe("PROCEED");
    await expectSignedPayment(calls, account, "5000"); // $0.005 in micro-USDC
  });

  it("pre_trade_guard refuses a challenge priced above the spend guard", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const repriced = { ...CHALLENGE, accepts: [{ ...CHALLENGE.accepts[0], amount: "6000" }] };
    const { calls, fetchImpl } = mockFetch(account, RESULT, repriced);
    const provider = preTradeStackActionProvider({ fetchImpl });
    const [action] = provider.getActions(fakeWalletProvider(account));

    const output = await action.invoke({ pay_to: SELLER });
    expect(output).toContain("Error screening payTo");
    expect(calls).toHaveLength(1);
  });

  it("surfaces upstream errors as an error string, not a throw", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const failingFetch = (async () =>
      new Response(JSON.stringify({ error: "pay_to must be a 0x EVM address" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const provider = preTradeStackActionProvider({ fetchImpl: failingFetch });
    const actions = provider.getActions(fakeWalletProvider(account));
    const output = await actions[2].invoke({ tx_hash: `0x${"00".repeat(32)}` });
    expect(output).toContain("Error verifying receipt");
    expect(output).toContain("422");
  });
});

describe("PreTradeStack schemas (mirror StallRow's contracts)", () => {
  it("PreTradeGuardSchema requires a 0x pay_to and accepts optional context", () => {
    expect(PreTradeGuardSchema.parse({ pay_to: SELLER }).pay_to).toBe(SELLER);
    expect(
      PreTradeGuardSchema.parse({ pay_to: SELLER, amount: 20000, network: "eip155:8453" }).amount,
    ).toBe(20000);
    expect(() => PreTradeGuardSchema.parse({ pay_to: "0x123" })).toThrow();
    expect(() => PreTradeGuardSchema.parse({})).toThrow();
  });

  it("CounterpartyReportSchema defaults chain to base", () => {
    expect(CounterpartyReportSchema.parse({ pay_to: SELLER }).chain).toBe("base");
    expect(() => CounterpartyReportSchema.parse({ pay_to: "nope" })).toThrow();
  });

  it("ReceiptVerifySchema requires 0x + 64 hex", () => {
    const hash = `0x${"ab".repeat(32)}`;
    expect(ReceiptVerifySchema.parse({ tx_hash: hash }).tx_hash).toBe(hash);
    expect(() => ReceiptVerifySchema.parse({ tx_hash: "0x1234" })).toThrow();
  });
});
