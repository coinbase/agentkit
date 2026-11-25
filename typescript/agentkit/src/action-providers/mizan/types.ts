/**
 * A credential entry as served by the MIZAN public registry.
 */
export interface MizanCredential {
  id: string;
  alias?: string;
  verdict?: string;
  era?: string;
  engine_image_id?: string;
  anchor?: { sha256?: string };
  links?: { bundle?: string; verify?: string };
  verify_command?: string;
}

/**
 * Registry response shape.
 */
export interface MizanRegistry {
  credentials: MizanCredential[];
  registry_root?: string;
}

/**
 * Result returned by verify_credential.
 */
export interface VerifyResult {
  found: boolean;
  id?: string;
  alias?: string;
  verdict: string;
  verdictRaw?: string;
  era?: string;
  engineImageId?: string;
  bundle?: string;
  registrySha256?: string;
  registryRoot?: string;
  hashMatch?: boolean | null;
  reason?: string;
  note: string;
}
