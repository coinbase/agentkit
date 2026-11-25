import {
  DELIVERY_KEY_DIRECTORY_SPEC,
  DELIVERY_RECEIPT_KEY_USE,
  FETCH_TIMEOUT_MS,
  FRACTALAI_DIRECTORY_SPEC,
  MAX_DOCUMENT_BYTES,
  ML_DSA_65_PUBLIC_KEY_BYTES,
  ML_DSA_65_SIGNATURE_BYTES,
} from "./constants";
import {
  ReceiptError,
  decodeCanonicalBase64,
  isPlainObject,
  jcs,
  kidForKey,
  mlDsa65Verify,
  own,
  parseStrictJson,
  sha256Hex,
  utf8,
} from "./encoding";

const ZERO_ROOT = "0".repeat(64);
const HEX64 = /^[0-9a-f]{64}$/;
const STATUSES = ["reserved", "active", "retiring", "retired", "revoked"] as const;
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  reserved: ["reserved", "active", "revoked"],
  active: ["active", "retiring", "retired", "revoked"],
  retiring: ["retiring", "retired", "revoked"],
  retired: ["retired", "revoked"],
  revoked: ["revoked"],
};

/** A key entry of the FractalAI directory (extra fields are kept: they are part of the root). */
export interface FractalaiDirectoryKey {
  [field: string]: unknown;
  kid: string;
  use: string;
  public_key_b64: string;
  status: string;
  not_before?: number | null;
  not_after?: number | null;
  revoked_at?: number | null;
}

/** The parts of a directory epoch the append-only check compares. */
type EpochKeys = { epoch: number; keys: FractalaiDirectoryKey[] };

/** A pinned directory checkpoint. */
export interface DirectoryCheckpoint {
  epoch: number;
  root: string;
}

/** A FractalAI directory epoch that passed every check. */
export interface VerifiedFractalaiDirectory {
  epoch: number;
  root: string;
  keys: FractalaiDirectoryKey[];
  chainEpochs: number[];
}

const invalid = (detail: string) => new ReceiptError("DIRECTORY_INVALID", detail);

/**
 * Directory root: sha256(JCS({epoch, prev_root, governance_key, keys sorted by kid})).
 *
 * @param keys - Keys as served (all fields)
 * @param prevRoot - Previous root (zero root for epoch 1)
 * @param epoch - Epoch number
 * @param governanceKeyB64 - Governance public key (base64)
 * @returns Lowercase hex root
 */
export function fractalaiDirectoryRoot(
  keys: FractalaiDirectoryKey[],
  prevRoot: string | null | undefined,
  epoch: number,
  governanceKeyB64: string,
): string {
  const sorted = [...keys].sort((a, b) => (a.kid < b.kid ? -1 : a.kid > b.kid ? 1 : 0));
  return sha256Hex(
    jcs({
      epoch,
      prev_root: prevRoot || ZERO_ROOT,
      governance_key: governanceKeyB64,
      keys: sorted,
    }),
  );
}

/**
 * Structural and cryptographic check of one FractalAI directory epoch against the pinned
 * governance key (spec `FRACTALAI-key-directory-v1`). Throws a {@link ReceiptError}.
 *
 * @param dir - Parsed directory
 * @param governanceKeyB64 - Pinned governance key (base64)
 * @returns The directory, typed
 */
export function checkFractalaiEpoch(
  dir: unknown,
  governanceKeyB64: string,
): Record<string, unknown> & { epoch: number; root: string; keys: FractalaiDirectoryKey[] } {
  if (!isPlainObject(dir)) throw invalid("directory is not an object");
  if (dir.spec !== FRACTALAI_DIRECTORY_SPEC)
    throw invalid(`spec is not ${FRACTALAI_DIRECTORY_SPEC}`);
  const epoch = dir.epoch;
  if (typeof epoch !== "number" || !Number.isSafeInteger(epoch) || epoch < 1) {
    throw invalid("epoch is not a positive integer");
  }
  if (typeof dir.root !== "string" || !HEX64.test(dir.root)) throw invalid("root is not 64 hex");
  const prev = own(dir, "prev_root") ? dir.prev_root : null;
  if (prev !== null && (typeof prev !== "string" || !HEX64.test(prev))) {
    throw invalid("prev_root is not 64 hex");
  }
  if (epoch === 1 && (prev ?? ZERO_ROOT) !== ZERO_ROOT)
    throw invalid("epoch 1 needs a zero prev_root");
  if (!Array.isArray(dir.keys) || dir.keys.length === 0 || dir.keys.length > 256) {
    throw invalid("keys[] missing, empty or longer than 256");
  }
  const govPk = decodeCanonicalBase64(dir.directory_public_key, ML_DSA_65_PUBLIC_KEY_BYTES);
  if (!govPk) throw invalid("directory_public_key is not a canonical ML-DSA-65 key");
  const sig = decodeCanonicalBase64(dir.signature, ML_DSA_65_SIGNATURE_BYTES);
  if (!sig) throw invalid("signature is not a canonical ML-DSA-65 signature");
  const kids = new Set<string>();
  const pks = new Set<string>();
  for (const k of dir.keys as unknown[]) {
    if (!isPlainObject(k)) throw invalid("key entry is not an object");
    if (!decodeCanonicalBase64(k.public_key_b64, ML_DSA_65_PUBLIC_KEY_BYTES)) {
      throw invalid("key entry public_key_b64 is not a canonical ML-DSA-65 key");
    }
    const pkB64 = k.public_key_b64 as string;
    if (k.kid !== kidForKey(pkB64)) throw invalid("kid != sha256(public_key_b64)[:16]");
    if (kids.has(k.kid) || pks.has(pkB64)) throw invalid(`key ${k.kid} listed more than once`);
    kids.add(k.kid);
    pks.add(pkB64);
    if (typeof k.use !== "string") throw invalid(`key ${k.kid} has no use`);
    if (!(STATUSES as readonly unknown[]).includes(k.status)) {
      throw invalid(`key ${k.kid} has an unknown status`);
    }
    for (const f of ["not_before", "not_after", "revoked_at", "added_at"]) {
      const v = k[f];
      if (own(k, f) && v !== null && !(Number.isSafeInteger(v) && (v as number) >= 0)) {
        throw invalid(`key ${k.kid} ${f} must be a non-negative integer or null`);
      }
    }
  }
  const govB64 = dir.directory_public_key as string;
  if (pks.has(govB64)) throw invalid("governance key is also listed as a receipt key");
  const keys = dir.keys as FractalaiDirectoryKey[];
  if (fractalaiDirectoryRoot(keys, prev as string | null, epoch, govB64) !== dir.root) {
    throw invalid("root does not recompute over {epoch, prev_root, governance_key, keys}");
  }
  const message = `${FRACTALAI_DIRECTORY_SPEC}\n${dir.root}`;
  if (own(dir, "signed_message") && dir.signed_message !== message) {
    throw invalid("signed_message differs from the rebuilt message");
  }
  if (!mlDsa65Verify(govPk, utf8(message), sig)) {
    throw invalid("governance ML-DSA-65 signature does not verify");
  }
  if (govB64 !== governanceKeyB64) {
    throw new ReceiptError(
      "DIRECTORY_SIGNER_NOT_PINNED",
      "directory is signed by a key that is not the pinned FractalAI governance key",
    );
  }
  return dir as Record<string, unknown> & {
    epoch: number;
    root: string;
    keys: FractalaiDirectoryKey[];
  };
}

/**
 * Checks that `next` only appends to `prev` (no key removed or rebound, monotone status,
 * immutable not_before / revoked_at, not_after never extended).
 *
 * @param prev - Earlier epoch
 * @param next - Later epoch
 */
function checkAppendOnly(prev: EpochKeys, next: EpochKeys): void {
  const byKid = new Map(next.keys.map(k => [k.kid, k]));
  const fail = (d: string) => {
    throw new ReceiptError("DIRECTORY_NOT_APPEND_ONLY", `epoch ${next.epoch}: ${d}`);
  };
  for (const a of prev.keys) {
    const b = byKid.get(a.kid);
    if (!b) {
      fail(`removed key ${a.kid}`);
      continue;
    }
    if (b.public_key_b64 !== a.public_key_b64 || b.use !== a.use) fail(`rebound key ${a.kid}`);
    if (!ALLOWED_TRANSITIONS[a.status].includes(b.status)) {
      fail(`key ${a.kid} status ${a.status} -> ${b.status}`);
    }
    if (a.not_before != null && b.not_before !== a.not_before) fail(`key ${a.kid} not_before`);
    if (a.revoked_at != null && b.revoked_at !== a.revoked_at) fail(`key ${a.kid} revoked_at`);
    if (a.not_after != null && b.not_after != null && b.not_after > a.not_after) {
      fail(`key ${a.kid} not_after extended`);
    }
  }
}

/**
 * Verifies a FractalAI directory against the pinned governance key and checkpoint, with
 * anti-rollback and anti-equivocation. A directory newer than the checkpoint is accepted only if
 * every intermediate epoch is supplied in `history` and links by `prev_root`.
 *
 * @param dir - Parsed latest directory
 * @param ctx - Trust context
 * @param ctx.governanceKeyB64 - Pinned governance key
 * @param ctx.checkpoint - Pinned checkpoint `{epoch, root}`
 * @param ctx.history - Optional intermediate epochs (parsed)
 * @returns The verified directory
 */
export function verifyFractalaiDirectory(
  dir: unknown,
  ctx: {
    governanceKeyB64: string;
    checkpoint: DirectoryCheckpoint;
    history?: unknown[];
  },
): VerifiedFractalaiDirectory {
  const latest = checkFractalaiEpoch(dir, ctx.governanceKeyB64);
  const cp = ctx.checkpoint;
  if (latest.epoch < cp.epoch) {
    throw new ReceiptError(
      "DIRECTORY_ROLLBACK",
      `directory epoch ${latest.epoch} < pinned checkpoint epoch ${cp.epoch}`,
    );
  }
  if (latest.epoch === cp.epoch) {
    if (latest.root !== cp.root) {
      throw new ReceiptError(
        "DIRECTORY_EQUIVOCATION",
        `epoch ${latest.epoch} root differs from the pinned checkpoint root`,
      );
    }
    return { epoch: latest.epoch, root: latest.root, keys: latest.keys, chainEpochs: [cp.epoch] };
  }
  const byEpoch = new Map<number, ReturnType<typeof checkFractalaiEpoch>>();
  let checkpointBody: ReturnType<typeof checkFractalaiEpoch> | null = null;
  for (const h of ctx.history ?? []) {
    const e = checkFractalaiEpoch(h, ctx.governanceKeyB64);
    if (e.epoch === cp.epoch) {
      if (e.root !== cp.root) {
        throw new ReceiptError("DIRECTORY_EQUIVOCATION", "supplied checkpoint body differs");
      }
      checkpointBody = e;
    } else if (e.epoch > cp.epoch && e.epoch < latest.epoch) {
      const seen = byEpoch.get(e.epoch);
      if (seen && seen.root !== e.root) {
        throw new ReceiptError("DIRECTORY_EQUIVOCATION", `two roots supplied for epoch ${e.epoch}`);
      }
      byEpoch.set(e.epoch, e);
    }
  }
  let prevRoot = cp.root;
  let prevDir: EpochKeys | null = checkpointBody;
  const chain = [cp.epoch];
  for (let e = cp.epoch + 1; e <= latest.epoch; e++) {
    const cur = e === latest.epoch ? latest : byEpoch.get(e);
    if (!cur) {
      throw new ReceiptError(
        "DIRECTORY_CHAIN_GAP",
        `epoch ${e} is missing between the pinned checkpoint ${cp.epoch} and ${latest.epoch}`,
      );
    }
    if ((cur.prev_root ?? ZERO_ROOT) !== prevRoot) {
      throw new ReceiptError("DIRECTORY_CHAIN_BREAK", `epoch ${e} prev_root does not link`);
    }
    if (prevDir) checkAppendOnly(prevDir, cur);
    prevRoot = cur.root;
    prevDir = cur;
    chain.push(e);
  }
  return { epoch: latest.epoch, root: latest.root, keys: latest.keys, chainEpochs: chain };
}

/** Result of a key lifecycle decision. */
export interface KeyDecision {
  ok: boolean;
  code?: string;
  detail: string;
  evaluatedAt: number;
  timeBasis: "signed" | "verification-time";
}

/**
 * FractalAI key lifecycle at the receipt's signed time (or at verification time when the kind
 * signs no time). `reserved` never authorizes; `revoked` never authorizes here because this
 * provider does not verify consensus time anchors (a revoked key's holder can sign any time).
 *
 * @param key - Directory entry
 * @param p - Parameters
 * @param p.use - Use required by the kind
 * @param p.signedTime - Signed unix time, or null
 * @param p.now - Verifier clock (unix seconds)
 * @param p.skew - Allowed future skew (seconds)
 * @returns The decision
 */
export function fractalaiKeyAuthorizes(
  key: FractalaiDirectoryKey,
  p: { use: string; signedTime: number | null; now: number; skew: number },
): KeyDecision {
  const basis = p.signedTime === null ? "verification-time" : "signed";
  const T = p.signedTime === null ? p.now : p.signedTime;
  const R = (ok: boolean, code: string | undefined, detail: string): KeyDecision => ({
    ok,
    code,
    detail,
    evaluatedAt: T,
    timeBasis: basis,
  });
  if (key.use !== p.use) return R(false, "KEY_USE_MISMATCH", `key use '${key.use}'`);
  if (p.signedTime !== null && p.signedTime > p.now + p.skew) {
    return R(false, "SIGNED_TIME_IN_FUTURE", `signed time ${p.signedTime} is in the future`);
  }
  const nb = key.not_before ?? null;
  const na = key.not_after ?? null;
  switch (key.status) {
    case "reserved":
      return R(false, "KEY_STATUS_RESERVED", "key is reserved (never activated)");
    case "active":
      if (nb === null) return R(false, "KEY_WINDOW_MALFORMED", "active key without not_before");
      if (T < nb) return R(false, "KEY_NOT_YET_VALID", `T=${T} < not_before ${nb}`);
      if (na !== null && T > na) return R(false, "KEY_EXPIRED", `T=${T} > not_after ${na}`);
      return R(true, undefined, "active key inside its window");
    case "retiring":
    case "retired":
      if (p.signedTime === null) {
        return R(false, "KEY_NEEDS_SIGNED_TIME", `a ${key.status} key needs a signed time`);
      }
      if (nb === null || na === null) {
        return R(false, "KEY_WINDOW_MALFORMED", `${key.status} key without not_before/not_after`);
      }
      if (T < nb) return R(false, "KEY_NOT_YET_VALID", `T=${T} < not_before ${nb}`);
      if (T > na) return R(false, "KEY_EXPIRED", `T=${T} > not_after ${na}`);
      return R(true, undefined, `${key.status} key, signed time inside its window`);
    case "revoked":
      return R(false, "KEY_REVOKED", "revoked key; a signed time alone cannot predate revocation");
    default:
      return R(false, "KEY_STATUS_UNKNOWN", "unknown key status");
  }
}

/** One key of an x402 `delivery-receipt` key directory (spec §7.2). */
export interface DeliveryDirectoryKey {
  kid: string;
  alg: string;
  publicKey: string;
  use: string;
  status: string;
  notBefore: number | null;
  notAfter: number | null;
  revokedAt: number | null;
}

/**
 * Verifies an x402 `delivery-receipt` key directory (spec §7.3): spec, types, root, governance
 * signature and issuer. Only `ml-dsa-65` is implemented. Throws a {@link ReceiptError}.
 *
 * @param input - Parsed directory
 * @param expectedIssuer - Origin the directory must belong to
 * @param pinnedGovernanceKeys - Governance keys pinned for this issuer, if any
 * @returns The keys and how the governance key was trusted
 */
export function verifyDeliveryDirectory(
  input: unknown,
  expectedIssuer: string,
  pinnedGovernanceKeys?: string[],
): { keys: DeliveryDirectoryKey[]; trustBasis: "pinned" | "tls"; epoch: number; root: string } {
  if (!isPlainObject(input)) throw invalid("directory is not an object");
  const d = input;
  if (d.spec !== DELIVERY_KEY_DIRECTORY_SPEC) throw invalid("spec");
  if (d.issuer !== expectedIssuer) {
    throw new ReceiptError("DIRECTORY_ISSUER_MISMATCH", "directory issuer != receipt issuer");
  }
  if (typeof d.epoch !== "number" || !Number.isSafeInteger(d.epoch) || d.epoch < 1) {
    throw invalid("epoch");
  }
  if (typeof d.prevRoot !== "string" || !HEX64.test(d.prevRoot)) throw invalid("prevRoot");
  if (d.epoch === 1 && d.prevRoot !== ZERO_ROOT) throw invalid("prevRoot of epoch 1");
  const gov = d.governanceKey;
  if (!isPlainObject(gov) || Object.keys(gov).length !== 2 || gov.alg !== "ml-dsa-65") {
    throw invalid("governanceKey (only ml-dsa-65 is supported)");
  }
  const govPk = decodeCanonicalBase64(gov.publicKey, ML_DSA_65_PUBLIC_KEY_BYTES);
  if (!govPk) throw invalid("governanceKey.publicKey");
  if (!Array.isArray(d.keys) || d.keys.length === 0 || d.keys.length > 256) throw invalid("keys");
  const nullableTime = (v: unknown) =>
    v === null || (Number.isSafeInteger(v) && (v as number) >= 0);
  const kids = new Set<string>();
  const pubs = new Set<string>();
  for (const e of d.keys as unknown[]) {
    if (!isPlainObject(e) || Object.keys(e).length !== 8) throw invalid("key entry fields");
    if (typeof e.kid !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(e.kid)) throw invalid("kid");
    if (typeof e.alg !== "string" || typeof e.use !== "string") throw invalid("key alg/use");
    if (!(STATUSES as readonly unknown[]).includes(e.status)) throw invalid("key status");
    if (![e.notBefore, e.notAfter, e.revokedAt].every(nullableTime)) throw invalid("key times");
    if (typeof e.publicKey !== "string") throw invalid("key publicKey");
    if (kids.has(e.kid) || pubs.has(e.publicKey)) throw invalid("duplicate key");
    if (e.publicKey === gov.publicKey) throw invalid("governance key listed as a receipt key");
    kids.add(e.kid);
    pubs.add(e.publicKey);
  }
  const keys = d.keys as DeliveryDirectoryKey[];
  const sorted = [...keys].sort((a, b) => (a.kid < b.kid ? -1 : a.kid > b.kid ? 1 : 0));
  const root = sha256Hex(
    jcs(
      {
        spec: d.spec,
        issuer: d.issuer,
        epoch: d.epoch,
        prevRoot: d.prevRoot,
        governanceKey: gov,
        keys: sorted,
      },
      true,
    ),
  );
  if (d.root !== root) throw new ReceiptError("DIRECTORY_ROOT_MISMATCH", "root does not recompute");
  const sig = decodeCanonicalBase64(d.signature, ML_DSA_65_SIGNATURE_BYTES);
  if (!sig || !mlDsa65Verify(govPk, utf8(`${DELIVERY_KEY_DIRECTORY_SPEC}\n${root}`), sig)) {
    throw new ReceiptError("DIRECTORY_SIGNATURE_INVALID", "governance signature does not verify");
  }
  if (pinnedGovernanceKeys) {
    if (!pinnedGovernanceKeys.includes(gov.publicKey as string)) {
      throw new ReceiptError(
        "DIRECTORY_SIGNER_NOT_PINNED",
        "directory governance key is not pinned for this issuer",
      );
    }
    return { keys, trustBasis: "pinned", epoch: d.epoch, root };
  }
  return { keys, trustBasis: "tls", epoch: d.epoch, root };
}

/**
 * `delivery-receipt` key lifecycle at `issuedAt` (spec §7.4).
 *
 * @param entry - Directory entry
 * @param alg - Receipt algorithm
 * @param issuedAt - Signed issuance time
 * @param now - Verifier clock
 * @param skew - Allowed future skew
 * @returns null when authorized, else a reason code
 */
export function deliveryKeyAuthorizationError(
  entry: DeliveryDirectoryKey,
  alg: string,
  issuedAt: number,
  now: number,
  skew: number,
): string | null {
  if (entry.use !== DELIVERY_RECEIPT_KEY_USE) return "KEY_USE_MISMATCH";
  if (entry.alg !== alg) return "KEY_ALG_MISMATCH";
  if (issuedAt > now + skew) return "ISSUED_AT_IN_FUTURE";
  switch (entry.status) {
    case "active":
      if (entry.notBefore === null || issuedAt < entry.notBefore) return "KEY_NOT_YET_VALID";
      if (entry.notAfter !== null && issuedAt > entry.notAfter) return "KEY_EXPIRED";
      return null;
    case "retiring":
    case "retired":
      if (entry.notBefore === null || entry.notAfter === null) return "KEY_WINDOW_UNDEFINED";
      if (issuedAt < entry.notBefore || issuedAt > entry.notAfter) return "KEY_EXPIRED";
      return null;
    case "revoked":
      return "KEY_REVOKED";
    default:
      return "KEY_STATUS_RESERVED";
  }
}

/**
 * Fetches a JSON document over HTTPS (http only for loopback) without following redirects,
 * with a size cap and one deadline, and parses it strictly.
 *
 * @param url - Document URL
 * @param fetchImpl - fetch implementation
 * @returns The parsed document
 */
export async function fetchJsonDocument(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const u = new URL(url);
  const loopback = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && loopback)) {
    throw new ReceiptError("DIRECTORY_UNAVAILABLE", "key directory must be served over https");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      redirect: "error",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new ReceiptError("DIRECTORY_UNAVAILABLE", `HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_DOCUMENT_BYTES) {
      throw new ReceiptError("DIRECTORY_UNAVAILABLE", "key directory too large");
    }
    return parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(buf));
  } catch (error) {
    if (error instanceof ReceiptError) throw error;
    throw new ReceiptError(
      "DIRECTORY_UNAVAILABLE",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}
