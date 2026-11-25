import { generateKeyPairSync, sign } from "crypto";
import { predgeActionProvider, PredgeActionProvider } from "./predgeActionProvider";
import { canonicalJson, verifyBodySignature, verifyPredgeRecord } from "./utils";
import { PREDGE_ATTESTATION_PUBLIC_KEY } from "./constants";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("@x402/svm/exact/client");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const TEST_PUBLIC_KEY = (publicKey.export({ format: "der", type: "spki" }) as Buffer)
  .subarray(-32)
  .toString("hex");

const signHex = (message: string) =>
  sign(null, Buffer.from(message, "utf8"), privateKey).toString("hex");

/**
 * Builds a settlement-risk response signed with the test key, shaped like Predge's.
 *
 * @param overrides - Fields to override in the payload
 * @returns A signed response object
 */
function buildSignedRecord(overrides: Record<string, unknown> = {}) {
  const payload = {
    kind: "settlement-risk",
    condition_id: "0x77dcfa8756d12e46b031ac2cacabcc628c17b41de07fcb925c9eafbb14bca28c",
    risk_level: "caution",
    dispute_count: "1",
    question: 'Will it rain in Zürich?   "quoted"',
    ...overrides,
  };
  const canonical = canonicalJson(payload);
  const envelope: Record<string, unknown> = {
    version: "predge-attest-v1",
    issuer: "predge.io",
    algorithm: "ed25519",
    public_key: TEST_PUBLIC_KEY,
    canonical,
    signature: signHex(canonical),
    payload,
    kid: TEST_PUBLIC_KEY.slice(0, 16),
  };
  envelope.envelope_signature = signHex(canonicalJson(envelope));
  return {
    market: {
      condition_id: payload.condition_id,
      market_id: "5608010",
      slug: "rain-zurich",
      question: payload.question,
      closed: false,
    },
    risk_level: payload.risk_level,
    recommendation: "caution: a dispute is open.",
    uma_state: "disputed",
    resolved_on_chain: false,
    dispute_count: 1,
    open_dispute: true,
    sent_to_uma_vote: false,
    paused: false,
    checked_at: "2026-10-18T20:01:12Z",
    block: { number: "95765550" },
    attestation: envelope,
  };
}

const mockResponse = (status: number, body: unknown, headers: Record<string, string> = {}) => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    headers: new Headers(headers),
  } as unknown as Response;
};

describe("PredgeActionProvider", () => {
  let provider: PredgeActionProvider;
  const wallet = {} as WalletProvider;

  beforeEach(() => {
    jest.restoreAllMocks();
    provider = predgeActionProvider({ trustedKeys: [TEST_PUBLIC_KEY] });
  });

  describe("utils", () => {
    it("canonicalizes like Predge: sorted keys, no whitespace, no ASCII escaping", () => {
      expect(canonicalJson({ b: "é", a: [1, { d: null, c: true }] })).toBe(
        '{"a":[1,{"c":true,"d":null}],"b":"é"}',
      );
    });

    it("verifies a record signed by a trusted key", () => {
      const result = verifyPredgeRecord(buildSignedRecord(), [TEST_PUBLIC_KEY]);
      expect(result.valid).toBe(true);
      expect(result.checks).toEqual({
        trustedKey: true,
        signature: true,
        payloadMatchesCanonical: true,
        contentHash: null,
        envelopeSignature: true,
      });
    });

    it("rejects a record whose key is not trusted", () => {
      const result = verifyPredgeRecord(buildSignedRecord(), [PREDGE_ATTESTATION_PUBLIC_KEY]);
      expect(result.valid).toBe(false);
      expect(result.checks.trustedKey).toBe(false);
    });

    it("rejects a tampered payload", () => {
      const record = buildSignedRecord();
      (record.attestation.payload as Record<string, unknown>).risk_level = "ok";
      expect(verifyPredgeRecord(record, [TEST_PUBLIC_KEY]).valid).toBe(false);
    });

    it("rejects a tampered canonical string", () => {
      const record = buildSignedRecord();
      record.attestation.canonical = (record.attestation.canonical as string).replace(
        "caution",
        "ok",
      );
      expect(verifyPredgeRecord(record, [TEST_PUBLIC_KEY]).checks.signature).toBe(false);
    });

    it("verifies the detached body signature", () => {
      const body = JSON.stringify(buildSignedRecord());
      const header = `kid=${TEST_PUBLIC_KEY.slice(0, 16)}; alg=ed25519; sig=${signHex(`predge-body-v1\n${body}`)}`;
      expect(verifyBodySignature(body, header, [TEST_PUBLIC_KEY])).toBe(true);
      expect(verifyBodySignature(`${body} `, header, [TEST_PUBLIC_KEY])).toBe(false);
      expect(verifyBodySignature(body, null, [TEST_PUBLIC_KEY])).toBe(false);
    });
  });

  describe("getSettlementRisk", () => {
    it("fetches the free record and returns a verified summary", async () => {
      const record = buildSignedRecord();
      const body = JSON.stringify(record);
      const header = `kid=${TEST_PUBLIC_KEY.slice(0, 16)}; alg=ed25519; sig=${signHex(`predge-body-v1\n${body}`)}`;
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse(200, body, { "x-predge-body-signature": header }));

      const result = JSON.parse(await provider.getSettlementRisk(wallet, { market: "5608010" }));

      expect(fetchMock.mock.calls[0][0]).toBe("https://api.predge.io/v1/settlement-risk/5608010");
      expect(result.risk_level).toBe("caution");
      expect(result.open_dispute).toBe(true);
      expect(result.market.slug).toBe("rain-zurich");
      expect(result.signature.valid).toBe(true);
      expect(result.signature.bodySignature).toBe(true);
    });

    it("encodes the market in the path", async () => {
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse(200, buildSignedRecord()));
      await provider.getSettlementRisk(wallet, { market: "a/b c" });
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.predge.io/v1/settlement-risk/a%2Fb%20c");
    });

    it("flags a record that fails verification", async () => {
      const record = buildSignedRecord();
      (record.attestation.payload as Record<string, unknown>).risk_level = "ok";
      jest.spyOn(global, "fetch").mockResolvedValue(mockResponse(200, record));
      const result = JSON.parse(await provider.getSettlementRisk(wallet, { market: "1" }));
      expect(result.signature.valid).toBe(false);
    });

    it("returns API errors without treating them as no risk", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(
          mockResponse(404, { error: "unknown_market", message: "No Polymarket market found" }),
        );
      const result = JSON.parse(await provider.getSettlementRisk(wallet, { market: "nope" }));
      expect(result).toMatchObject({ error: true, status: 404, code: "unknown_market" });
      expect(result.note).toContain("not a 'no risk' answer");
    });

    it("handles network errors", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("socket hang up"));
      const result = JSON.parse(await provider.getSettlementRisk(wallet, { market: "1" }));
      expect(result.error).toBe(true);
      expect(result.message).toContain("socket hang up");
    });
  });

  describe("verifyRecord", () => {
    it("verifies a record passed as a JSON string", async () => {
      const result = JSON.parse(
        await provider.verifyRecord(wallet, { record: JSON.stringify(buildSignedRecord()) }),
      );
      expect(result.valid).toBe(true);
    });

    it("rejects invalid JSON", async () => {
      const result = JSON.parse(await provider.verifyRecord(wallet, { record: "{not json" }));
      expect(result.valid).toBe(false);
    });
  });

  describe("paid actions", () => {
    it("refuse when payments are disabled", async () => {
      const disabled = predgeActionProvider({ maxPaymentUsd: 0 });
      const result = JSON.parse(await disabled.getSettlementEstimate(wallet, { market: "1" }));
      expect(result.message).toContain("disabled");
    });

    it("refuse a wallet provider that cannot pay", async () => {
      const result = JSON.parse(await provider.getWhaleTrades(wallet, { limit: 5 }));
      expect(result.message).toContain("EVM or Solana");
    });

    it("refuse an EVM wallet on a network Predge does not accept", async () => {
      const evmWallet = Object.create(EvmWalletProvider.prototype) as EvmWalletProvider;
      evmWallet.getNetwork = jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-sepolia", chainId: "84532" });
      const result = JSON.parse(await provider.getSettlementEstimate(evmWallet, { market: "1" }));
      expect(result.message).toContain("Base or Solana mainnet");
    });
  });

  describe("paid request", () => {
    const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    let policy: ((v: number, reqs: Array<Record<string, unknown>>) => unknown[]) | undefined;
    let mockFetchWithPayment: jest.Mock;
    let evmWallet: EvmWalletProvider;

    beforeEach(() => {
      policy = undefined;
      jest.mocked(x402Client).mockImplementation(
        () =>
          ({
            registerPolicy: jest.fn(p => {
              policy = p;
            }),
          }) as unknown as x402Client,
      );
      mockFetchWithPayment = jest.fn();
      jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
      evmWallet = Object.create(EvmWalletProvider.prototype) as EvmWalletProvider;
      evmWallet.toSigner = jest.fn().mockReturnValue({ address: "0x1" });
      evmWallet.getNetwork = jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" });
    });

    it("buys the estimate and verifies the signed record", async () => {
      const record = { ...buildSignedRecord(), settlement_estimate: { p_flip: "0.31" } };
      const paymentResponse = btoa(JSON.stringify({ success: true, transaction: "0xabc" }));
      mockFetchWithPayment.mockResolvedValue(
        mockResponse(200, record, { "payment-response": paymentResponse }),
      );

      const result = JSON.parse(await provider.getSettlementEstimate(evmWallet, { market: "1" }));

      expect(mockFetchWithPayment.mock.calls[0][0]).toBe(
        "https://api.predge.io/v1/settlement-risk/1/estimate",
      );
      expect(result.settlement_estimate).toEqual({ p_flip: "0.31" });
      expect(result.signature.valid).toBe(true);
      expect(result.payment).toEqual({ success: true, transaction: "0xabc" });
    });

    it("only pays USDC on the wallet's network and under the cap", async () => {
      mockFetchWithPayment.mockResolvedValue(mockResponse(200, { trades: [] }));
      await provider.getWhaleTrades(evmWallet, { limit: 5 });
      expect(mockFetchWithPayment.mock.calls[0][0]).toBe(
        "https://api.predge.io/v1/whales/latest?limit=5",
      );
      const reqs = [
        { network: "eip155:8453", asset: BASE_USDC, amount: "20000" },
        { network: "eip155:8453", asset: BASE_USDC, amount: "60000" },
        { network: "eip155:8453", asset: "0xdead", amount: "1" },
        { network: "eip155:143", asset: BASE_USDC, amount: "1" },
        { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", asset: "x", amount: "1" },
      ];
      expect(policy!(2, reqs)).toEqual([reqs[0]]);
    });

    it("returns errors from the paid route", async () => {
      mockFetchWithPayment.mockResolvedValue(
        mockResponse(422, { error: "unsupported_protocol_v2", message: "V2 market" }),
      );
      const result = JSON.parse(await provider.getSettlementEstimate(evmWallet, { market: "1" }));
      expect(result).toMatchObject({ error: true, status: 422, code: "unsupported_protocol_v2" });
    });
  });

  describe("supportsNetwork", () => {
    it("supports any network", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        true,
      );
    });
  });
});
