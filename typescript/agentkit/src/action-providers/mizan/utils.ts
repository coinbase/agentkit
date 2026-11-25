/**
 * Classify a raw MIZAN verdict string into PASS | NOT_SIGNIFICANT | SIGNIFICANT | FAIL | LEDGER_ENTRY.
 *
 * @param verdict - Raw verdict string from the registry
 * @returns The verdict class
 */
export function classifyVerdict(verdict: string | undefined): string {
  const v = (verdict || "").toUpperCase();
  for (const k of ["PASS", "NOT SIGNIFICANT", "SIGNIFICANT", "FAIL"]) {
    if (v.startsWith(k)) return k.replace(" ", "_");
  }
  return "LEDGER_ENTRY";
}

/**
 * Hex-encode a SHA-256 digest of the given bytes using WebCrypto.
 *
 * @param bytes - Bytes to hash
 * @returns Lowercase hex digest
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
