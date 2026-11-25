// ncrypted v1 envelope: AES-256-GCM with a key derived by HKDF-SHA256 from a random 32-byte link key
// (plus PBKDF2-SHA256 of an optional passphrase). The link key travels only in the URL #fragment.
// Reference implementation: https://github.com/Seidl-Family/ncrypted/blob/main/packages/sdk/src/crypto.ts

const PBKDF2_ITERATIONS = 600_000;
const INFO = new TextEncoder().encode("ncrypted v1");
export const MAX_PLAINTEXT_BYTES = 64 * 1024;

export interface EncryptedPayload {
  v: number;
  ciphertext: string;
  iv: string;
  salt: string;
  hasPassphrase: boolean;
}

/**
 * Encodes bytes as base64url without padding.
 *
 * @param bytes - The bytes to encode
 * @returns The base64url string
 */
export function toB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Decodes a base64url string.
 *
 * @param s - The base64url string
 * @returns The decoded bytes
 */
export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

/**
 * Derives the AES-GCM key from the link key, salt and optional passphrase.
 *
 * @param linkKey - The 32-byte link key
 * @param salt - The 16-byte salt
 * @param passphrase - Optional passphrase
 * @returns The derived AES-GCM key
 */
async function deriveKey(linkKey: Uint8Array, salt: Uint8Array<ArrayBuffer>, passphrase?: string) {
  let ikm: Uint8Array<ArrayBuffer> = new Uint8Array(linkKey);
  if (passphrase) {
    const pw = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const stretched = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
        pw,
        256,
      ),
    );
    ikm = new Uint8Array(linkKey.length + stretched.length);
    ikm.set(linkKey);
    ikm.set(stretched, linkKey.length);
  }
  const base = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: INFO },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts plaintext with a fresh random link key.
 *
 * @param plaintext - The secret to encrypt
 * @param passphrase - Optional passphrase
 * @returns The payload for the server and the link key for the URL fragment
 */
export async function encrypt(
  plaintext: string,
  passphrase?: string,
): Promise<{ payload: EncryptedPayload; key: string }> {
  const data = new TextEncoder().encode(plaintext);
  if (data.length === 0) throw new Error("Secret is empty");
  if (data.length > MAX_PLAINTEXT_BYTES)
    throw new Error(`Secret exceeds ${MAX_PLAINTEXT_BYTES} bytes`);
  const linkKey = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(linkKey, salt, passphrase);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return {
    payload: {
      v: 1,
      ciphertext: toB64url(ct),
      iv: toB64url(iv),
      salt: toB64url(salt),
      hasPassphrase: !!passphrase,
    },
    key: toB64url(linkKey),
  };
}

/**
 * Decrypts a payload with its link key (and passphrase, if one was set).
 *
 * @param payload - The encrypted payload
 * @param linkKey - The base64url link key from the URL fragment
 * @param passphrase - Optional passphrase
 * @returns The plaintext
 */
export async function decrypt(
  payload: EncryptedPayload,
  linkKey: string,
  passphrase?: string,
): Promise<string> {
  if (payload.hasPassphrase && !passphrase) throw new Error("This secret requires a passphrase");
  const key = await deriveKey(
    fromB64url(linkKey),
    fromB64url(payload.salt),
    payload.hasPassphrase ? passphrase : undefined,
  );
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64url(payload.iv) },
      key,
      fromB64url(payload.ciphertext),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("Decryption failed: wrong key or passphrase, or the data was tampered with");
  }
}

/**
 * Splits a share link into origin, id and key.
 *
 * @param link - A link like https://ncrypted.ai/s/{id}#{key}
 * @returns The origin, id and key
 */
export function parseLink(link: string): { origin: string; id: string; key: string } {
  const url = new URL(link);
  const m = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{16,64})\/?$/);
  const key = url.hash.slice(1);
  if (!m || !key) throw new Error("Not a valid ncrypted link (expected https://host/s/{id}#{key})");
  return { origin: url.origin, id: m[1], key };
}
