import { z } from "zod";

/**
 * Input schema for scraping a webpage into Markdown.
 */
export const ScrapeWebpageSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe("The target webpage URL to scrape and convert into clean, token-efficient Markdown."),
  })
  .strip()
  .describe("Instructions for scraping a webpage");

/**
 * Input schema for generating an executive digest of a webpage.
 */
export const DigestWebpageSchema = z
  .object({
    url: z.string().url().describe("The webpage URL to synthesize."),
    format: z
      .enum(["bullets", "executive", "technical"])
      .default("executive")
      .describe("Digest format style (bullets, executive, or technical)."),
  })
  .strip()
  .describe("Instructions for synthesizing a webpage digest");

/**
 * Input schema for auditing a webpage or smart contract frontend for security.
 */
export const AuditWebpageSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe(
        "The target website or dApp URL to audit for phishing, credibility, and security signals.",
      ),
  })
  .strip()
  .describe("Instructions for auditing website security and reputation");

/**
 * Input schema for searching the live web.
 */
export const SearchWebSchema = z
  .object({
    query: z.string().describe("The research query or topic to search across the live web."),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of search results to return (1-10)."),
  })
  .strip()
  .describe("Instructions for searching the live web");

/**
 * Input schema for searching Twitter/X sentiment and posts.
 */
export const SearchTwitterSchema = z
  .object({
    query: z
      .string()
      .describe("Cashtag (e.g. $BASE, $ETH, $SOL) or keyword to search on Twitter/X."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum number of tweets to retrieve (1-20)."),
  })
  .strip()
  .describe("Instructions for searching Twitter/X posts");

/**
 * Input schema for getting a Twitter/X user profile.
 */
export const GetTwitterProfileSchema = z
  .object({
    handle: z
      .string()
      .describe("The Twitter/X username handle without '@' (e.g. 'base', 'coinbase')."),
  })
  .strip()
  .describe("Instructions for fetching Twitter/X user profile");

/**
 * Configuration options for the X402ScraperActionProvider.
 */
export interface X402ScraperConfig {
  /**
   * The base URL of the x402 scraper worker engine.
   * Defaults to official production Cloudflare Worker: https://x402-scraper-engine.gejoe-tt.workers.dev
   */
  workerUrl?: string;

  /**
   * The destination Base L2 treasury address for USDC payments.
   * Defaults to official Base treasury: 0x4107f297256E00F32873f45F50A35a902c1c2034
   */
  treasuryAddress?: string;

  /**
   * Maximum acceptable payment in USDC per request to safeguard against excessive charges.
   * Defaults to 0.50 USDC.
   */
  maxPaymentUsdc?: number;
}
