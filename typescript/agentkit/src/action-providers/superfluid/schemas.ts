import { z } from "zod";

/**
 * Input schema for creating a Superfluid stream
 */
export const SuperfluidCreateStreamSchema = z
  .object({
    erc20TokenAddress: z.string().describe("The ERC20 token to start or update streaming"),
    chainId: z.string().describe("The EVM chain ID on which the ERC20 is deployed"),
    recipientAddress: z.string().describe("The EVM address to stream the token to."),
    flowRate: z.string().describe("The rate at which the ERC20 is streamed to the recipient"),
  })
  .strip()
  .describe("Input schema for creating or updating a Superfluid stream");

/**
 * Input schema for deleting a Superfluid stream
 */
export const SuperfluidDeleteStreamSchema = z
  .object({
    erc20TokenAddress: z.string().describe("The ERC20 token to start streaming"),
    chainId: z.string().describe("The EVM chain ID on which the ERC20 is deployed"),
    recipientAddress: z.string().describe("The EVM address to stream the token to."),
  })
  .strip()
  .describe("Input schema for creating a Superfluid stream");

/**
 * Input schema for creating a Superfluid pool
 */
export const SuperfluidCreatePoolSchema = z
  .object({
    erc20TokenAddress: z.string().describe("The ERC20 token for which to create a pool"),
    chainId: z.string().describe("The EVM chain ID on which the ERC20 is deployed"),
  })
  .strip()
  .describe("Input schema for creating a Superfluid pool");

/**
 * Input schema for updating a Superfluid pool
 */
export const SuperfluidUpdatePoolSchema = z
  .object({
    poolAddress: z.string().describe("The EVM address of the token pool"),
    recipientAddress: z.string().describe("The EVM address to stream the token to, from the pool."),
    chainId: z.string().describe("The EVM chain ID on which the pool is deployed"),
    units: z.number().describe("The new units of the recipient in the pool."),
  })
  .strip()
  .describe("Input schema for updating a Superfluid pool");

/**
 * Empty input schema
 */
export const EmptySchema = z.object({}).strip().describe("Empty input schema");
