import { Address, erc20Abi } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { ApiVault } from "./api/vaults";
import { Actions } from "./api/actions";

/**
 * Get the link to the vaults.fyi page for a vault
 *
 * @param vault - The vault
 * @returns The link to the vaults.fyi page
 */
export function getVaultsLink(vault: ApiVault): string {
  if (vault.isTransactional) {
    return `https://app.vaults.fyi/opportunity/${vault.network}/${vault.address}`;
  } else {
    return `https://analytics.vaults.fyi/vaults/${vault.network}/${vault.address}`;
  }
}

/**
 * Execute a list of actions
 *
 * @param wallet - The wallet provider
 * @param actions - The list of actions to execute
 * @returns nothing
 */
export async function executeActions(wallet: EvmWalletProvider, actions: Actions) {
  for (let i = actions.currentActionIndex; i < actions.actions.length; i++) {
    const action = actions.actions[i];
    const txHash = await wallet.sendTransaction({
      ...action.tx,
      value: action.tx.value ? BigInt(action.tx.value) : undefined,
    });
    await wallet.waitForTransactionReceipt(txHash);
  }
}

/**
 * Create a URLSearchParams object from an object
 *
 * @param obj - The object to convert
 * @returns The URLSearchParams object
 */
export function createSearchParams(
  obj: Record<string, string | number | boolean | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key in obj) {
    if (obj[key] !== undefined) {
      params.append(key, obj[key].toString());
    }
  }
  return params;
}

/**
 * Parse an asset amount with decimals
 *
 * @param wallet - The wallet provider
 * @param assetAddress - The address of the asset
 * @param amount - The amount to parse
 * @returns The parsed amount
 */
export async function parseAssetAmount(
  wallet: EvmWalletProvider,
  assetAddress: string,
  amount: number,
): Promise<number> {
  const decimals = await wallet.readContract({
    address: assetAddress as Address,
    abi: erc20Abi,
    functionName: "decimals",
  });
  return Math.floor(amount * 10 ** decimals);
}
