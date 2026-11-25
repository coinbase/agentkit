import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { FractalaiReceiptsActionProvider } from "./fractalaiReceiptsActionProvider";
import {
  FRACTALAI_DIRECTORY_CHECKPOINT,
  FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64,
  FRACTALAI_KEY_DIRECTORY_URL,
  FRACTALAI_NOTARY_URL,
  NOTARY_PAY_TO,
  NOTARY_USDC_ASSET,
} from "./constants";
import {
  FractalaiDirectoryKey,
  fractalaiDirectoryRoot,
  fractalaiKeyAuthorizes,
  verifyFractalaiDirectory,
} from "./directory";
import { jcs, kidForKey, mlDsa65Verify, parseStrictJson, sha256Hex, utf8 } from "./encoding";
import { buildSealBody, isAcceptableNotaryRequirement } from "./notary";
import { verifyReceipt } from "./verifier";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

// ── fixtures: real production artefacts (FractalAI, 2026-10-07) ──
const FIXTURES = join(__dirname, "fixtures");
const MIDAS_TEXT = readFileSync(join(FIXTURES, "midas-alert-fe62b072.json"), "utf8");
const DIRECTORY_TEXT = readFileSync(join(FIXTURES, "key-directory-epoch3.json"), "utf8");
const TRUST_ROOTS = JSON.parse(readFileSync(join(FIXTURES, "trust-roots.json"), "utf8"));
const MIDAS = JSON.parse(MIDAS_TEXT);
const DIRECTORY = JSON.parse(DIRECTORY_TEXT);
const NOW = 1790500000; // shortly after the receipt was signed (emitted_at 1790473960)

// ── helpers to build test keys, directories and receipts ──
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const makeKey = (seedByte: number) => {
  const { publicKey, secretKey } = ml_dsa65.keygen(new Uint8Array(32).fill(seedByte));
  const pkB64 = b64(publicKey);
  return { publicKey, secretKey, pkB64, kid: kidForKey(pkB64) };
};
type TestKey = ReturnType<typeof makeKey>;
const sign = (key: TestKey, message: string) => b64(ml_dsa65.sign(key.secretKey, utf8(message)));

const GOV = makeKey(1);
const RECEIPT_KEY = makeKey(2);
const OTHER_KEY = makeKey(3);

const fractalaiDirectory = (
  gov: TestKey,
  keys: FractalaiDirectoryKey[],
  epoch = 3,
  prevRoot = "1".repeat(64),
) => {
  const root = fractalaiDirectoryRoot(keys, prevRoot, epoch, gov.pkB64);
  const signedMessage = `FRACTALAI-key-directory-v1\n${root}`;
  return {
    spec: "FRACTALAI-key-directory-v1",
    issuer: "FractalAI",
    epoch,
    prev_root: prevRoot,
    root,
    keys,
    signed_message: signedMessage,
    signature: sign(gov, signedMessage),
    directory_public_key: gov.pkB64,
  };
};
const receiptKeyEntry = (key: TestKey, extra: Partial<FractalaiDirectoryKey> = {}) =>
  ({
    kid: key.kid,
    use: "x402-receipt",
    algorithm: "ML-DSA-65 (FIPS-204)",
    public_key_b64: key.pkB64,
    added_at: 0,
    status: "active",
    not_before: 0,
    not_after: null,
    ...extra,
  }) as FractalaiDirectoryKey;

const sealDoc = (body: Record<string, unknown>, key: TestKey) => {
  const contentId = sha256Hex(jcs(body, true));
  const domain = "FRACTALAI-x402-served-v1\nx402-witness";
  return {
    algorithm: "ml-dsa-65",
    domain,
    content_id: contentId,
    public_key: key.pkB64,
    signature: sign(key, `${domain}\n${contentId}`),
    body,
  };
};

const ISSUER = "https://api.example.com";
const deliveryDirectory = (
  gov: TestKey,
  entries: { key: TestKey; status?: string; notBefore?: number | null; notAfter?: number | null }[],
) => {
  const keys = entries.map(e => ({
    kid: e.key.kid,
    alg: "ml-dsa-65",
    publicKey: e.key.pkB64,
    use: "x402-delivery-receipt",
    status: e.status ?? "active",
    notBefore: e.notBefore === undefined ? 1790000000 : e.notBefore,
    notAfter: e.notAfter ?? null,
    revokedAt: null,
  }));
  const body = {
    spec: "x402-receipt-key-directory/1",
    issuer: ISSUER,
    epoch: 1,
    prevRoot: "0".repeat(64),
    governanceKey: { alg: "ml-dsa-65", publicKey: gov.pkB64 },
    keys,
  };
  const sorted = { ...body, keys: [...keys].sort((a, b) => (a.kid < b.kid ? -1 : 1)) };
  const root = sha256Hex(jcs(sorted, true));
  return { ...body, root, signature: sign(gov, `x402-receipt-key-directory/1\n${root}`) };
};
const BODY = '{"temperature":21}';
const deliveryPayload = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  issuer: ISSUER,
  resourceUrl: `${ISSUER}/premium-data`,
  method: "GET",
  scheme: "exact",
  network: "eip155:8453",
  asset: NOTARY_USDC_ASSET,
  payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  amount: "10000",
  payer: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
  transaction: `0x${"ab".repeat(32)}`,
  logIndex: 312,
  paymentId: null,
  responseStatus: 200,
  responseSha256: sha256Hex(BODY),
  responseContentType: "application/json",
  issuedAt: 1790473960,
  ...overrides,
});
const deliveryReceipt = (payload: Record<string, unknown>, key: TestKey) => ({
  alg: "ml-dsa-65",
  kid: key.kid,
  payload,
  signature: sign(key, `x402-delivery-receipt/1\n${sha256Hex(jcs(payload, true))}`),
});

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const fetchMock = jest.fn();
global.fetch = fetchMock;

describe("FractalaiReceiptsActionProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe("trust roots and primitives", () => {
    it("pins the governance key and the epoch-3 checkpoint published by FractalAI", () => {
      expect(FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64).toBe(TRUST_ROOTS.governance.public_key_b64);
      expect(kidForKey(FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64)).toBe(TRUST_ROOTS.governance.kid);
      expect(FRACTALAI_DIRECTORY_CHECKPOINT).toEqual({
        epoch: 3,
        root: "8748d4d6966857adbab6e9f555cc8323f7726c0681b31e9f64df8d989ca088d7",
      });
      expect(DIRECTORY.directory_public_key).toBe(FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64);
    });

    it("verifies ML-DSA-65 on the production receipt (known-answer test, argument order)", () => {
      const message = utf8(`FRACTALAI-x402-served-v1\nmidas-alert\n${MIDAS.receipt_id}`);
      const pk = new Uint8Array(Buffer.from(MIDAS.public_key, "base64"));
      const sig = new Uint8Array(Buffer.from(MIDAS.signature, "base64"));
      expect(mlDsa65Verify(pk, message, sig)).toBe(true);
      const flipped = sig.slice();
      flipped[100] ^= 1;
      expect(mlDsa65Verify(pk, message, flipped)).toBe(false);
      expect(mlDsa65Verify(pk, utf8("another message"), sig)).toBe(false);
    });

    it("parses JSON strictly", () => {
      expect(() => parseStrictJson('{"a":1,"a":2}')).toThrow(/duplicate key/);
      expect(() => parseStrictJson('{"a":1} x')).toThrow(/trailing data/);
      expect(() => parseStrictJson('"\\ud800"')).toThrow(/lone surrogate/);
      expect(parseStrictJson('{"__proto__":{"x":1}}')).toEqual(JSON.parse('{"__proto__":{"x":1}}'));
    });
  });

  describe("verify_x402_receipt: FractalAI MIDAS alert (real production receipt)", () => {
    it("accepts the genuine receipt against the pinned roots (offline directory)", async () => {
      const v = await verifyReceipt(MIDAS_TEXT, { keyDirectory: DIRECTORY, now: NOW });
      expect(v.reasons).toEqual([]);
      expect(v.valid).toBe(true);
      expect(v.kind).toBe("midas-alert");
      expect(v.levels).toEqual({
        integrity: true,
        authentic: true,
        trusted: true,
        settlement: null,
        delivery: null,
      });
      expect(v.trustBasis).toBe("pinned-root");
      expect(v.key).toMatchObject({
        kid: "86c139c960bb274c",
        status: "active",
        timeBasis: "signed",
      });
      expect(v.directory).toMatchObject({ epoch: 3, root: FRACTALAI_DIRECTORY_CHECKPOINT.root });
      expect(v.contentId).toBe(MIDAS.receipt_id);
      expect(v.ignoredUnsignedFields).toEqual(["delivery", "key_directory", "verify", "scope"]);
    });

    it("fetches the FractalAI directory over HTTPS without following redirects", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(DIRECTORY_TEXT));
      const v = await verifyReceipt(MIDAS_TEXT, { now: NOW });
      expect(v.valid).toBe(true);
      expect(v.directory?.source).toBe(FRACTALAI_KEY_DIRECTORY_URL);
      expect(fetchMock).toHaveBeenCalledWith(
        FRACTALAI_KEY_DIRECTORY_URL,
        expect.objectContaining({ redirect: "error" }),
      );
    });

    it("reports an unreachable directory as not trusted", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse("{}", { status: 503 }));
      const v = await verifyReceipt(MIDAS_TEXT, { now: NOW });
      expect(v.valid).toBe(false);
      expect(v.levels.authentic).toBe(true);
      expect(v.levels.trusted).toBe(false);
      expect(v.reasons[0].code).toBe("DIRECTORY_UNAVAILABLE");
    });

    it("rejects a signed digit changed in the canonical, even with consistent copies", async () => {
      const canonical = MIDAS.canonical.replace(
        "health_factor=1.000872452215302",
        "health_factor=1.900872452215302",
      );
      const id = sha256Hex(canonical);
      const forged = {
        ...MIDAS,
        canonical,
        receipt_id: id,
        served_message: `FRACTALAI-x402-served-v1\nmidas-alert\n${id}`,
        facts: { ...MIDAS.facts, health_factor: 1.900872452215302 },
      };
      const v = await verifyReceipt(JSON.stringify(forged), { keyDirectory: DIRECTORY, now: NOW });
      expect(v.valid).toBe(false);
      expect(v.levels.integrity).toBe(true);
      expect(v.levels.authentic).toBe(false);
      expect(v.reasons[0].code).toBe("SIGNATURE_INVALID");
      expect(v.signed).toBeNull();
    });

    it("rejects an unsigned fact that disagrees with the signed canonical", async () => {
      const forged = { ...MIDAS, facts: { ...MIDAS.facts, debt_usd: 781054.42389374 } };
      const v = await verifyReceipt(JSON.stringify(forged), { keyDirectory: DIRECTORY, now: NOW });
      expect(v.valid).toBe(false);
      expect(v.levels.integrity).toBe(false);
      expect(v.reasons[0].code).toBe("UNSIGNED_FIELD_MISMATCH");
    });

    it("rejects a receipt_id that does not match the canonical", async () => {
      const forged = { ...MIDAS, receipt_id: "0".repeat(64) };
      const v = await verifyReceipt(JSON.stringify(forged), { keyDirectory: DIRECTORY, now: NOW });
      expect(v.reasons[0].code).toBe("RECEIPT_ID_MISMATCH");
    });

    it("refuses a document carrying fields of another kind", async () => {
      const v = await verifyReceipt(JSON.stringify({ ...MIDAS, body: {} }), {
        keyDirectory: DIRECTORY,
      });
      expect(v.reasons[0].code).toBe("KIND_AMBIGUOUS");
      const w = await verifyReceipt(MIDAS_TEXT, { kind: "served-proof", keyDirectory: DIRECTORY });
      expect(w.kindSource).toBe("caller");
      expect(w.reasons[0].code).toBe("KIND_AMBIGUOUS");
    });

    it("refuses duplicate keys in the receipt text", async () => {
      const text = MIDAS_TEXT.replace('"algorithm"', '"emitted_at": 1, "algorithm"');
      const v = await verifyReceipt(text, { keyDirectory: DIRECTORY, now: NOW });
      expect(v.reasons[0].code).toBe("JSON_DUPLICATE_KEY");
    });
  });

  describe("verify_x402_receipt: untrusted keys and directories", () => {
    it("does not trust a directory signed by another governance key", async () => {
      const keys = DIRECTORY.keys as FractalaiDirectoryKey[];
      const impostor = fractalaiDirectory(OTHER_KEY, keys, 3, DIRECTORY.prev_root);
      const v = await verifyReceipt(MIDAS_TEXT, { keyDirectory: impostor, now: NOW });
      expect(v.levels.authentic).toBe(true);
      expect(v.levels.trusted).toBe(false);
      expect(v.valid).toBe(false);
      expect(v.reasons[0].code).toBe("DIRECTORY_SIGNER_NOT_PINNED");
    });

    it("does not trust a tampered production directory", async () => {
      const tampered = JSON.parse(DIRECTORY_TEXT);
      tampered.keys[2].status = "active";
      tampered.keys[2].not_before = 0;
      const v = await verifyReceipt(MIDAS_TEXT, { keyDirectory: tampered, now: NOW });
      expect(v.levels.trusted).toBe(false);
      expect(v.reasons[0].code).toBe("DIRECTORY_INVALID");
    });

    it("does not trust a correctly signed receipt from a key that is not listed", async () => {
      const canonical = MIDAS.canonical;
      const id = sha256Hex(canonical);
      const doc = {
        canonical,
        public_key: OTHER_KEY.pkB64,
        signature: sign(OTHER_KEY, `FRACTALAI-x402-served-v1\nmidas-alert\n${id}`),
      };
      const v = await verifyReceipt(JSON.stringify(doc), { keyDirectory: DIRECTORY, now: NOW });
      expect(v.levels.authentic).toBe(true);
      expect(v.levels.trusted).toBe(false);
      expect(v.reasons[0].code).toBe("KEY_NOT_LISTED");
    });

    it("never authorizes reserved or revoked keys and checks the validity window", () => {
      const keys = DIRECTORY.keys as FractalaiDirectoryKey[];
      const p = { use: "x402-receipt", now: NOW, skew: 900 };
      const reserved = keys.find(k => k.status === "reserved")!;
      expect(fractalaiKeyAuthorizes(reserved, { ...p, signedTime: NOW }).code).toBe(
        "KEY_STATUS_RESERVED",
      );
      const revoked = { ...reserved, status: "revoked", not_before: 0, revoked_at: NOW + 10 };
      expect(fractalaiKeyAuthorizes(revoked, { ...p, signedTime: NOW }).code).toBe("KEY_REVOKED");
      const retiring = keys.find(k => k.status === "retiring")!;
      expect(fractalaiKeyAuthorizes(retiring, { ...p, signedTime: NOW }).ok).toBe(true);
      const afterWindow = (retiring.not_after as number) + 1;
      expect(
        fractalaiKeyAuthorizes(retiring, { ...p, now: afterWindow + 60, signedTime: afterWindow })
          .code,
      ).toBe("KEY_EXPIRED");
      expect(fractalaiKeyAuthorizes(retiring, { ...p, signedTime: null }).code).toBe(
        "KEY_NEEDS_SIGNED_TIME",
      );
      const active = keys.find(k => k.status === "active")!;
      expect(fractalaiKeyAuthorizes(active, { ...p, signedTime: 1790000000 }).code).toBe(
        "KEY_NOT_YET_VALID",
      );
      expect(fractalaiKeyAuthorizes(active, { ...p, signedTime: NOW + 5000 }).code).toBe(
        "SIGNED_TIME_IN_FUTURE",
      );
      expect(
        fractalaiKeyAuthorizes({ ...active, use: "other" }, { ...p, signedTime: NOW }).code,
      ).toBe("KEY_USE_MISMATCH");
    });

    it("refuses rollback, equivocation and unlinked epochs", () => {
      const keys = [receiptKeyEntry(RECEIPT_KEY)];
      const e3 = fractalaiDirectory(GOV, keys, 3);
      const ctx = { governanceKeyB64: GOV.pkB64, checkpoint: { epoch: 3, root: e3.root } };
      expect(verifyFractalaiDirectory(e3, ctx).epoch).toBe(3);
      const e2 = fractalaiDirectory(GOV, keys, 2);
      expect(() => verifyFractalaiDirectory(e2, ctx)).toThrow(
        expect.objectContaining({ code: "DIRECTORY_ROLLBACK" }),
      );
      const fork = fractalaiDirectory(GOV, [receiptKeyEntry(OTHER_KEY)], 3);
      expect(() => verifyFractalaiDirectory(fork, ctx)).toThrow(
        expect.objectContaining({ code: "DIRECTORY_EQUIVOCATION" }),
      );
      const e5 = fractalaiDirectory(GOV, keys, 5, "2".repeat(64));
      expect(() => verifyFractalaiDirectory(e5, ctx)).toThrow(
        expect.objectContaining({ code: "DIRECTORY_CHAIN_GAP" }),
      );
      const e4 = fractalaiDirectory(GOV, keys, 4, e3.root);
      const e5linked = fractalaiDirectory(GOV, keys, 5, e4.root);
      expect(verifyFractalaiDirectory(e5linked, { ...ctx, history: [e3, e4] }).chainEpochs).toEqual(
        [3, 4, 5],
      );
      const e4dropped = fractalaiDirectory(GOV, [receiptKeyEntry(OTHER_KEY)], 4, e3.root);
      const e5b = fractalaiDirectory(GOV, [receiptKeyEntry(OTHER_KEY)], 5, e4dropped.root);
      expect(() => verifyFractalaiDirectory(e5b, { ...ctx, history: [e3, e4dropped] })).toThrow(
        expect.objectContaining({ code: "DIRECTORY_NOT_APPEND_ONLY" }),
      );
    });
  });

  describe("verify_x402_receipt: FractalAI served proofs and seals", () => {
    it("refuses a served proof on a reserved route", async () => {
      const doc = {
        domain: "FRACTALAI-x402-served-v1",
        route_id: "x402-witness",
        digest: "a".repeat(64),
        public_key: OTHER_KEY.pkB64,
        signature: sign(OTHER_KEY, `FRACTALAI-x402-served-v1\nx402-witness\n${"a".repeat(64)}`),
      };
      const v = await verifyReceipt(JSON.stringify(doc), { keyDirectory: DIRECTORY });
      expect(v.reasons[0].code).toBe("ROUTE_RESERVED");
    });

    it("rebuilds a served-proof message and still requires a listed key", async () => {
      const digest = sha256Hex("served");
      const doc = {
        domain: "FRACTALAI-x402-served-v1",
        route_id: "proofs-attest",
        digest,
        public_key: OTHER_KEY.pkB64,
        signature: sign(OTHER_KEY, `FRACTALAI-x402-served-v1\nproofs-attest\n${digest}`),
      };
      const v = await verifyReceipt(JSON.stringify(doc), { keyDirectory: DIRECTORY, now: NOW });
      expect(v.kind).toBe("served-proof");
      expect(v.levels.authentic).toBe(true);
      expect(v.reasons[0].code).toBe("KEY_NOT_LISTED");
    });

    it("refuses self-attested seals", async () => {
      const v = await verifyReceipt(
        JSON.stringify({ domain: "FRACTALAI-x402-self-attest-v1", body: {} }),
      );
      expect(v.reasons[0].code).toBe("KIND_UNSUPPORTED");
    });
  });

  describe("verify_x402_receipt: x402 delivery-receipt extension", () => {
    const dirFor = (status = "active") =>
      deliveryDirectory(GOV, [
        { key: RECEIPT_KEY, status, notAfter: status === "active" ? null : NOW },
      ]);

    it("accepts a valid receipt with TLS trust and checks settlement and body", async () => {
      const receipt = deliveryReceipt(deliveryPayload(), RECEIPT_KEY);
      fetchMock.mockResolvedValueOnce(jsonResponse(dirFor()));
      const v = await verifyReceipt(JSON.stringify(receipt), {
        responseBody: BODY,
        expectedTransaction: receipt.payload.transaction as string,
        expectedPayer: (receipt.payload.payer as string).toLowerCase(),
        now: NOW,
      });
      expect(v.reasons).toEqual([]);
      expect(v.valid).toBe(true);
      expect(v.kind).toBe("delivery-receipt");
      expect(v.trustBasis).toBe("tls");
      expect(v.levels).toEqual({
        integrity: true,
        authentic: true,
        trusted: true,
        settlement: true,
        delivery: true,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `${ISSUER}/.well-known/x402-receipt-keys`,
        expect.objectContaining({ redirect: "error" }),
      );
    });

    it("reports pinned trust when the issuer's governance key is pinned", async () => {
      const receipt = deliveryReceipt(deliveryPayload(), RECEIPT_KEY);
      const v = await verifyReceipt(JSON.stringify(receipt), {
        keyDirectory: dirFor(),
        pinnedIssuerGovernanceKeys: { [ISSUER]: [GOV.pkB64] },
        now: NOW,
      });
      expect(v.trustBasis).toBe("pinned");
      expect(v.valid).toBe(true);
      const w = await verifyReceipt(JSON.stringify(receipt), {
        keyDirectory: dirFor(),
        pinnedIssuerGovernanceKeys: { [ISSUER]: [OTHER_KEY.pkB64] },
        now: NOW,
      });
      expect(w.valid).toBe(false);
      expect(w.reasons[0].code).toBe("DIRECTORY_SIGNER_NOT_PINNED");
    });

    it("fails settlement when the transaction differs", async () => {
      const receipt = deliveryReceipt(deliveryPayload(), RECEIPT_KEY);
      const v = await verifyReceipt(JSON.stringify(receipt), {
        keyDirectory: dirFor(),
        expectedTransaction: `0x${"cd".repeat(32)}`,
        now: NOW,
      });
      expect(v.levels.trusted).toBe(true);
      expect(v.levels.settlement).toBe(false);
      expect(v.valid).toBe(false);
      expect(v.reasons).toEqual([
        { level: "settlement", code: "SETTLEMENT_MISMATCH", detail: "transaction" },
      ]);
    });

    it("fails delivery when the body differs", async () => {
      const receipt = deliveryReceipt(deliveryPayload(), RECEIPT_KEY);
      const v = await verifyReceipt(JSON.stringify(receipt), {
        keyDirectory: dirFor(),
        responseBody: '{"temperature":22}',
        now: NOW,
      });
      expect(v.levels.delivery).toBe(false);
      expect(v.valid).toBe(false);
      expect(v.reasons[0].code).toBe("BODY_DIGEST_MISMATCH");
    });

    it("rejects an altered payload", async () => {
      const receipt = deliveryReceipt(deliveryPayload(), RECEIPT_KEY);
      const altered = { ...receipt, payload: { ...receipt.payload, amount: "10001" } };
      const v = await verifyReceipt(JSON.stringify(altered), { keyDirectory: dirFor(), now: NOW });
      expect(v.levels.authentic).toBe(false);
      expect(v.reasons[0].code).toBe("SIGNATURE_INVALID");
    });

    it("does not trust reserved, revoked or unlisted keys", async () => {
      const receipt = deliveryReceipt(deliveryPayload(), RECEIPT_KEY);
      for (const [status, code] of [
        ["reserved", "KEY_STATUS_RESERVED"],
        ["revoked", "KEY_REVOKED"],
      ]) {
        const v = await verifyReceipt(JSON.stringify(receipt), {
          keyDirectory: dirFor(status),
          now: NOW,
        });
        expect(v.levels.trusted).toBe(false);
        expect(v.reasons.map(r => r.code)).toContain(code);
      }
      const other = deliveryDirectory(GOV, [{ key: OTHER_KEY }]);
      const v = await verifyReceipt(JSON.stringify(receipt), { keyDirectory: other, now: NOW });
      expect(v.levels.trusted).toBe(false);
      expect(v.reasons[0].code).toBe("KEY_NOT_LISTED");
    });

    it("requires the issuer to be the resource origin unless explicitly accepted", async () => {
      const receipt = deliveryReceipt(
        deliveryPayload({ resourceUrl: "https://seller.example.org/data" }),
        RECEIPT_KEY,
      );
      const v = await verifyReceipt(JSON.stringify(receipt), { keyDirectory: dirFor(), now: NOW });
      expect(v.reasons.map(r => r.code)).toContain("ISSUER_NOT_AUTHORIZED");
      const w = await verifyReceipt(JSON.stringify(receipt), {
        keyDirectory: dirFor(),
        acceptedIssuers: [ISSUER],
        now: NOW,
      });
      expect(w.valid).toBe(true);
    });
  });

  describe("verify_x402_receipt action", () => {
    const provider = new FractalaiReceiptsActionProvider();
    const wallet = {} as WalletProvider;
    const args = {
      receipt: MIDAS_TEXT,
      kind: null,
      responseBody: null,
      expectedTransaction: null,
      expectedPayer: null,
      keyDirectory: DIRECTORY_TEXT,
    };

    it("returns the verdict as JSON", async () => {
      const out = JSON.parse(await provider.verifyX402Receipt(wallet, args));
      expect(out.valid).toBe(true);
      expect(out.trustBasis).toBe("pinned-root");
      expect(out.scope).toMatch(/does not prove that the content is true/);
      expect(out.signed.receipt_id).toBe(MIDAS.receipt_id);
    });

    it("reports a malformed key directory", async () => {
      const out = JSON.parse(
        await provider.verifyX402Receipt(wallet, { ...args, keyDirectory: "{not json" }),
      );
      expect(out.error).toBe(true);
    });

    it("supports every network", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(true);
    });
  });

  describe("request_x402_receipt action", () => {
    const TX = `0x${"12".repeat(32)}`;
    const PAYER = "0x857b06519E91e3A54538791bDbb0E22373e36b66";
    const PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
    const requestArgs = {
      transaction: TX,
      payTo: PAY_TO,
      amount: "10000",
      asset: null,
      payer: PAYER,
      resource: "https://api.example.com/premium-data",
      responseBody: BODY,
    };
    const mockFetchWithPayment = jest.fn();
    const mockClient = {
      registerPolicy: jest.fn(),
      onBeforePaymentCreation: jest.fn(),
    };

    const makeWallet = (networkId = "base-mainnet") => {
      const w = Object.create(EvmWalletProvider.prototype);
      w.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId });
      w.toSigner = jest.fn().mockReturnValue({ address: PAYER });
      w.readContract = jest.fn();
      return w as EvmWalletProvider;
    };
    const sentSealBody = () =>
      JSON.parse(mockFetchWithPayment.mock.calls[0][1].body).seal_body as Record<string, unknown>;
    const witnessed = (sent: Record<string, unknown>) => ({
      ...sent,
      payer: PAYER,
      notary_verified_onchain: true,
      notary_note: "independently confirmed on-chain",
    });
    const paymentHeader = Buffer.from(
      JSON.stringify({ success: true, transaction: `0x${"99".repeat(32)}`, network: "base" }),
    ).toString("base64");

    beforeEach(() => {
      mockFetchWithPayment.mockReset();
      mockClient.registerPolicy.mockReset();
      mockClient.onBeforePaymentCreation.mockReset();
      jest
        .mocked(x402Client)
        .mockImplementation(() => mockClient as unknown as InstanceType<typeof x402Client>);
      jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
    });

    it("builds the seal body, restricts payment to the notary and reports a bad signature", async () => {
      mockFetchWithPayment.mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(init.body as string).seal_body;
        const seal = sealDoc(witnessed(sent), OTHER_KEY);
        seal.signature = sign(OTHER_KEY, "something else");
        return jsonResponse({ seal }, { headers: { "payment-response": paymentHeader } });
      });
      const provider = new FractalaiReceiptsActionProvider();
      const out = JSON.parse(await provider.requestX402Receipt(makeWallet(), requestArgs));

      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        FRACTALAI_NOTARY_URL,
        expect.objectContaining({ method: "POST" }),
      );
      const body = sentSealBody();
      expect(body).toEqual({
        schema: "fractalai.x402-settlement-seal/0.1",
        resource: "https://api.example.com/premium-data",
        scheme: "exact",
        network: "eip155:8453",
        asset: NOTARY_USDC_ASSET,
        payTo: PAY_TO,
        amount: "10000",
        payer: PAYER,
        transaction: TX,
        success: true,
        response_sha256: sha256Hex(BODY),
        sealed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });

      const policy = mockClient.registerPolicy.mock.calls[0][0];
      const ok = {
        scheme: "exact",
        network: "eip155:8453",
        asset: NOTARY_USDC_ASSET,
        payTo: NOTARY_PAY_TO,
        amount: "5000",
      };
      expect(policy(2, [ok])).toEqual([ok]);
      expect(policy(2, [{ ...ok, amount: "5001" }])).toEqual([]);
      expect(policy(2, [{ ...ok, payTo: PAY_TO }])).toEqual([]);
      expect(policy(2, [{ ...ok, network: "eip155:84532" }])).toEqual([]);
      expect(policy(2, [{ ...ok, asset: PAY_TO }])).toEqual([]);
      const hook = mockClient.onBeforePaymentCreation.mock.calls[0][0];
      await expect(hook({ selectedRequirements: ok })).resolves.toBeUndefined();
      await expect(hook({ selectedRequirements: { ...ok, amount: "6000" } })).resolves.toEqual(
        expect.objectContaining({ abort: true }),
      );

      expect(out.success).toBe(false);
      expect(out.verification.levels.authentic).toBe(false);
      expect(out.verification.reasons[0].code).toBe("SIGNATURE_INVALID");
      expect(out.payment.transaction).toBe(`0x${"99".repeat(32)}`);
    });

    it("does not accept a correctly signed seal from a key FractalAI does not list", async () => {
      fetchMock.mockResolvedValue(jsonResponse(DIRECTORY_TEXT));
      mockFetchWithPayment.mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(init.body as string).seal_body;
        return jsonResponse({ seal: sealDoc(witnessed(sent), OTHER_KEY) });
      });
      const provider = new FractalaiReceiptsActionProvider();
      const out = JSON.parse(await provider.requestX402Receipt(makeWallet(), requestArgs));
      expect(out.success).toBe(false);
      expect(out.verification.levels.authentic).toBe(true);
      expect(out.verification.levels.trusted).toBe(false);
      expect(out.verification.reasons[0].code).toBe("KEY_NOT_LISTED");
      expect(out.sealMatchesRequest).toBe(true);
    });

    it("reports a notary refusal without a seal", async () => {
      mockFetchWithPayment.mockResolvedValueOnce(
        jsonResponse({ error: "notary refused to attest" }, { status: 422 }),
      );
      const provider = new FractalaiReceiptsActionProvider();
      const out = JSON.parse(await provider.requestX402Receipt(makeWallet(), requestArgs));
      expect(out.success).toBe(false);
      expect(out.status).toBe(422);
      expect(out.payment).toBeNull();
    });

    it("refuses wallets that cannot pay the notary on Base", async () => {
      const provider = new FractalaiReceiptsActionProvider();
      const wrongNet = JSON.parse(
        await provider.requestX402Receipt(makeWallet("base-sepolia"), requestArgs),
      );
      expect(wrongNet.error).toBe(true);
      const notEvm = JSON.parse(
        await provider.requestX402Receipt({} as WalletProvider, requestArgs),
      );
      expect(notEvm.error).toBe(true);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
    });

    it("accepts a seal from a listed key and flags a seal that does not match the request", async () => {
      // Swap the pinned trust roots for test roots that list RECEIPT_KEY, in an isolated registry.
      const directory = fractalaiDirectory(GOV, [receiptKeyEntry(RECEIPT_KEY)], 3);
      fetchMock.mockImplementation(async () => jsonResponse(directory));
      let Isolated: typeof import("./fractalaiReceiptsActionProvider");
      let IsolatedWallets: typeof import("../../wallet-providers");
      let IsolatedFetch: typeof import("@x402/fetch");
      jest.isolateModules(() => {
        jest.doMock("./constants", () => ({
          ...jest.requireActual("./constants"),
          FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64: GOV.pkB64,
          FRACTALAI_DIRECTORY_CHECKPOINT: { epoch: 3, root: directory.root },
        }));
        /* eslint-disable @typescript-eslint/no-require-imports -- isolated registry needs require */
        Isolated = require("./fractalaiReceiptsActionProvider");
        IsolatedWallets = require("../../wallet-providers");
        IsolatedFetch = require("@x402/fetch");
        /* eslint-enable @typescript-eslint/no-require-imports */
      });
      const wallet = Object.create(IsolatedWallets!.EvmWalletProvider.prototype);
      wallet.getNetwork = () => ({ protocolFamily: "evm", networkId: "base-mainnet" });
      wallet.toSigner = () => ({ address: PAYER });
      jest
        .mocked(IsolatedFetch!.x402Client)
        .mockImplementation(() => mockClient as unknown as InstanceType<typeof x402Client>);
      jest.mocked(IsolatedFetch!.wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);

      mockFetchWithPayment.mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(init.body as string).seal_body;
        return jsonResponse({ seal: sealDoc(witnessed(sent), RECEIPT_KEY) });
      });
      const provider = new Isolated!.FractalaiReceiptsActionProvider();
      const out = JSON.parse(await provider.requestX402Receipt(wallet, requestArgs));
      expect(out.verification.reasons).toEqual([]);
      expect(out.success).toBe(true);
      expect(out.verification.trustBasis).toBe("pinned-root");
      expect(out.verification.levels).toMatchObject({ settlement: true, delivery: true });
      expect(out.notaryVerifiedOnchain).toBe(true);
      expect(out.payerClaimMatches).toBe(true);
      expect(out.seal.body.transaction).toBe(TX);

      mockFetchWithPayment.mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(init.body as string).seal_body;
        return jsonResponse({ seal: sealDoc({ ...witnessed(sent), amount: "1" }, RECEIPT_KEY) });
      });
      const mismatch = JSON.parse(await provider.requestX402Receipt(wallet, requestArgs));
      expect(mismatch.verification.valid).toBe(true);
      expect(mismatch.success).toBe(false);
      expect(mismatch.mismatchedFields).toEqual(["amount"]);

      mockFetchWithPayment.mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(init.body as string).seal_body;
        return jsonResponse({
          seal: sealDoc({ ...witnessed(sent), transaction: `0x${"34".repeat(32)}` }, RECEIPT_KEY),
        });
      });
      const otherTx = JSON.parse(await provider.requestX402Receipt(wallet, requestArgs));
      expect(otherTx.success).toBe(false);
      expect(otherTx.verification.levels.settlement).toBe(false);
    });
  });

  describe("notary helpers", () => {
    it("defaults the seal body to USDC on Base and hashes the body", () => {
      const body = buildSealBody({
        transaction: "0x1",
        payTo: "0x2",
        amount: "3",
        now: new Date("2026-10-09T00:00:00.000Z"),
      });
      expect(body).toMatchObject({
        asset: NOTARY_USDC_ASSET,
        network: "eip155:8453",
        payer: null,
        resource: null,
        response_sha256: null,
        sealed_at: "2026-10-09T00:00:00.000Z",
      });
    });

    it("accepts the v1 maxAmountRequired spelling and the legacy network name", () => {
      const req = {
        scheme: "exact",
        network: "base",
        asset: NOTARY_USDC_ASSET.toLowerCase(),
        payTo: NOTARY_PAY_TO.toLowerCase(),
        maxAmountRequired: "5000",
      };
      expect(isAcceptableNotaryRequirement(req, 5000n)).toBe(true);
      expect(isAcceptableNotaryRequirement({ ...req, maxAmountRequired: "abc" }, 5000n)).toBe(
        false,
      );
    });
  });
});
