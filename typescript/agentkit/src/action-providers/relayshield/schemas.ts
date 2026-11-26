import { z } from "zod";

/**
 * Action schemas for the relayshield action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the relayshield action provider.
 */

/**
 * Schema for screening a single wallet address for counterparty risk.
 */
export const ScreenWalletSchema = z
  .object({
    address: z
      .string()
      .min(1)
      .describe(
        "The wallet address to screen. Accepts EVM (0x followed by 40 hex characters), " +
          "Solana (base58), TON (EQ... or UQ...) and Bitcoin addresses. The chain is " +
          "detected from the address format, so it does not need to be supplied.",
      ),
  })
  .strip()
  .describe("Screen a counterparty wallet address for known malicious association");

/**
 * Schema for checking a token contract for security risks.
 */
export const CheckTokenSecuritySchema = z
  .object({
    contractAddress: z.string().min(1).describe("The token contract address to check"),
    chainId: z
      .string()
      .min(1)
      .describe(
        "The chain id the token is deployed on, as a decimal string. " +
          "For example '1' for Ethereum mainnet, '8453' for Base, '56' for BNB Chain.",
      ),
  })
  .strip()
  .describe("Check a token contract for honeypot, rug pull and other security risks");

/**
 * Schema for checking an NFT collection for security risks.
 */
export const CheckNftSecuritySchema = z
  .object({
    contractAddress: z.string().min(1).describe("The NFT collection contract address to check"),
    chainId: z
      .string()
      .min(1)
      .describe(
        "The chain id the collection is deployed on, as a decimal string. " +
          "For example '1' for Ethereum mainnet, '8453' for Base.",
      ),
  })
  .strip()
  .describe("Check an NFT collection for security risks before buying");

/**
 * Schema for screening a URL for phishing or malware.
 */
export const ScreenUrlSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe("The full URL to screen, including the scheme (http:// or https://)"),
  })
  .strip()
  .describe("Screen a URL for phishing or malware before following it");
