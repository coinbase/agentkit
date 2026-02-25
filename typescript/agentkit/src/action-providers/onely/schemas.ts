import { z } from "zod";

// ==========================================
// BUYER ACTIONS
// ==========================================

/**
 * Schema for searching APIs and services on the 1ly marketplace
 */
export const OneLySearchSchema = z.object({
  query: z.string().describe("Search term (e.g., 'weather api', 'image generation')"),
  type: z
    .enum(["api", "standard"])
    .optional()
    .describe("Filter by link type: 'api' for API endpoints, 'standard' for digital products"),
  maxPrice: z.number().optional().describe("Maximum price in USD"),
  minPrice: z.number().optional().describe("Minimum price in USD"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("Number of results (default: 10, max: 50)"),
});

/**
 * Schema for getting details of a specific API listing
 */
export const OneLyGetDetailsSchema = z.object({
  endpoint: z
    .string()
    .describe("API endpoint path (e.g., 'joe/weather' or '/api/link/joe/weather')"),
});

/**
 * Schema for calling a paid API with x402 payment
 */
export const OneLyCallSchema = z.object({
  endpoint: z
    .string()
    .describe("API endpoint path (e.g., 'joe/weather' or '/api/link/joe/weather')"),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .optional()
    .default("GET")
    .describe("HTTP method (default: GET)"),
  body: z.record(z.unknown()).optional().describe("Request body for POST/PUT/PATCH requests"),
  headers: z.record(z.string()).optional().describe("Additional headers to send"),
});

/**
 * Schema for leaving a review after purchasing an API
 */
export const OneLyReviewSchema = z.object({
  purchaseId: z.string().describe("Purchase ID from the API call response"),
  wallet: z.string().describe("Wallet address used for the purchase"),
  token: z.string().describe("Review token from the API call response"),
  positive: z.boolean().describe("Whether the review is positive (true) or negative (false)"),
  comment: z.string().optional().describe("Optional review comment"),
});

// ==========================================
// SELLER ACTIONS
// ==========================================

/**
 * Schema for creating a new store on the 1ly marketplace
 */
export const OneLyCreateStoreSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .optional()
    .describe("Unique username for the store (3-20 characters)"),
  displayName: z
    .string()
    .max(50)
    .optional()
    .describe("Display name for the store (max 50 characters)"),
  avatarUrl: z.string().url().optional().describe("URL to store avatar image"),
});

/**
 * Schema for creating a new API listing
 */
export const OneLyCreateLinkSchema = z.object({
  title: z.string().min(1).max(200).describe("Title of the API listing (1-200 characters)"),
  url: z.string().url().describe("URL of the API endpoint to list"),
  description: z
    .string()
    .max(500)
    .optional()
    .describe("Description of the API (max 500 characters)"),
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .describe("URL-friendly slug (3-64 characters, lowercase alphanumeric and hyphens)"),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,18})?$/)
    .optional()
    .describe("Price in USDC (e.g., '0.01' for 1 cent)"),
  currency: z.literal("USDC").optional().describe("Currency (only USDC supported)"),
  isPublic: z
    .boolean()
    .optional()
    .describe("Whether the listing is publicly visible (default: true)"),
  isStealth: z
    .boolean()
    .optional()
    .describe("Whether the listing is in stealth mode (default: false)"),
  webhookUrl: z.string().url().optional().describe("Optional webhook URL for purchase events"),
});

/**
 * Schema for listing all API listings (no parameters required)
 */
export const OneLyListLinksSchema = z.object({});

/**
 * Schema for getting store statistics and earnings
 */
export const OneLyGetStatsSchema = z.object({
  period: z
    .enum(["7d", "30d", "90d", "all"])
    .optional()
    .describe("Time period for statistics (default: all)"),
  linkId: z.string().uuid().optional().describe("Filter statistics by specific link ID"),
});

/**
 * Schema for withdrawing earnings from the marketplace
 */
export const OneLyWithdrawSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,18})?$/)
    .describe("Amount to withdraw in USDC (e.g., '10.50')"),
  walletAddress: z
    .string()
    .min(26)
    .describe("Destination wallet address (Base or Solana address)"),
});

/**
 * Configuration for the OneLy action provider
 */
export type OneLyConfig = {
  /**
   * API key for seller actions (obtained from onely_create_store)
   */
  apiKey?: string;

  /**
   * Custom API base URL (default: https://1ly.store)
   */
  apiBase?: string;
};
