import { Address, erc20Abi, Hex, parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { VaultsSdk } from "@vaultsfyi/sdk";

/**
 * Get the link to the vaults.fyi page for a vault
 *
 * @param vault - The vault
 * @returns The link to the vaults.fyi page
 */
export function getVaultsLink(vault: Awaited<ReturnType<VaultsSdk["getVault"]>>): string {
  return `https://app.vaults.fyi/opportunity/${vault.network.name}/${vault.address}`;
}

/**
 * Execute a list of actions
 *
 * @param wallet - The wallet provider
 * @param actions - The list of actions to execute
 * @returns nothing
 */
export async function executeActions(
  wallet: EvmWalletProvider,
  actions: Awaited<ReturnType<VaultsSdk["getActions"]>>,
) {
  for (let i = actions.currentActionIndex; i < actions.actions.length; i++) {
    const action = actions.actions[i];
    const txHash = await wallet.sendTransaction({
      to: action.tx.to as Address,
      data: action.tx.data as Hex,
      value: action.tx.value ? BigInt(action.tx.value) : undefined,
    });
    await wallet.waitForTransactionReceipt(txHash);
  }
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
): Promise<string> {
  const decimals = await wallet.readContract({
    address: assetAddress as Address,
    abi: erc20Abi,
    functionName: "decimals",
  });
  return parseUnits(amount.toString(), decimals).toString();
}

type Apy = {
  base: number;
  reward: number;
  total: number;
};

type ApyObject = {
  "1day": Apy;
  "7day": Apy;
  "30day": Apy;
  "1hour"?: Apy;
};

/**
 * Transform the apy object to a more readable format
 *
 * @param apy - The apy
 * @returns The transformed apy
 */
export function transformApyObject(apy: ApyObject) {
  return (["1day", "7day", "30day", "1hour"] as const).reduce(
    (acc, curr) => {
      if (!(curr in apy)) {
        return acc;
      }
      acc[curr] = transformApy(apy[curr]!);
      return acc;
    },
    {} as Record<
      string,
      {
        base: string;
        reward: string;
        total: string;
      }
    >,
  );
}

/**
 * Transform the apy to a more readable format
 *
 * @param apy - The apy
 * @returns The transformed apy
 */
export function transformApy(apy: Apy) {
  return {
    base: `${(apy.base * 100).toFixed(2)}%`,
    reward: `${(apy.reward * 100).toFixed(2)}%`,
    total: `${(apy.total * 100).toFixed(2)}%`,
  };
}

/**
 * Transform the vault to a more readable format
 *
 * @param vault - The vault
 * @returns The transformed vault
 */
export function transformVault(vault: Awaited<ReturnType<VaultsSdk["getVault"]>>) {
  return {
    ...vault,
    apy: transformApyObject(vault.apy),
    link: getVaultsLink(vault),
    lastUpdateTimestamp: new Date(vault.lastUpdateTimestamp * 1000).toISOString(),
  };
}
