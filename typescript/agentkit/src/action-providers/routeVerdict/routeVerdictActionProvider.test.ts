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
import { routeVerdictActionProvider } from "./routeVerdictActionProvider";
import { RouteVerdictSchema } from "./schemas";

// The production 402 challenge for POST /v1/check (bazaar discovery
// extension trimmed; the payment requirement is byte-identical).
const CHALLENGE = {
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://route-verdict-production.up.railway.app/v1/check",
    "description": "Send any x402 resource URL, get a trust verdict on the endpoint itself. Returns TRUSTED / CAUTION / AVOID with a 0-100 score from an observation-only live probe (never pays the target): payment terms, Bazaar discovery-schema quality, CDP Bazaar and PayAI catalog presence, plus a diff against the previous check. Use this when an agent is about to pay an unfamiliar x402 endpoint and needs to know it is alive, honestly described, and unchanged first.",
    "mimeType": "application/json",
    "serviceName": "route-verdict",
    "tags": [
      "x402",
      "trust",
      "liveness",
      "monitoring",
      "verification",
      "agents"
    ]
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "50000",
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
  "resource_url": "https://token-verdict-production.up.railway.app/v1/verdict",
  "verdict": "TRUSTED",
  "score": 92,
  "reasons": [
    "Endpoint is live and answers with a parseable x402 challenge.",
    "Bazaar discovery schema is fully typed with a real example."
  ],
  "liveness": {
    "alive": true,
    "http_status": 402,
    "latency_ms": 210,
    "parses_as_x402": true
  },
  "terms": {
    "price": "$0.02",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F"
  },
  "schema_quality": {
    "score": 100,
    "deductions": []
  },
  "catalog": {
    "cdp_bazaar": true,
    "payai": true
  },
  "diff": {
    "changed": false,
    "note": "no prior check on record"
  }
};

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

describe("RouteVerdictActionProvider", () => {
  it("exposes exactly one action (AgentKit prefixes it with the class name)", () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const provider = routeVerdictActionProvider();
    const actions = provider.getActions(fakeWalletProvider(account));
    expect(actions.map(a => a.name)).toEqual(["RouteVerdictActionProvider_route_verdict"]);
  });

  it("supports Base EVM only", () => {
    const provider = routeVerdictActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" })).toBe(false);
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(false);
  });

  it("pays the real 402 challenge (EIP-3009) and returns the verdict", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockFetch(account, RESULT);
    const provider = routeVerdictActionProvider({ fetchImpl });
    const [action] = provider.getActions(fakeWalletProvider(account));

    const output = await action.invoke({ resource_url: RESULT.resource_url });
    const verdict = JSON.parse(output);
    expect(verdict.verdict).toBe("TRUSTED");
    expect(verdict.score).toBe(92);
    await expectSignedPayment(calls, account, "50000"); // $0.05 in micro-USDC
  });

  it("refuses to pay a challenge priced above the spend guard", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const repriced = { ...CHALLENGE, accepts: [{ ...CHALLENGE.accepts[0], amount: "60000" }] };
    const { calls, fetchImpl } = mockFetch(account, RESULT, repriced);
    const provider = routeVerdictActionProvider({ fetchImpl });
    const [action] = provider.getActions(fakeWalletProvider(account));

    const output = await action.invoke({ resource_url: RESULT.resource_url });
    expect(output).toContain("Error getting route verdict");
    expect(calls).toHaveLength(1);
  });

  it("surfaces upstream errors as an error string, not a throw", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const failingFetch = (async () =>
      new Response(JSON.stringify({ error: "bad url" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const provider = routeVerdictActionProvider({ fetchImpl: failingFetch });
    const [action] = provider.getActions(fakeWalletProvider(account));
    const output = await action.invoke({ resource_url: "https://example.com/x" });
    expect(output).toContain("Error getting route verdict");
    expect(output).toContain("422");
  });
});

describe("RouteVerdictSchema (mirrors POST /v1/check)", () => {
  it("accepts a full resource URL", () => {
    const parsed = RouteVerdictSchema.parse({ resource_url: "https://example.com/v1/paid" });
    expect(parsed.resource_url).toBe("https://example.com/v1/paid");
  });

  it("rejects non-URLs and a missing resource_url", () => {
    expect(() => RouteVerdictSchema.parse({ resource_url: "not a url" })).toThrow();
    expect(() => RouteVerdictSchema.parse({})).toThrow();
  });
});
