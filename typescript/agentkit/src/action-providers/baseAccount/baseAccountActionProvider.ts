import { z } from "zod";
import { formatUnits, parseUnits, getAddress, type Address } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { getTokenDetails } from "../erc20/utils";
import {
  ListBaseAccountSpendPermissionsSchema,
  UseBaseAccountSpendPermissionSchema,
  RevokeBaseAccountSpendPermissionSchema,
} from "./schemas";
import { formatTimestamp, formatPeriod } from "./utils";
import { FetchedPermission } from "./types";
import { retryWithExponentialBackoff } from "../../utils";

/**
 * Fetch spend permissions for a user account from a spender address
 *
 * @param userAccount - The user account address
 * @param spenderAccount - The spender account address
 * @param tokenAddress - Optional token address to filter by. If not provided, returns all permissions
 * @returns Promise resolving to array of fetched permissions
 */
async function fetchUserSpendPermissions(
  userAccount: Address,
  spenderAccount: Address,
  tokenAddress?: Address,
): Promise<FetchedPermission[]> {
  try {
    const { fetchPermissions } = await import("@base-org/account/spend-permission");
    const permissions = await fetchPermissions({
      account: userAccount,
      chainId: 8453,
      spender: spenderAccount,
    });

    if (tokenAddress) {
      return permissions.filter(
        p => p.permission?.token?.toLowerCase() === tokenAddress.toLowerCase(),
      );
    }

    return permissions;
  } catch (error) {
    console.error("❌ Failed to fetch spend permissions:", error);
    return [];
  }
}

/**
 * BaseAccountActionProvider provides actions to interact with Base Account spend permissions.
 */
export class BaseAccountActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the BaseAccountActionProvider.
   */
  constructor() {
    super("base_account", []);
  }

  /**
   * Lists spend permissions that have been granted to the current wallet by a Base Account.
   *
   * @param walletProvider - The wallet provider to use for listing permissions.
   * @param args - The input arguments for listing spend permissions.
   * @returns A JSON string with the list of spend permissions.
   */
  @CreateAction({
    name: "list_base_account_spend_permissions",
    description: `
This tool lists spend permissions that have been granted to the current wallet by a Base Account.

It takes the following inputs:
- baseAccount: The Base Account address to check if it has granted spend permissions

Important notes:
- This tool is specifically designed for Base Account spend permissions
- The returned period is the time duration for resetting the used allowance on a recurring basis within the start and end timestamps
- The returned allowance is the maximum allowed value to spend within each period
`,
    schema: ListBaseAccountSpendPermissionsSchema,
  })
  async listBaseAccountSpendPermissions(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ListBaseAccountSpendPermissionsSchema>,
  ): Promise<string> {
    try {
      // Validate and normalize addresses
      const baseAccount = getAddress(args.baseAccount);
      const spenderAddress = getAddress(walletProvider.getAddress());

      // Fetch permissions with retry logic
      const permissions = await retryWithExponentialBackoff(
        () => fetchUserSpendPermissions(baseAccount, spenderAddress),
        3, // Max 3 retries
        1000, // 1s base delay
      );

      if (permissions.length === 0) {
        return JSON.stringify({
          success: false,
          error:
            "No spend permissions found for Base Account. The user needs to grant spend permissions first through the UI.",
          baseAccount: baseAccount,
          spender: spenderAddress,
          permissionsCount: 0,
        });
      }

      // Format the permissions with token details
      const formattedPermissions = await Promise.all(
        permissions.map(async (permission, index) => {
          const tokenAddress = permission.permission?.token || "";
          const allowanceRaw = permission.permission?.allowance || 0;

          // Get token details for proper formatting
          let tokenName = "Unknown Token";
          let allowanceFormatted: string | undefined;

          if (tokenAddress) {
            const tokenDetails = await getTokenDetails(walletProvider, tokenAddress);
            if (tokenDetails) {
              tokenName = tokenDetails.name;
              allowanceFormatted = formatUnits(allowanceRaw as bigint, tokenDetails.decimals);
            }
          }

          return {
            permissionIndex: index + 1,
            token: tokenAddress,
            tokenName: tokenName,
            allowance: allowanceFormatted || allowanceRaw.toString(),
            createdAt: permission.createdAt ? formatTimestamp(permission.createdAt) : "Unknown",
            period: permission.permission?.period
              ? formatPeriod(permission.permission.period)
              : "Unknown",
            start: permission.permission?.start
              ? formatTimestamp(permission.permission.start)
              : "Unknown",
            end: permission.permission?.end
              ? formatTimestamp(permission.permission.end)
              : "Unknown",
          };
        }),
      );

      return JSON.stringify({
        success: true,
        permissionsCount: permissions.length,
        baseAccount: baseAccount,
        spender: spenderAddress,
        permissions: formattedPermissions,
      });
    } catch (error) {
      console.error("Error listing spend permissions:", error);
      return JSON.stringify({
        success: false,
        error: `Error listing spend permissions: ${error instanceof Error ? error.message : "Unknown error"}`,
        baseAccount: args.baseAccount,
        spender: walletProvider.getAddress(),
      });
    }
  }

  /**
   * Uses a spend permission to transfer tokens from a Base Account to the current wallet.
   *
   * @param walletProvider - The wallet provider to use for the spend operation.
   * @param args - The input arguments for using the spend permission.
   * @returns A JSON string with the spend operation results.
   */
  @CreateAction({
    name: "spend_from_base_account_permission",
    description: `
This tool uses a spend permission to transfer tokens from a Base Account to the current wallet.

It takes the following inputs:
- baseAccount: The Base Account address that has granted the spend permission
- amount: (Optional) The amount to spend in whole units of the token (e.g. 4.6 for 4.6 tokens). If not provided, will withdraw the full remaining allowance
- tokenAddress: (Optional) The token contract address. If not provided, will use the first available permission token
- permissionIndex: (Optional) The index of the permission to use (1-based). If not provided, the first permission will be used

Important notes:
- The Base Account must have previously granted a spend permission to the current agent
- This tool automatically finds and uses the specified token spend permission, or the first valid permission if no token is specified
- The funds are transferred from the Base Account to the current wallet after successful execution
- This is specifically designed for Base Account spend permissions on Base mainnet
`,
    schema: UseBaseAccountSpendPermissionSchema,
  })
  async spendFromBaseAccountPermission(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof UseBaseAccountSpendPermissionSchema>,
  ): Promise<string> {
    try {
      // Validate and normalize addresses
      const baseAccount = getAddress(args.baseAccount);
      const spenderAddress = getAddress(walletProvider.getAddress());
      const tokenAddress = args.tokenAddress ? getAddress(args.tokenAddress) : undefined;

      // Fetch permissions to find a valid one with retry logic
      const permissions = await retryWithExponentialBackoff(
        () => fetchUserSpendPermissions(baseAccount, spenderAddress, tokenAddress),
        3, // Max 3 retries
        1000, // 1s base delay
      );

      if (permissions.length === 0) {
        const errorMsg = tokenAddress
          ? `No spend permissions found for Base Account with token ${tokenAddress}.`
          : "No spend permissions found for Base Account.";
        return JSON.stringify({
          success: false,
          error: `${errorMsg} The user needs to grant spend permissions first through the UI.`,
          baseAccount: baseAccount,
          spender: spenderAddress,
          tokenAddress: tokenAddress,
        });
      }

      // Determine which permission to use
      const permissionIndex = args.permissionIndex || 1;
      if (permissionIndex > permissions.length) {
        return JSON.stringify({
          success: false,
          error: `Permission index ${permissionIndex} is out of range. Only ${permissions.length} permission(s) available.`,
          baseAccount: baseAccount,
          spender: spenderAddress,
          availablePermissions: permissions.length,
        });
      }

      // Use the specified permission (convert to 0-based index)
      const _permission = permissions[permissionIndex - 1];
      const permissionTokenAddress = _permission.permission?.token;

      if (!permissionTokenAddress) {
        return JSON.stringify({
          success: false,
          error: "Permission does not have a valid token address",
          baseAccount: baseAccount,
          spender: spenderAddress,
        });
      }

      // Get token details for proper conversion
      const tokenDetails = await getTokenDetails(walletProvider, permissionTokenAddress);
      if (!tokenDetails) {
        return JSON.stringify({
          success: false,
          error: `Failed to get token details for address: ${permissionTokenAddress}`,
          baseAccount: baseAccount,
          spender: spenderAddress,
          tokenAddress: permissionTokenAddress,
        });
      }

      // Check permission status and prepare spend call data
      const { getPermissionStatus, prepareSpendCallData } = await import(
        "@base-org/account/spend-permission"
      );
      const status = await retryWithExponentialBackoff(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => getPermissionStatus(_permission as any),
        3, // Max 3 retries
        1000, // 1s base delay
        2000, // 2s initial delay
      );

      // Determine amount to spend - use provided amount or full remaining allowance
      const amountInAtomicUnits = args.amount
        ? parseUnits(args.amount.toString(), tokenDetails.decimals)
        : status.remainingSpend;

      if (status.remainingSpend < amountInAtomicUnits) {
        const requestedAmountFormatted =
          args.amount?.toString() || formatUnits(amountInAtomicUnits, tokenDetails.decimals);
        return JSON.stringify({
          success: false,
          error: `Insufficient remaining allowance. Requested: ${requestedAmountFormatted} ${tokenDetails.name}, Available: ${formatUnits(status.remainingSpend, tokenDetails.decimals)} ${tokenDetails.name}`,
          baseAccount: baseAccount,
          spender: spenderAddress,
          tokenAddress: permissionTokenAddress,
          tokenName: tokenDetails.name,
          requestedAmount: requestedAmountFormatted,
          availableAmount: formatUnits(status.remainingSpend, tokenDetails.decimals),
        });
      }

      // Prepare the spend transaction - returns an array of calls
      const spendCalls = await retryWithExponentialBackoff(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => prepareSpendCallData(_permission as any, amountInAtomicUnits),
        3, // Max 3 retries
        1000, // 1s base delay
        2000, // 2s initial delay
      );

      // Take the first call from the array (there should be one for spend operations)
      if (!spendCalls || spendCalls.length === 0) {
        throw new Error("No transaction calls returned from prepareSpendCallData");
      }
      const callData = spendCalls[0];

      // Execute the spend transaction
      const txHash = await walletProvider.sendTransaction({
        to: callData.to,
        data: callData.data,
        value: BigInt(callData.value || "0x0"),
      });

      const amountSpentFormatted = formatUnits(amountInAtomicUnits, tokenDetails.decimals);

      return JSON.stringify({
        success: true,
        transactionHash: txHash,
        amountSpent: amountSpentFormatted,
        tokenAddress: permissionTokenAddress,
        tokenName: tokenDetails.name,
        baseAccount: baseAccount,
        spender: spenderAddress,
        permissionIndex: permissionIndex,
        remainingAllowance: formatUnits(
          status.remainingSpend - amountInAtomicUnits,
          tokenDetails.decimals,
        ),
      });
    } catch (error) {
      console.error("Error using spend permission:", error);
      return JSON.stringify({
        success: false,
        error: `Error using spend permission: ${error instanceof Error ? error.message : "Unknown error"}`,
        baseAccount: args.baseAccount,
        spender: walletProvider.getAddress(),
        amountRequested: args.amount?.toString() || "full allowance",
        tokenAddress: args.tokenAddress,
        permissionIndex: args.permissionIndex,
      });
    }
  }

  /**
   * Revokes a spend permission that was previously granted by a Base Account to the current wallet.
   *
   * @param walletProvider - The wallet provider to use for the revoke operation.
   * @param args - The input arguments for revoking the spend permission.
   * @returns A JSON string with the revoke operation results.
   */
  @CreateAction({
    name: "revoke_base_account_spend_permission",
    description: `
This tool revokes a spend permission that was previously granted by a Base Account to the current wallet.

It takes the following inputs:
- baseAccount: The Base Account address that has granted the spend permission
- permissionIndex: (Optional) The index of the permission to revoke (1-based). If not provided, the first permission will be revoked

Important notes:
- This permanently revokes the spend permission - it cannot be undone
- The Base Account must have previously granted a spend permission to the current agent
- This tool automatically finds and revokes the specified token spend permission
- This is specifically designed for Base Account spend permissions on Base mainnet
`,
    schema: RevokeBaseAccountSpendPermissionSchema,
  })
  async revokeBaseAccountSpendPermission(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RevokeBaseAccountSpendPermissionSchema>,
  ): Promise<string> {
    try {
      // Validate and normalize addresses
      const baseAccount = getAddress(args.baseAccount);
      const spenderAddress = getAddress(walletProvider.getAddress());

      // Fetch permissions to find the one to revoke with retry logic
      const permissions = await retryWithExponentialBackoff(
        () => fetchUserSpendPermissions(baseAccount, spenderAddress),
        3, // Max 3 retries
        1000, // 1s base delay
      );

      if (permissions.length === 0) {
        return JSON.stringify({
          success: false,
          error: "No spend permissions found for Base Account. There are no permissions to revoke.",
          baseAccount: baseAccount,
          spender: spenderAddress,
        });
      }

      // Determine which permission to revoke
      const permissionIndex = args.permissionIndex || 1;
      if (permissionIndex > permissions.length) {
        return JSON.stringify({
          success: false,
          error: `Permission index ${permissionIndex} is out of range. Only ${permissions.length} permission(s) available.`,
          baseAccount: baseAccount,
          spender: spenderAddress,
          availablePermissions: permissions.length,
        });
      }

      // Use the specified permission (convert to 0-based index)
      const _permission = permissions[permissionIndex - 1];

      // Prepare the revoke transaction
      const { prepareRevokeCallData } = await import("@base-org/account/spend-permission");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const revokeCall = await prepareRevokeCallData(_permission as any);

      // Execute the revoke transaction
      const txHash = await walletProvider.sendTransaction({
        to: revokeCall.to,
        data: revokeCall.data,
        value: BigInt(revokeCall.value || "0x0"),
      });

      return JSON.stringify({
        success: true,
        transactionHash: txHash,
        revokedPermissionIndex: permissionIndex,
        baseAccount: baseAccount,
        spender: spenderAddress,
        message: "Spend permission successfully revoked",
      });
    } catch (error) {
      console.error("Error revoking spend permission:", error);
      return JSON.stringify({
        success: false,
        error: `Error revoking spend permission: ${error instanceof Error ? error.message : "Unknown error"}`,
        baseAccount: args.baseAccount,
        spender: walletProvider.getAddress(),
        permissionIndex: args.permissionIndex,
      });
    }
  }

  /**
   * Checks if the Base Account action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Base Account action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network): boolean => {
    // Base Account spend permissions are only supported on Base mainnet
    return network.networkId === "base-mainnet";
  };
}

export const baseAccountActionProvider = () => new BaseAccountActionProvider();
