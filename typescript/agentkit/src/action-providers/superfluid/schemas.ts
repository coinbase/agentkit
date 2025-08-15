import { z } from "zod";

/**
 * Input schema for creating a Superfluid stream
 */
export const SuperfluidCreateStreamSchema = z
  .object({
    erc20TokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The ERC20 Super token to start or update streaming"),
    recipientAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The EVM address to stream the token to."),
    flowRate: z.string().describe("The rate at which the ERC20 is streamed to the recipient"),
  })
  .strip()
  .describe("Input schema for creating or updating a Superfluid stream");

/**
 * Input schema for deleting a Superfluid stream
 */
export const SuperfluidDeleteStreamSchema = z
  .object({
    erc20TokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The ERC20 token to start streaming"),
    recipientAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The EVM address to stream the token to."),
  })
  .strip()
  .describe("Input schema for creating a Superfluid stream");

/**
 * Input schema for creating a Superfluid pool
 */
export const SuperfluidCreatePoolSchema = z
  .object({
    erc20TokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The ERC20 token for which to create a pool"),
  })
  .strip()
  .describe("Input schema for creating a Superfluid pool");

/**
 * Input schema for updating a Superfluid pool
 */
export const SuperfluidUpdatePoolSchema = z
  .object({
    poolAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The EVM address of the token pool"),
    recipientAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The EVM address to stream the token to, from the pool."),
    units: z.number().describe("The new units of the recipient in the pool."),
  })
  .strip()
  .describe("Input schema for updating a Superfluid pool");

/**
 * Input schema for wrapping a Superfluid token
 */
export const SuperfluidWrapTokenSchema = z
  .object({
    erc20TokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The ERC20 token to wrap"),
    superTokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The token to wrap to"),
    wrapAmount: z
      .number()
      .describe(
        "The amount of token to wrap.  This is the max amount that will be streamable.  This should be in units of token (and will not take decimals into account)",
      ),
  })
  .strip()
  .describe("Input schema for updating a Superfluid pool");

/**
 * Input schema for creating a Super Token
 */
export const SuperfluidCreateSuperTokenSchema = z
  .object({
    erc20TokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The underlying ERC20 token"),
  })
  .strip()
  .describe("Input schema for creating a Super Token");

/**
 * Empty input schema used for Query action
 */
export const EmptySchema = z.object({}).strip().describe("Empty input schema");
