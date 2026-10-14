import { z } from "zod";

/**
 * Input schema for verifying a MIZAN credential.
 */
export const VerifyCredentialSchema = z
  .object({
    credentialId: z
      .string()
      .nullable()
      .describe("Registry id of the credential, e.g. 'dsr10-flagship'. Omit if sha256 is given."),
    sha256: z
      .string()
      .nullable()
      .describe("Optional sha256 of the proof bundle, used instead of credentialId."),
  })
  .strict();

/**
 * Input schema for listing canonical datasets.
 */
export const ListDatasetsSchema = z.object({}).strict();
