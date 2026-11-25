import { z } from "zod";

const SourcesSchema = z
  .record(z.string(), z.string())
  .describe(
    'Map of file path to Solidity source, e.g. {"src/Vault.sol": "pragma solidity ^0.8.20; ..."}. Include every file the contract imports (OpenZeppelin 5 imports are supplied by the service).',
  );

/**
 * Input schema for the free preview.
 */
export const KestrovaPreviewSchema = z
  .object({
    sources: SourcesSchema,
  })
  .strip()
  .describe("Input schema for a free Kestrova Solidity security preview");

/**
 * Input schema for reading the price of a paid scan.
 */
export const KestrovaPriceSchema = z
  .object({
    tier: z
      .enum(["findings", "full"])
      .describe(
        "findings: every finding with file and line (0.25 USDC). full: adds an explanation and fix per finding plus PDF/SARIF (1 USDC).",
      ),
  })
  .strip()
  .describe("Input schema for reading Kestrova's payment terms");

/**
 * Input schema for a paid scan.
 */
export const KestrovaPaidScanSchema = z
  .object({
    sources: SourcesSchema,
    tier: z
      .enum(["findings", "full"])
      .describe(
        "findings: every finding with file and line (0.25 USDC). full: adds an explanation and fix per finding plus PDF/SARIF (1 USDC).",
      ),
  })
  .strip()
  .describe("Input schema for a paid Kestrova Solidity scan");

/**
 * Provider configuration.
 */
export interface KestrovaConfig {
  /** Service base URL (default https://kestrova-api.onrender.com). */
  baseUrl?: string;
  /** Maximum USDC the provider may pay per call (default 1.0, or KESTROVA_MAX_PAYMENT_USDC). */
  maxPaymentUsdc?: number;
}
