import { createHash, createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import { VerifyPatchSchema } from "./schemas";

// Frozen GLEE Acceptance v0 contract, from the service's acceptance_v0.js and
// executePatchVerification in x402_verifier_service.js. Signatures cover the
// UTF-8 SHA-256 hex digest of sorted, compact JSON, excluding only `signature`.
const VERIFIER = { name: "glee-acceptance-verifier", version: "0.1.0" };
const METHODOLOGY_HASH = "0f3b0b09ab269ca98c862b20ec6eb39af4de14751bd6a3a1bd47d947b5ac0cb1";
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const VerdictSchema = z.enum(["PASS", "FAIL", "INSUFFICIENT_EVIDENCE"]);
const VerifierSchema = z.object({
  name: z.literal(VERIFIER.name),
  version: z.literal(VERIFIER.version),
});
const ReceiptSchema = z
  .object({
    receipt_schema: z.literal("glee.acceptance_receipt.v0"),
    service: z.literal("/api/x402/verify/patch"),
    capability: z.literal("patch_verification"),
    outcome: VerdictSchema,
    artifact_hash: HashSchema,
    acceptance_contract_hash: HashSchema,
    verification_hash: HashSchema,
    request_hash: HashSchema,
    request_hash_schema: z.literal("glee.canonical_request.v1"),
    job_id: z.string().nullable(),
    verifier: VerifierSchema.passthrough(),
    methodology_hash: z.literal(METHODOLOGY_HASH),
    payment: z
      .object({
        network: z.literal("eip155:8453"),
        asset: z.literal("USDC"),
        amount_atomic: z.literal("50000"),
        pay_to: z.string(),
        payer: z.string(),
        stage: z.literal("settled"),
      })
      .passthrough(),
    key: z
      .object({
        algorithm: z.literal("Ed25519"),
        key_id: z.string(),
        public_key_hex: HashSchema,
        fingerprint_sha256: HashSchema,
      })
      .passthrough(),
    signature: z.string().regex(/^[a-f0-9]{128}$/i),
  })
  .passthrough();
const ResultSchema = z.object({
  service: z.literal("patch_verification"),
  verification_mode: z.literal("static_analysis"),
  verdict: VerdictSchema,
  score: z.number().finite(),
  findings: z.array(z.record(z.string(), z.unknown())),
  modified_files: z.array(z.string()),
  stats: z.object({ added_lines: z.number(), deleted_lines: z.number(), hunks_count: z.number() }),
  limitations: z.array(z.string()),
  artifact_hash: HashSchema,
  acceptance_contract_hash: HashSchema,
  verification_hash: HashSchema,
  methodology_hash: z.literal(METHODOLOGY_HASH),
  verifier: VerifierSchema,
});

/**
 * Hashes the exact UTF-8 text using the service's SHA-256 encoding.
 *
 * @param text - Text to hash
 * @returns Lowercase hexadecimal SHA-256 digest
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Serializes the service's sorted compact JSON representation.
 *
 * @param value - JSON-compatible value
 * @returns Canonical JSON
 */
function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("Receipt contains non-JSON data");
}

/**
 * Authenticates the signed receipt and binds the returned result to the submitted request.
 *
 * @param body - Untrusted response JSON
 * @param request - Snapshot of the exact request sent to both HTTP calls
 * @param trustedPublicKeyHex - Operator-pinned raw Ed25519 public key
 * @param payTo - Operator-approved payment recipient
 * @param payer - Address that authorized this request
 * @returns Only authenticated result fields and their signed receipt
 */
export function authenticateDelivery(
  body: unknown,
  request: z.infer<typeof VerifyPatchSchema>,
  trustedPublicKeyHex: string,
  payTo: string,
  payer: string,
) {
  const parsed = z
    .object({ ok: z.literal(true), acceptance_receipt: ReceiptSchema, result: ResultSchema })
    .safeParse(body);
  if (!parsed.success) throw new Error("Receipt verification unavailable: invalid delivery schema");
  const { acceptance_receipt: receipt, result } = parsed.data;
  const { signature, ...signedPayload } = receipt;
  const key = receipt.key;
  if (
    key.public_key_hex !== trustedPublicKeyHex.toLowerCase() ||
    key.fingerprint_sha256 !== sha256(key.public_key_hex) ||
    key.key_id !== `glee-acceptance-${key.fingerprint_sha256.slice(0, 16)}`
  ) {
    throw new Error("Receipt verification failed: untrusted signing key");
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(trustedPublicKeyHex, "hex"),
    ]),
    format: "der",
    type: "spki",
  });
  if (
    !verify(
      null,
      Buffer.from(sha256(canonicalJson(signedPayload)), "utf8"),
      publicKey,
      Buffer.from(signature, "hex"),
    )
  ) {
    throw new Error("Receipt verification failed: invalid Ed25519 signature");
  }
  const artifactHash = sha256(request.patch);
  const contractHash = sha256(
    canonicalJson({
      contract_schema: "glee.acceptance.v0",
      path_policy: request.path_policy || {},
      assertions: request.assertions || [],
      verifier: VERIFIER,
      methodology_hash: METHODOLOGY_HASH,
    }),
  );
  // These fields, in this order, are the service's canonical_result. All
  // unbound response fields are dropped from the public return value.
  const canonicalResult = {
    service: result.service,
    verification_mode: result.verification_mode,
    verdict: result.verdict,
    score: result.score,
    findings: result.findings,
    modified_files: result.modified_files,
    stats: result.stats,
    limitations: result.limitations,
  };
  const verificationHash = sha256(
    JSON.stringify({
      canonical_request: {
        patch: request.patch,
        path_policy: request.path_policy || {},
        assertions: request.assertions || [],
        artifact_sha256: artifactHash,
        job_id: request.job_id || null,
        acceptance_contract_hash: contractHash,
      },
      verifier: VERIFIER,
      verifier_version: VERIFIER.version,
      methodology_hash: METHODOLOGY_HASH,
      policy_version: "v1.0.0",
      canonical_result: canonicalResult,
    }),
  );
  if (
    receipt.request_hash !== sha256(canonicalJson(request)) ||
    receipt.artifact_hash !== artifactHash ||
    receipt.acceptance_contract_hash !== contractHash ||
    receipt.job_id !== (request.job_id || null) ||
    receipt.outcome !== result.verdict ||
    receipt.verification_hash !== verificationHash ||
    result.verification_hash !== verificationHash ||
    result.artifact_hash !== artifactHash ||
    result.acceptance_contract_hash !== contractHash ||
    canonicalJson(receipt.verifier) !== canonicalJson(VERIFIER) ||
    receipt.payment.pay_to.toLowerCase() !== payTo.toLowerCase() ||
    receipt.payment.payer.toLowerCase() !== payer.toLowerCase()
  ) {
    throw new Error("Receipt verification failed: request, result, or payment binding mismatch");
  }
  return {
    ok: true,
    receipt_verified: true,
    acceptance_receipt: receipt,
    result: { ...canonicalResult, verification_hash: verificationHash },
  };
}
