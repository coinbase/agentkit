import { VaultsSdk } from "@vaultsfyi/sdk";

/**
 * Get the vaults.fyi SDK
 *
 * @param apiKey - The API key for the vaults.fyi API
 * @returns The vaults.fyi SDK client
 */
export function getVaultsSdk(apiKey: string) {
  return new VaultsSdk({
    apiKey,
  });
}
