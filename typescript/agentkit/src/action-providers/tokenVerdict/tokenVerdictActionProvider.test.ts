/**
 * Provider tests. ALL payments are mocked: fetch is stubbed (first call
 * replays the 402 challenge captured from production, second returns the
 * service engine's published example verdict), and the wallet is a
 * throwaway account generated at test time. The real x402 client stack
 * (the @x402/fetch wrapper and the @x402/evm exact scheme) runs against
 * the stub, so the paid-flow test verifies a genuine EIP-3009
 * authorization signature. No key material lives in this repo and no
 * test touches the network.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { tokenVerdictActionProvider } from "./tokenVerdictActionProvider";
import { TokenVerdictSchema } from "./schemas";

// The production 402 challenge for POST /v1/verdict (the service's
// bazaar discovery extension is trimmed; the payment requirement is
// byte-identical to production).
const CHALLENGE = {
  x402Version: 2,
  error: "Payment required",
  resource: {
    url: "https://token-verdict-production.up.railway.app/v1/verdict",
    description:
      "Send a token contract address, get a risk verdict. Returns SOLID / CAUTION / DANGER with a 0-100 score, six weighted market-structure signals and a written analyst take.",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      amount: "20000",
      payTo: "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F",
      maxTimeoutSeconds: 300,
      extra: {
        name: "USD Coin",
        version: "2",
      },
    },
  ],
};

// The service engine's published example verdict.
const VERDICT = {
  token: {
    address: "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b",
    symbol: "BASE",
    name: "Base King",
    chain: "base",
  },
  verdict: "CAUTION",
  score: 35.0,
  signals: [
    {
      name: "Liquidity depth",
      score: 5,
      weight: 3,
      detail: "Deep liquidity ($259,106) — the book can absorb real selling.",
    },
    {
      name: "Volume churn",
      score: 60,
      weight: 2,
      detail: "24h volume is just $0 — effectively no market.",
    },
    {
      name: "Sell pressure",
      score: 60,
      weight: 2,
      detail: "67% sells vs 33% buys — clear distribution.",
    },
    {
      name: "Price action",
      score: 10,
      weight: 2,
      detail: "24h price action (+0.6%) is unremarkable.",
    },
    {
      name: "Trader breadth",
      score: 70,
      weight: 1,
      detail: "Only 3 transactions in 24h — a handful of wallets IS the market.",
    },
    {
      name: "Pair age",
      score: 5,
      weight: 1,
      detail: "Pair has meaningful history.",
    },
  ],
  take: "BASE (Base King) trades at $0.0003238 on uniswap with $259.1k in liquidity. Trading has effectively stopped — $0 of volume across 3 transactions in 24h — so this is a dormant book, not a live market, whatever the liquidity figure says. Verdict: CAUTION — tradable at most in small size, and the signals above are why.",
  market: {
    price_usd: "0.0003238",
    liquidity_usd: 259106,
    volume_24h_usd: 0.01,
    price_change_24h_pct: 0.55,
    txns_24h: { buys: 1, sells: 2 },
    dex: "uniswap",
    pair_url: "https://dexscreener.com/base/0x2821d96b5fc81aec3763340b375a846a89a3ec1b",
  },
};

const TOKEN = "0x2821d96B5FC81aEC3763340b375a846a89A3Ec1b";
const PAY_TO = "0x097f9685D1e0752bF8B02d61E5Ce9be7eA0FBA7F";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");

interface RecordedCall {
  url: string;
  headers: Headers;
}

/**
 * Builds a stub fetch that replays a 402 challenge on the first call
 * and the example verdict on the second, recording every call.
 *
 * @param account - The test account the payment will be made from
 * @param account.address - The test account's address
 * @param challenge - The 402 challenge to replay (default: production)
 * @returns The recorded calls and the stub fetch implementation
 */
function mockFetch(account: { address: string }, challenge: unknown = CHALLENGE) {
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
    return new Response(JSON.stringify(VERDICT), {
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

/**
 * Builds a minimal fake EvmWalletProvider whose signer is the test
 * account.
 *
 * @param account - The test account to sign with
 * @returns A fake wallet provider cast to EvmWalletProvider
 */
function fakeWalletProvider(account: ReturnType<typeof privateKeyToAccount>) {
  return {
    getName: () => "token-verdict-test-wallet",
    getAddress: async () => account.address,
    toSigner: () => account,
    getNetwork: () => ({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
  } as unknown as EvmWalletProvider;
}

describe("TokenVerdictActionProvider", () => {
  it("exposes exactly one action (AgentKit prefixes it with the class name)", () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const provider = tokenVerdictActionProvider();
    const actions = provider.getActions(fakeWalletProvider(account));
    expect(actions.map(a => a.name)).toEqual(["TokenVerdictActionProvider_token_verdict"]);
  });

  it("supports Base EVM only", () => {
    const provider = tokenVerdictActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" })).toBe(false);
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
      false,
    );
  });

  it("pays the real 402 challenge (EIP-3009) and returns the verdict", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const { calls, fetchImpl } = mockFetch(account);
    const provider = tokenVerdictActionProvider({ fetchImpl });
    const [action] = provider.getActions(fakeWalletProvider(account));

    const output = await action.invoke({ address: TOKEN, chain: "base" });
    const verdict = JSON.parse(output);
    expect(verdict.verdict).toBe("CAUTION");
    expect(verdict.score).toBe(35.0);
    expect(verdict.signals).toHaveLength(6);

    // Exactly two HTTP calls: unpaid probe, then the paid retry.
    expect(calls).toHaveLength(2);
    expect(calls[0].headers.get("payment-signature")).toBeNull();
    const header = calls[1].headers.get("payment-signature");
    expect(header).toBeTruthy();

    const payload = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));
    expect(payload.x402Version).toBe(2);
    expect(payload.accepted.amount).toBe("20000"); // $0.02 in micro-USDC
    expect(payload.accepted.asset).toBe(USDC);
    expect(payload.accepted.network).toBe("eip155:8453");

    const auth = payload.payload.authorization;
    expect(auth.from).toBe(account.address);
    expect(auth.to).toBe(PAY_TO);
    expect(auth.value).toBe("20000");
    // @x402/evm 2.7.0 opens the EIP-3009 validity window at now - 600s
    // and closes it at now + maxTimeoutSeconds (300s here).
    expect(BigInt(auth.validAfter)).toBeGreaterThan(0n);
    expect(BigInt(auth.validBefore) - BigInt(auth.validAfter)).toBe(900n);

    // The signature must verify as the wallet's EIP-712 signature over
    // the TransferWithAuthorization — not just exist.
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        verifyingContract: USDC,
      },
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
  });

  it("refuses to pay a challenge priced above the spend guard", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const repriced = {
      ...CHALLENGE,
      accepts: [{ ...CHALLENGE.accepts[0], amount: "30000" }], // $0.03 > $0.02 guard
    };
    const { calls, fetchImpl } = mockFetch(account, repriced);
    const provider = tokenVerdictActionProvider({ fetchImpl });
    const [action] = provider.getActions(fakeWalletProvider(account));

    const output = await action.invoke({ address: TOKEN, chain: "base" });
    expect(output).toContain("Error getting token verdict");
    // The unpaid probe happened, but no paid retry was ever signed.
    expect(calls).toHaveLength(1);
  });

  it("surfaces upstream errors as an error string, not a throw", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const failingFetch = (async () =>
      new Response(JSON.stringify({ error: "token not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const provider = tokenVerdictActionProvider({ fetchImpl: failingFetch });
    const [action] = provider.getActions(fakeWalletProvider(account));
    const output = await action.invoke({ address: TOKEN, chain: "base" });
    expect(output).toContain("Error getting token verdict");
    expect(output).toContain("404");
  });
});

describe("TokenVerdictSchema (mirrors POST /v1/verdict)", () => {
  it("accepts a bare address and defaults chain to base", () => {
    const parsed = TokenVerdictSchema.parse({ address: TOKEN });
    expect(parsed.address).toBe(TOKEN);
    expect(parsed.chain).toBe("base");
  });

  it("accepts every chain label the service accepts", () => {
    for (const chain of ["base", "ethereum", "solana"] as const) {
      expect(TokenVerdictSchema.parse({ address: TOKEN, chain }).chain).toBe(chain);
    }
  });

  it("rejects malformed addresses", () => {
    for (const address of [
      "0x123", // too short
      "2821d96B5FC81aEC3763340b375a846a89A3Ec1b", // missing 0x
      "0xZZ21d96B5FC81aEC3763340b375a846a89A3Ec1b", // non-hex
      "",
    ]) {
      expect(() => TokenVerdictSchema.parse({ address })).toThrow();
    }
  });

  it("rejects unknown chain labels and a missing address", () => {
    expect(() => TokenVerdictSchema.parse({ address: TOKEN, chain: "bitcoin" })).toThrow();
    expect(() => TokenVerdictSchema.parse({})).toThrow();
    expect(() => TokenVerdictSchema.parse({ chain: "base" })).toThrow();
  });
});
