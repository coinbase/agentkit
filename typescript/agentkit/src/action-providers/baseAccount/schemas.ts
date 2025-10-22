import { z } from "zod";

/**
 * Input schema for listing Base Account spend permissions action.
 */
export const ListBaseAccountSpendPermissionsSchema = z
  .object({
    baseAccount: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The Base Account address to query if it has granted spend permissions"),
  })
  .strip()
  .describe("Instructions for listing spend permissions for a Base Account");

/**
 * Input schema for using a Base Account spend permission action.
 */
export const UseBaseAccountSpendPermissionSchema = z
  .object({
    baseAccount: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The Base Account address that has granted the spend permission"),
    amount: z
      .number()
      .positive()
      .optional()
      .describe(
        "The amount to spend in whole units of the token (e.g. 4.6 for 4.6 tokens). If not provided, will withdraw the full remaining allowance",
      ),
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe(
        "The token contract address. If not provided, will use the first available permission token",
      ),
    permissionIndex: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "The index of the permission to use (1-based). If not provided, the first permission will be used",
      ),
  })
  .strip()
  .describe("Instructions for using a Base Account spend permission");

/**
 * Input schema for revoking a Base Account spend permission action.
 */
export const RevokeBaseAccountSpendPermissionSchema = z
  .object({
    baseAccount: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The Base Account address that has granted the spend permission"),
    permissionIndex: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "The index of the permission to revoke (1-based). If not provided, the first permission will be revoked",
      ),
  })
  .strip()
  .describe("Instructions for revoking a Base Account spend permission");
