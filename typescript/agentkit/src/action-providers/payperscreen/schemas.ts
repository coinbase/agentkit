import { z } from "zod";

export const ScreenNameSchema = z
  .object({
    name: z.string().min(1).describe("Full name of the person or company to screen"),
    dob: z
      .string()
      .optional()
      .describe(
        "Date of birth as YYYY-MM-DD (or YYYY). Pass it whenever known: it helps rule out namesakes",
      ),
    country: z.string().optional().describe("Nationality or country, e.g. 'Brazil' or 'BR'"),
    type: z
      .enum(["Individual", "Entity"])
      .optional()
      .describe("Individual (default) or Entity (a company or organisation)"),
    threshold: z
      .number()
      .min(0.3)
      .max(1)
      .optional()
      .describe("How close a name must be to count, 0.3 (broad) to 1 (exact only). Default 0.4"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Possible matches per list, default 1"),
  })
  .describe("Screen a person or company name against sanctions and export-control lists");

export const ScreenWalletSchema = z
  .object({
    address: z
      .string()
      .min(1)
      .describe("Wallet address (Bitcoin, Ethereum/EVM, Tron, Solana and more)"),
  })
  .describe("Screen a crypto wallet address");

export const CheckEmailSchema = z
  .object({
    email: z.string().min(3).describe("Email address to check"),
  })
  .describe("Check an email address for fraud and trust signals");

export const CheckIpSchema = z
  .object({
    ip: z.string().min(2).describe("Public IPv4 or IPv6 address"),
  })
  .describe("Check an IP address for sanctioned-country, VPN, proxy and Tor signals");

export const ListsCoverageSchema = z.object({}).describe("List what PayPerScreen checks (free)");

/** Configuration for the PayPerScreen action provider. */
export interface PayPerScreenConfig {
  /** API base URL. Defaults to https://api.payperscreen.com (or PAYPERSCREEN_API_URL). */
  apiUrl?: string;
  /**
   * Most the agent may pay for one check, in USD. Any price above this is refused before
   * anything is signed. Defaults to 0.05 (or PAYPERSCREEN_MAX_PRICE_USD). Checks cost $0.02.
   */
  maxPriceUsd?: number;
  /** Most the agent may spend in total during this process's lifetime, in USD. Defaults to 1.00 (or PAYPERSCREEN_MAX_SPEND_USD). */
  maxSpendUsd?: number;
}
