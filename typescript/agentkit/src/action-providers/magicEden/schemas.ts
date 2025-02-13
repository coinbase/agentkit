import { z } from "zod";

/**
 * Input schema for bidding on an NFT (ERC721) or collection on Magic Eden.
 */
export const BidSchema = z
  .object({
    weiPrice: z.string().min(1, "Bid amount in wei is required").describe("Bid amount in wei"),
    expirationTime: z
      .string()
      .min(1, "Expiration time is required")
      .describe("Bid expiration time (epoch)"),
    apiKey: z.string().min(1, "API key is required").describe("Magic Eden API key"),
    token: z.string().optional().describe("The NFT ID in the format 'collectionAddress:tokenId'"),
    collection: z.string().optional().describe("The collection address"),
  })
  .strip()
  .describe("Input schema for NFT bid action");

/**
 * Input schema for buying an NFT (ERC721) on Magic Eden.
 * Users can either buy a specific NFT token or any number of tokens off the floor.
 */
export const BuySchema = z
  .object({
    token: z.string().optional().describe("The NFT ID in the format 'collectionAddress:tokenId'"),
    collection: z.string().optional().describe("The collection address"),
    quantity: z.number().optional().describe("The quantity of tokens to buy"),
    apiKey: z.string().min(1, "API key is required").describe("Magic Eden API key"),
  })
  .strip()
  .describe("Input schema for NFT buy action");

/**
 * Input schema for listing an NFT (ERC721) on Magic Eden.
 */
export const ListSchema = z
  .object({
    token: z
      .string()
      .min(1, "Token is required in the format 'collectionAddress:tokenId'")
      .describe("The NFT ID in the format 'collectionAddress:tokenId'"),
    weiPrice: z
      .string()
      .min(1, "Listing price in wei is required")
      .describe("Listing price in wei"),
    expirationTime: z.string().optional().describe("Optional listing expiration time (epoch)"),
    apiKey: z.string().min(1, "API key is required").describe("Magic Eden API key"),
  })
  .strip()
  .describe("Input schema for NFT list action");

/**
 * Input schema for accepting an offer (selling) an NFT on Magic Eden.
 */
export const SellSchema = z
  .object({
    token: z
      .string()
      .min(1, "Token is required in the format 'collectionAddress:tokenId'")
      .describe("The NFT ID in the format 'collectionAddress:tokenId'"),
    apiKey: z.string().min(1, "API key is required").describe("Magic Eden API key"),
  })
  .strip()
  .describe("Input schema for accepting an offer on an NFT");
