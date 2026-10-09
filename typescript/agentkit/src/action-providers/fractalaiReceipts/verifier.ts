import {
  DELIVERY_CLOCK_SKEW_SECONDS,
  DELIVERY_KEY_DIRECTORY_PATH,
  DELIVERY_RECEIPT_DOMAIN,
  FRACTALAI_CLOCK_SKEW_SECONDS,
  FRACTALAI_DIRECTORY_CHECKPOINT,
  FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64,
  FRACTALAI_KEY_DIRECTORY_URL,
  FRACTALAI_RECEIPT_KEY_USE,
  MIDAS_CANON_HEADER,
  MIDAS_REQUIRED_FIELDS,
  ML_DSA_65_PUBLIC_KEY_BYTES,
  ML_DSA_65_SIGNATURE_BYTES,
  RESERVED_ROUTES,
  ROUTE_RE,
  SEAL_SCHEMA,
  SELF_ATTEST_DOMAIN,
  SERVED_PREFIX,
} from "./constants";
import {
  deliveryKeyAuthorizationError,
  fetchJsonDocument,
  fractalaiKeyAuthorizes,
  verifyDeliveryDirectory,
  verifyFractalaiDirectory,
} from "./directory";
import {
  ReceiptError,
  decodeCanonicalBase64,
  isPlainObject,
  jcs,
  mlDsa65Verify,
  own,
  parseStrictJson,
  sanitizeJson,
  sanitizeText,
  sha256Hex,
  utf8,
} from "./encoding";

/** Receipt kinds this provider verifies. */
export const RECEIPT_KINDS = [
  "delivery-receipt",
  "x402-seal",
  "served-proof",
  "midas-alert",
] as const;
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];

type Level = "integrity" | "authentic" | "trusted" | "settlement" | "delivery";

/** Verdict returned by {@link verifyReceipt}. */
export interface ReceiptVerdict {
  /** True only if integrity, authentic and trusted are true and no evaluated level is false. */
  valid: boolean;
  kind: ReceiptKind | null;
  /** Whether the kind was chosen by the caller or inferred from the document's shape. */
  kindSource: "caller" | "shape" | null;
  /** `true` passed, `false` failed, `null` not evaluated / not applicable. */
  levels: Record<Level, boolean | null>;
  /**
   * Why the signing key is trusted: `pinned-root` (FractalAI directory checked against the
   * governance key and checkpoint pinned in this provider), `pinned` (third-party directory whose
   * governance key was pinned in the provider config), `tls` (third-party directory accepted
   * because it was fetched over HTTPS from the issuer: trust on first use) or `none`.
   */
  trustBasis: "pinned-root" | "pinned" | "tls" | "none";
  /** sha256 of the signed content (receipt id / content id / digest). */
  contentId: string | null;
  /** Unix time the signer put inside the signed bytes, if the kind signs one. */
  signedTime: number | null;
  key: {
    kid: string;
    status: string;
    use: string;
    notBefore: number | null;
    notAfter: number | null;
    evaluatedAt: number;
    timeBasis: "signed" | "verification-time";
  } | null;
  directory: {
    source: string;
    epoch: number;
    root: string;
    chainEpochs?: number[];
  } | null;
  /** Signed content (strings sanitized), only exposed once the signature verified. */
  signed: unknown;
  ignoredUnsignedFields: string[];
  reasons: { level: Level; code: string; detail?: string }[];
  notes: string[];
  scope: string;
}

/** Options of {@link verifyReceipt}. */
export interface VerifyReceiptOptions {
  /** Kind chosen by the caller's policy. Inferred from the shape only when absent. */
  kind?: ReceiptKind | null;
  /** Exact body text that was served, to check the signed body digest. */
  responseBody?: string | null;
  /** Settlement transaction the caller observed. */
  expectedTransaction?: string | null;
  /** Payer address the caller observed. */
  expectedPayer?: string | null;
  /** Key directory supplied out of band (parsed JSON); fetched when absent. */
  keyDirectory?: unknown;
  /** Intermediate FractalAI directory epochs, for directories newer than the checkpoint. */
  directoryHistory?: unknown[];
  /** Issuers accepted for `delivery-receipt` besides the resource origin (e.g. a notary). */
  acceptedIssuers?: string[];
  /** Governance keys pinned per `delivery-receipt` issuer origin. */
  pinnedIssuerGovernanceKeys?: Record<string, string[]>;
  /** Verifier clock (unix seconds). */
  now?: number;
  fetchImpl?: typeof fetch;
}

const SCOPE =
  "A valid receipt proves that a key, trusted on the stated basis, signed these exact bytes at the " +
  "signed time. It does not prove that the content is true, correct or complete, and (unless " +
  "settlement is checked against the chain) not that the payment itself happened.";

interface ParsedFractalai {
  kind: Exclude<ReceiptKind, "delivery-receipt">;
  contentId: string;
  message: string;
  publicKeyB64: string;
  publicKey: Uint8Array;
  signature: Uint8Array;
  signedTime: number | null;
  signed: Record<string, unknown>;
  ignored: string[];
}

const fail = (code: string, detail?: string): never => {
  throw new ReceiptError(code, detail);
};

const MARKERS: Record<string, string[]> = {
  "midas-alert": [
    "canonical",
    "receipt_id",
    "served_message",
    "served_domain",
    "facts",
    "snapshot",
  ],
  "x402-seal": ["body"],
  "served-proof": ["route_id", "digest"],
  "acp-verdict": ["decision"],
  "delivery-receipt": ["payload", "kid", "alg"],
};

/**
 * Refuses a document that carries the distinctive fields of a kind other than the one being
 * verified, or a `profile` label that names another kind: a field can never re-route verification.
 *
 * @param r - Receipt document
 * @param kind - Kind being verified
 */
function checkUnambiguous(r: Record<string, unknown>, kind: ReceiptKind): void {
  for (const [family, fields] of Object.entries(MARKERS)) {
    if (family !== kind && fields.some(f => own(r, f))) {
      fail("KIND_AMBIGUOUS", `document carries ${family} fields while being verified as ${kind}`);
    }
  }
  const alias = kind === "served-proof" ? "x402-served" : kind;
  if (own(r, "profile") && r.profile !== alias && r.profile !== kind) {
    fail("KIND_AMBIGUOUS", "profile label does not name the verified kind");
  }
}

/**
 * Infers the kind from the document's shape (never from a claimed domain).
 *
 * @param r - Receipt document
 * @returns The kind
 */
function inferKind(r: Record<string, unknown>): ReceiptKind {
  if (own(r, "payload") && own(r, "kid") && own(r, "alg")) return "delivery-receipt";
  if (own(r, "canonical")) return "midas-alert";
  if (own(r, "body")) {
    if (r.domain === SELF_ATTEST_DOMAIN) {
      return fail(
        "KIND_UNSUPPORTED",
        "self-attested seal: signed by the seller's own key, never authorized by a FractalAI directory",
      );
    }
    return "x402-seal";
  }
  if (own(r, "route_id")) return "served-proof";
  if (own(r, "decision")) return fail("KIND_UNSUPPORTED", "acp-verdict is not supported here");
  return fail("KIND_UNKNOWN", "cannot determine the receipt kind from its shape");
}

const keyAndSig = (r: Record<string, unknown>) => {
  if (own(r, "algorithm") && r.algorithm !== "ml-dsa-65") fail("ALGORITHM", "not ml-dsa-65");
  const publicKey = decodeCanonicalBase64(r.public_key, ML_DSA_65_PUBLIC_KEY_BYTES);
  if (!publicKey) fail("KEY_ENCODING", "public_key is not a canonical 1952-byte ML-DSA-65 key");
  const signature = decodeCanonicalBase64(r.signature, ML_DSA_65_SIGNATURE_BYTES);
  if (!signature) fail("SIGNATURE_ENCODING", "signature is not a canonical 3309-byte signature");
  return {
    publicKey: publicKey as Uint8Array,
    signature: signature as Uint8Array,
    publicKeyB64: r.public_key as string,
  };
};

const decInt = (s: string, what: string): number => {
  if (!/^(0|[1-9][0-9]{0,15})$/.test(s)) fail("CANONICAL_MALFORMED", `${what} is not a decimal`);
  const v = Number(s);
  if (!Number.isSafeInteger(v)) fail("CANONICAL_MALFORMED", `${what} out of range`);
  return v;
};

/**
 * Does an unsigned JSON fact equal the signed canonical string?
 *
 * @param v - Unsigned value
 * @param s - Signed canonical value
 * @returns Whether they are equal
 */
function factEquals(v: unknown, s: string): boolean {
  if (typeof v === "string") return v === s;
  if (typeof v === "boolean") return s === String(v);
  if (v === null) return s === "null";
  if (typeof v === "number") {
    return /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(s) && Number(s) === v;
  }
  return false;
}

/**
 * Parses a MIDAS alert: rebuilds the signed message from the canonical text and checks every
 * unsigned field that duplicates signed content.
 *
 * @param r - Receipt document
 * @returns Parsed receipt
 */
function parseMidas(r: Record<string, unknown>): ParsedFractalai {
  const known = new Set([
    "canonical",
    "signature",
    "public_key",
    "algorithm",
    "receipt_id",
    "served_message",
    "served_domain",
    "domain",
    "facts",
    "emitted_at",
    "content_id",
    "snapshot",
  ]);
  const canonical = r.canonical;
  if (typeof canonical !== "string" || canonical.length === 0 || canonical.length > 8192) {
    fail("CANONICAL_MALFORMED", "canonical missing or too long");
  }
  const text = canonical as string;
  // eslint-disable-next-line no-control-regex
  if (/[\r\u0000\u2028\u2029]/.test(text)) fail("CANONICAL_MALFORMED", "forbidden character");
  const [header, ...lines] = text.split("\n");
  if (header !== MIDAS_CANON_HEADER) fail("CANONICAL_MALFORMED", "wrong canonical header");
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const m = /^([a-z][a-z0-9_]{0,63})=(.*)$/.exec(line);
    if (!m) return fail("CANONICAL_MALFORMED", "malformed canonical line");
    if (own(fields, m[1])) fail("CANONICAL_MALFORMED", `duplicate canonical key ${m[1]}`);
    fields[m[1]] = m[2];
  }
  for (const k of MIDAS_REQUIRED_FIELDS) {
    if (!own(fields, k)) fail("CANONICAL_MALFORMED", `canonical lacks ${k}`);
  }
  const id = sha256Hex(text);
  const domain = `${SERVED_PREFIX}\nmidas-alert`;
  const message = `${domain}\n${id}`;
  if (own(r, "receipt_id") && r.receipt_id !== id) {
    fail("RECEIPT_ID_MISMATCH", "receipt_id != sha256(canonical)");
  }
  if (own(r, "content_id") && r.content_id !== id) {
    fail("RECEIPT_ID_MISMATCH", "content_id != sha256(canonical)");
  }
  if (own(r, "served_message") && r.served_message !== message) {
    fail("SIGNED_MESSAGE_MISMATCH", "served_message != rebuilt signed message");
  }
  if (own(r, "served_domain") && r.served_domain !== domain) {
    fail("DOMAIN_MISMATCH", "served_domain is not the midas-alert domain");
  }
  if (own(r, "domain") && r.domain !== MIDAS_CANON_HEADER && r.domain !== domain) {
    fail("DOMAIN_MISMATCH", "domain is neither the canonical header nor the signed domain");
  }
  const signedTime = decInt(fields.emitted_at, "emitted_at");
  if (own(r, "emitted_at") && r.emitted_at !== signedTime) {
    fail("UNSIGNED_FIELD_MISMATCH", "top-level emitted_at differs from the signed one");
  }
  if (own(r, "facts")) {
    const facts = r.facts;
    if (!isPlainObject(facts)) return fail("UNSIGNED_FIELD_MISMATCH", "facts is not an object");
    const bad = new Set<string>();
    for (const k of Object.keys(facts))
      if (!own(fields, k) || !factEquals(facts[k], fields[k])) bad.add(k);
    for (const k of Object.keys(fields)) if (!own(facts, k)) bad.add(k);
    if (bad.size) {
      fail(
        "UNSIGNED_FIELD_MISMATCH",
        `facts differ from the signed canonical: ${[...bad].join(", ")}`,
      );
    }
  }
  let snapshot: unknown;
  if (own(r, "snapshot")) {
    if (!/^[0-9a-f]{64}$/.test(fields.snapshot_hash))
      fail("SNAPSHOT_MISMATCH", "bad snapshot_hash");
    if (sha256Hex(jcs(r.snapshot)) !== fields.snapshot_hash) {
      fail("SNAPSHOT_MISMATCH", "sha256(JCS(snapshot)) != signed snapshot_hash");
    }
    snapshot = r.snapshot;
  }
  return {
    kind: "midas-alert",
    contentId: id,
    message,
    ...keyAndSig(r),
    signedTime,
    signed: {
      receipt_id: id,
      ...fields,
      ...(snapshot !== undefined ? { snapshot } : {}),
    },
    ignored: Object.keys(r).filter(k => !known.has(k) && k !== "anchor" && k !== "anchors"),
  };
}

/**
 * Parses `sealed_at` (RFC 3339 UTC, as produced by Date#toISOString) into unix seconds.
 *
 * @param s - Timestamp text
 * @returns Unix seconds (floor)
 */
function parseSealedAt(s: unknown): number {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(s)) {
    return fail("SIGNED_TIME_MALFORMED", "sealed_at is not an RFC 3339 UTC timestamp");
  }
  const ms = Date.parse(s);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== s.slice(0, 19)) {
    fail("SIGNED_TIME_MALFORMED", "sealed_at is not a real calendar time");
  }
  return Math.floor(ms / 1000);
}

/**
 * Parses a FractalAI notary seal (x402-seal).
 *
 * @param r - Receipt document
 * @returns Parsed receipt
 */
function parseSeal(r: Record<string, unknown>): ParsedFractalai {
  const known = new Set(["algorithm", "domain", "content_id", "public_key", "signature", "body"]);
  const domain = `${SERVED_PREFIX}\nx402-witness`;
  if (r.domain !== domain) fail("DOMAIN_MISMATCH", "seal domain is not the notary domain");
  const body = r.body;
  if (!isPlainObject(body)) return fail("INPUT_SHAPE", "seal body missing or not an object");
  if (body.schema !== SEAL_SCHEMA) fail("SCHEMA_MISMATCH", `body.schema is not ${SEAL_SCHEMA}`);
  const cid = sha256Hex(jcs(body, true));
  if (r.content_id !== cid) fail("CONTENT_ID_MISMATCH", "content_id != sha256(JCS(body))");
  const signedTime = own(body, "sealed_at")
    ? parseSealedAt(body.sealed_at)
    : fail("SIGNED_TIME_MALFORMED", "body.sealed_at missing");
  return {
    kind: "x402-seal",
    contentId: cid,
    message: `${domain}\n${cid}`,
    ...keyAndSig(r),
    signedTime,
    signed: { content_id: cid, ...body },
    ignored: Object.keys(r).filter(k => !known.has(k) && k !== "anchor" && k !== "anchors"),
  };
}

/**
 * Parses a generic FractalAI served proof.
 *
 * @param r - Receipt document
 * @returns Parsed receipt
 */
function parseServedProof(r: Record<string, unknown>): ParsedFractalai {
  const known = new Set([
    "domain",
    "route_id",
    "digest",
    "signed_message",
    "signature",
    "public_key",
    "profile",
    "algorithm",
  ]);
  if (r.domain !== SERVED_PREFIX) fail("DOMAIN_MISMATCH", `domain is not ${SERVED_PREFIX}`);
  const route = r.route_id;
  if (typeof route !== "string" || !ROUTE_RE.test(route)) {
    fail("ROUTE_MALFORMED", "route_id must match ^[a-z0-9][a-z0-9-]{0,63}$");
  }
  if ((RESERVED_ROUTES as readonly string[]).includes(route as string)) {
    fail("ROUTE_RESERVED", `route '${route}' is reserved for a dedicated kind`);
  }
  if (typeof r.digest !== "string" || !/^[0-9a-f]{64}$/.test(r.digest)) {
    fail("DIGEST_MALFORMED", "digest must be 64 lowercase hex");
  }
  const message = `${SERVED_PREFIX}\n${route}\n${r.digest}`;
  if (own(r, "signed_message") && r.signed_message !== message) {
    fail("SIGNED_MESSAGE_MISMATCH", "signed_message != domain\\nroute\\ndigest");
  }
  return {
    kind: "served-proof",
    contentId: r.digest as string,
    message,
    ...keyAndSig(r),
    signedTime: null,
    signed: { route_id: route, digest: r.digest },
    ignored: Object.keys(r).filter(k => !known.has(k)),
  };
}

const sameHex = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.trim().toLowerCase();

/**
 * Verifies an x402 payment receipt and reports each level separately. Never throws.
 *
 * @param input - Receipt as JSON text (preferred) or already-parsed object
 * @param options - Policy and expectations
 * @returns The verdict
 */
export async function verifyReceipt(
  input: string | unknown,
  options: VerifyReceiptOptions = {},
): Promise<ReceiptVerdict> {
  const verdict: ReceiptVerdict = {
    valid: false,
    kind: null,
    kindSource: null,
    levels: { integrity: false, authentic: null, trusted: null, settlement: null, delivery: null },
    trustBasis: "none",
    contentId: null,
    signedTime: null,
    key: null,
    directory: null,
    signed: null,
    ignoredUnsignedFields: [],
    reasons: [],
    notes: [],
    scope: SCOPE,
  };
  const reason = (level: Level, code: string, detail?: string) =>
    verdict.reasons.push({ level, code, ...(detail ? { detail: sanitizeText(detail) } : {}) });
  const finish = () => {
    const l = verdict.levels;
    verdict.valid =
      l.integrity === true &&
      l.authentic === true &&
      l.trusted === true &&
      l.settlement !== false &&
      l.delivery !== false;
    return verdict;
  };
  try {
    const doc = typeof input === "string" ? parseStrictJson(input) : input;
    if (!isPlainObject(doc)) return fail("INPUT_SHAPE", "receipt is not a JSON object");
    const kind = options.kind ?? inferKind(doc);
    verdict.kind = kind;
    verdict.kindSource = options.kind ? "caller" : "shape";
    checkUnambiguous(doc, kind);
    if (kind === "delivery-receipt") {
      await verifyDelivery(doc, options, verdict, reason);
    } else {
      await verifyFractalai(doc, kind, options, verdict, reason);
    }
  } catch (error) {
    if (error instanceof ReceiptError) reason("integrity", error.code, error.message);
    else
      reason("integrity", "VERIFIER_ERROR", error instanceof Error ? error.message : String(error));
    verdict.levels.integrity = false;
  }
  return finish();
}

/**
 * FractalAI kinds: rebuild, verify the signature, then trust via the pinned directory.
 *
 * @param doc - Receipt document
 * @param kind - Kind being verified
 * @param options - Options
 * @param verdict - Verdict being filled
 * @param reason - Reason recorder
 */
async function verifyFractalai(
  doc: Record<string, unknown>,
  kind: Exclude<ReceiptKind, "delivery-receipt">,
  options: VerifyReceiptOptions,
  verdict: ReceiptVerdict,
  reason: (level: Level, code: string, detail?: string) => void,
): Promise<void> {
  const parsed =
    kind === "midas-alert"
      ? parseMidas(doc)
      : kind === "x402-seal"
        ? parseSeal(doc)
        : parseServedProof(doc);
  verdict.levels.integrity = true;
  verdict.contentId = parsed.contentId;
  verdict.signedTime = parsed.signedTime;
  verdict.ignoredUnsignedFields = parsed.ignored.map(k => sanitizeText(k, 64));

  // ── authentic ──
  verdict.levels.authentic = mlDsa65Verify(
    parsed.publicKey,
    utf8(parsed.message),
    parsed.signature,
  );
  if (!verdict.levels.authentic) {
    reason(
      "authentic",
      "SIGNATURE_INVALID",
      "ML-DSA-65 signature does not verify over the rebuilt message",
    );
    return;
  }
  verdict.signed = sanitizeJson(parsed.signed);

  // ── trusted ──
  verdict.levels.trusted = false;
  try {
    const supplied = options.keyDirectory !== undefined && options.keyDirectory !== null;
    const rawDir = supplied
      ? options.keyDirectory
      : await fetchJsonDocument(FRACTALAI_KEY_DIRECTORY_URL, options.fetchImpl ?? fetch);
    const dir = verifyFractalaiDirectory(rawDir, {
      governanceKeyB64: FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64,
      checkpoint: FRACTALAI_DIRECTORY_CHECKPOINT,
      history: options.directoryHistory,
    });
    verdict.directory = {
      source: supplied ? "supplied" : FRACTALAI_KEY_DIRECTORY_URL,
      epoch: dir.epoch,
      root: dir.root,
      chainEpochs: dir.chainEpochs,
    };
    const entry = dir.keys.find(k => k.public_key_b64 === parsed.publicKeyB64);
    if (!entry) {
      reason("trusted", "KEY_NOT_LISTED", "signing key is not in the FractalAI key directory");
      return;
    }
    const now = options.now ?? Math.floor(Date.now() / 1000);
    const decision = fractalaiKeyAuthorizes(entry, {
      use: FRACTALAI_RECEIPT_KEY_USE,
      signedTime: parsed.signedTime,
      now,
      skew: FRACTALAI_CLOCK_SKEW_SECONDS,
    });
    verdict.key = {
      kid: entry.kid,
      status: entry.status,
      use: entry.use,
      notBefore: entry.not_before ?? null,
      notAfter: entry.not_after ?? null,
      evaluatedAt: decision.evaluatedAt,
      timeBasis: decision.timeBasis,
    };
    if (!decision.ok) {
      reason("trusted", decision.code ?? "KEY_NOT_AUTHORIZED", decision.detail);
      return;
    }
    verdict.levels.trusted = true;
    verdict.trustBasis = "pinned-root";
  } catch (error) {
    if (error instanceof ReceiptError) reason("trusted", error.code, error.message);
    else reason("trusted", "DIRECTORY_INVALID", String(error));
    return;
  } finally {
    applyBindings(parsed, options, verdict, reason);
  }
}

/**
 * Settlement and delivery bindings for FractalAI kinds (only seals carry them).
 *
 * @param parsed - Parsed receipt
 * @param options - Options
 * @param verdict - Verdict being filled
 * @param reason - Reason recorder
 */
function applyBindings(
  parsed: ParsedFractalai,
  options: VerifyReceiptOptions,
  verdict: ReceiptVerdict,
  reason: (level: Level, code: string, detail?: string) => void,
): void {
  const wantsSettlement = !!options.expectedTransaction || !!options.expectedPayer;
  const wantsDelivery = typeof options.responseBody === "string";
  if (parsed.kind !== "x402-seal") {
    if (wantsSettlement)
      verdict.notes.push(`settlement binding is not applicable to ${parsed.kind}`);
    if (wantsDelivery)
      verdict.notes.push(`body digest binding is not applicable to ${parsed.kind}`);
    return;
  }
  const body = parsed.signed;
  if (wantsSettlement) {
    const bad: string[] = [];
    if (options.expectedTransaction && !sameHex(body.transaction, options.expectedTransaction)) {
      bad.push("transaction");
    }
    if (options.expectedPayer && !sameHex(body.payer, options.expectedPayer)) bad.push("payer");
    verdict.levels.settlement = bad.length === 0;
    for (const f of bad) reason("settlement", "SETTLEMENT_MISMATCH", f);
  }
  if (wantsDelivery) {
    const digest = sha256Hex(options.responseBody as string);
    if (typeof body.response_sha256 !== "string") {
      verdict.levels.delivery = false;
      reason("delivery", "BODY_NOT_SEALED", "the seal carries no response_sha256");
    } else {
      verdict.levels.delivery = body.response_sha256 === digest;
      if (!verdict.levels.delivery) reason("delivery", "BODY_DIGEST_MISMATCH");
    }
  }
  if (verdict.levels.authentic && body.notary_verified_onchain !== true) {
    verdict.notes.push("the notary did not independently check this transfer on-chain");
  }
}

const PAYLOAD_FIELDS: Record<string, "string" | "int" | "nstring" | "nint"> = {
  version: "int",
  issuer: "string",
  resourceUrl: "string",
  method: "string",
  scheme: "string",
  network: "string",
  asset: "string",
  payTo: "string",
  amount: "string",
  payer: "string",
  transaction: "string",
  logIndex: "nint",
  paymentId: "nstring",
  responseStatus: "nint",
  responseSha256: "string",
  responseContentType: "nstring",
  issuedAt: "int",
};

/**
 * Structural check of a `delivery-receipt` payload (spec §5.2).
 *
 * @param p - Candidate payload
 * @returns A reason code, or null
 */
function payloadError(p: unknown): string | null {
  if (!isPlainObject(p)) return "PAYLOAD_INVALID";
  if (Object.keys(p).length !== Object.keys(PAYLOAD_FIELDS).length) return "PAYLOAD_FIELDS";
  for (const [k, t] of Object.entries(PAYLOAD_FIELDS)) {
    if (!own(p, k)) return "PAYLOAD_FIELDS";
    const v = p[k];
    const isInt = Number.isSafeInteger(v) && (v as number) >= 0;
    const ok =
      (t === "string" && typeof v === "string") ||
      (t === "int" && isInt) ||
      (t === "nstring" && (v === null || typeof v === "string")) ||
      (t === "nint" && (v === null || isInt));
    if (!ok) return `PAYLOAD_FIELD_${k}`;
  }
  if (p.version !== 1) return "PAYLOAD_VERSION";
  if (!/^[0-9a-f]{64}$/.test(p.responseSha256 as string)) return "PAYLOAD_FIELD_responseSha256";
  if ((p.transaction as string).length === 0) return "PAYLOAD_FIELD_transaction";
  try {
    if (new URL(p.issuer as string).origin !== p.issuer) return "PAYLOAD_FIELD_issuer";
    new URL(p.resourceUrl as string);
  } catch {
    return "PAYLOAD_URL";
  }
  return null;
}

/**
 * x402 `delivery-receipt` extension (spec §8).
 *
 * @param r - Receipt wire object
 * @param options - Options
 * @param verdict - Verdict being filled
 * @param reason - Reason recorder
 * @returns Nothing; the verdict is filled in place (integrity failures throw)
 */
async function verifyDelivery(
  r: Record<string, unknown>,
  options: VerifyReceiptOptions,
  verdict: ReceiptVerdict,
  reason: (level: Level, code: string, detail?: string) => void,
): Promise<void> {
  // ── integrity ──
  if (Object.keys(r).length !== 4 || !own(r, "signature")) {
    return fail("RECEIPT_SHAPE", "expected exactly {alg, kid, payload, signature}");
  }
  if (r.alg !== "ml-dsa-65") return fail("ALG_UNSUPPORTED", "only ml-dsa-65 is implemented");
  if (typeof r.kid !== "string") return fail("KID_INVALID");
  const sig = decodeCanonicalBase64(r.signature, ML_DSA_65_SIGNATURE_BYTES);
  if (!sig) return fail("SIGNATURE_ENCODING", "signature is not a canonical 3309-byte signature");
  const pErr = payloadError(r.payload);
  if (pErr) return fail(pErr);
  const payload = r.payload as Record<string, unknown> & {
    issuer: string;
    resourceUrl: string;
    transaction: string;
    payer: string;
    responseSha256: string;
    issuedAt: number;
  };
  const receiptId = sha256Hex(jcs(payload, true));
  verdict.levels.integrity = true;
  verdict.contentId = receiptId;
  verdict.signedTime = payload.issuedAt;

  // ── directory ──
  let dir: ReturnType<typeof verifyDeliveryDirectory> | null = null;
  try {
    const supplied = options.keyDirectory !== undefined && options.keyDirectory !== null;
    const url = new URL(DELIVERY_KEY_DIRECTORY_PATH, payload.issuer).toString();
    const raw = supplied
      ? options.keyDirectory
      : await fetchJsonDocument(url, options.fetchImpl ?? fetch);
    dir = verifyDeliveryDirectory(
      raw,
      payload.issuer,
      options.pinnedIssuerGovernanceKeys?.[payload.issuer],
    );
    verdict.directory = { source: supplied ? "supplied" : url, epoch: dir.epoch, root: dir.root };
  } catch (error) {
    verdict.levels.trusted = false;
    if (error instanceof ReceiptError) reason("trusted", error.code, error.message);
    else reason("trusted", "DIRECTORY_INVALID", String(error));
  }

  if (dir) {
    const entry = dir.keys.find(k => k.kid === r.kid);
    if (!entry) {
      verdict.levels.trusted = false;
      reason("trusted", "KEY_NOT_LISTED", `kid ${sanitizeText(r.kid as string, 64)}`);
    } else {
      // ── authentic ──
      const pk = decodeCanonicalBase64(entry.publicKey, ML_DSA_65_PUBLIC_KEY_BYTES);
      verdict.levels.authentic =
        !!pk &&
        entry.alg === r.alg &&
        mlDsa65Verify(pk, utf8(`${DELIVERY_RECEIPT_DOMAIN}\n${receiptId}`), sig);
      if (!verdict.levels.authentic) {
        reason("authentic", "SIGNATURE_INVALID", "signature does not verify under the listed key");
      } else {
        verdict.signed = sanitizeJson({ receiptId, ...payload });
      }
      // ── trusted ──
      const now = options.now ?? Math.floor(Date.now() / 1000);
      const keyErr = deliveryKeyAuthorizationError(
        entry,
        r.alg as string,
        payload.issuedAt,
        now,
        DELIVERY_CLOCK_SKEW_SECONDS,
      );
      verdict.key = {
        kid: entry.kid,
        status: entry.status,
        use: entry.use,
        notBefore: entry.notBefore,
        notAfter: entry.notAfter,
        evaluatedAt: payload.issuedAt,
        timeBasis: "signed",
      };
      const resourceOrigin = new URL(payload.resourceUrl).origin;
      const issuerOk =
        payload.issuer === resourceOrigin ||
        (options.acceptedIssuers ?? []).some(i => {
          try {
            return new URL(i).origin === payload.issuer;
          } catch {
            return false;
          }
        });
      if (keyErr) reason("trusted", keyErr);
      if (!issuerOk)
        reason("trusted", "ISSUER_NOT_AUTHORIZED", "issuer is not the resource origin");
      verdict.levels.trusted = verdict.levels.authentic === true && !keyErr && issuerOk;
      if (verdict.levels.trusted) verdict.trustBasis = dir.trustBasis;
      if (dir.trustBasis === "tls") {
        verdict.notes.push(
          "the issuer's governance key was accepted because the directory was fetched over HTTPS " +
            "from the issuer (trust on first use); pin it in the provider config for stronger trust",
        );
      }
    }
  }

  // ── settlement / delivery ──
  if (options.expectedTransaction || options.expectedPayer) {
    const bad: string[] = [];
    if (options.expectedTransaction && payload.transaction !== options.expectedTransaction.trim()) {
      bad.push("transaction");
    }
    if (options.expectedPayer) {
      const a = payload.payer;
      const b = options.expectedPayer.trim();
      const same =
        a === b || (/^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() === b.toLowerCase());
      if (!same) bad.push("payer");
    }
    verdict.levels.settlement = bad.length === 0;
    for (const f of bad) reason("settlement", "SETTLEMENT_MISMATCH", f);
  }
  if (typeof options.responseBody === "string") {
    verdict.levels.delivery = sha256Hex(options.responseBody) === payload.responseSha256;
    if (!verdict.levels.delivery) reason("delivery", "BODY_DIGEST_MISMATCH");
  }
}
