import { CdpClient, type SpendPermission } from "@coinbase/cdp-sdk";
import type { Address } from "viem";

/**
 * Shared utility functions for spend permission operations.
 */

/**
 * Lists and formats spend permissions for a given smart account and spender.
 *
 * @param cdpClient - The CDP client to use for API calls
 * @param smartAccountAddress - The smart account address to check permissions for
 * @param spenderAddress - The spender address to filter permissions by
 * @returns A formatted string containing the spend permissions or an error message
 */
export async function listSpendPermissionsForSpender(
  cdpClient: CdpClient,
  smartAccountAddress: Address,
  spenderAddress: Address,
): Promise<string> {
  try {
    // List all spend permissions for the smart account
    const allPermissions = await cdpClient.evm.listSpendPermissions({
      address: smartAccountAddress,
    });

    // Filter permissions where current wallet is the spender
    const relevantPermissions = allPermissions.spendPermissions.filter(
      p => p.permission?.spender.toLowerCase() === spenderAddress.toLowerCase(),
    );

    if (relevantPermissions.length === 0) {
      return `No spend permissions found for spender ${spenderAddress} on smart account ${smartAccountAddress}`;
    }

    // Format the permissions for display
    const formattedPermissions = relevantPermissions
      .map((p, index) => {
        const perm = p.permission;
        if (!perm) return `${index + 1}. Invalid permission`;
        return `${index + 1}. Token: ${perm.token}, Allowance: ${perm.allowance}, Period: ${perm.period} seconds, Start: ${perm.start}, End: ${perm.end}`;
      })
      .join("\n");

    return `Found ${relevantPermissions.length} spend permission(s):\n${formattedPermissions}`;
  } catch (error) {
    return `Failed to list spend permissions: ${error}`;
  }
}

/**
 * Finds and retrieves the latest valid spend permission for a given spender from a smart account.
 *
 * @param cdpClient - The CDP client to use for API calls
 * @param smartAccountAddress - The smart account address to check permissions for
 * @param spenderAddress - The spender address to find permissions for
 * @returns The latest spend permission or throws an error if none found
 * @throws Error if no permissions found or permission is invalid
 */
export async function findLatestSpendPermission(
  cdpClient: CdpClient,
  smartAccountAddress: Address,
  spenderAddress: Address,
): Promise<SpendPermission> {
  const allPermissions = await cdpClient.evm.listSpendPermissions({
    address: smartAccountAddress,
  });

  // Filter permissions where current wallet is the spender
  const relevantPermissions = allPermissions.spendPermissions.filter(
    p => p.permission?.spender.toLowerCase() === spenderAddress.toLowerCase(),
  );

  if (relevantPermissions.length === 0) {
    throw new Error(
      `No spend permissions found for spender ${spenderAddress} on smart account ${smartAccountAddress}`,
    );
  }

  // Use the latest permission (last in the array)
  const latestPermissionWrapper = relevantPermissions.at(-1);
  if (!latestPermissionWrapper?.permission) {
    throw new Error("Invalid spend permission found");
  }

  return latestPermissionWrapper.permission;
}
