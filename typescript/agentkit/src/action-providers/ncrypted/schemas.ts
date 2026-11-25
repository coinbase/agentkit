import { z } from "zod";

export const CreateSecretSchema = z
  .object({
    secret: z
      .string()
      .min(1)
      .max(65536)
      .describe("The sensitive value to share, such as a password, API key or private note."),
    ttlSeconds: z
      .number()
      .int()
      .min(300)
      .max(604800)
      .optional()
      .describe(
        "How long the link stays valid if never opened, in seconds (300 to 604800). Defaults to 86400 (24h).",
      ),
    passphrase: z
      .string()
      .optional()
      .describe(
        "Optional extra secret the recipient must also know. Share it through a different channel than the link.",
      ),
    emailTo: z
      .string()
      .email()
      .optional()
      .describe("Optional email address to send the link to. Requires a paid secret (0.005 USDC)."),
  })
  .describe("Instructions for creating a one-time secret link");

export const ReadSecretSchema = z
  .object({
    link: z
      .string()
      .url()
      .describe(
        "The full ncrypted link, including the #key fragment, e.g. https://ncrypted.ai/s/{id}#{key}",
      ),
    passphrase: z.string().optional().describe("Required only if the sender set a passphrase."),
  })
  .describe("Instructions for reading (and destroying) a one-time secret");

export const SecretStatusSchema = z
  .object({
    id: z.string().describe("The secret id returned by create_secret."),
    receiptToken: z.string().describe("The receipt token returned by create_secret."),
  })
  .describe("Instructions for checking whether a one-time secret has been read");

/**
 * Configuration for the ncrypted action provider.
 */
export interface NcryptedConfig {
  /** API origin. Defaults to https://ncrypted.ai */
  baseUrl?: string;
  /** Maximum USDC the provider will pay for a single secret. Defaults to 0.01. */
  maxPaymentUsdc?: number;
}
