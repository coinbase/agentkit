import { z } from "zod";

export const CheckTrustScoreSchema = z
  .object({
    address: z
      .string()
      .describe("The Ethereum address of the agent or token to check trust score for"),
  })
  .strip()
  .describe("Input schema for checking an agent or token trust score");

export const CheckTokenSafetySchema = z
  .object({
    token: z
      .string()
      .describe("The ERC-20 token contract address to check for safety"),
  })
  .strip()
  .describe("Input schema for checking token safety (honeypot, high tax, rug pull)");

export const GetAgentReputationSchema = z
  .object({
    address: z
      .string()
      .describe("The Ethereum address of the agent to get reputation for"),
  })
  .strip()
  .describe("Input schema for getting full agent reputation profile");
