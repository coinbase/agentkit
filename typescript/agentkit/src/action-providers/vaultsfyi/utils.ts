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

/**
 * Transform a vault from the API to a format that can be used by the agent
 *
 * @param vault - The vault to transform
 * @param apyRange - The APY range to use
 * @returns The transformed vault
 */
export function transformVault(vault: ApiVault, apyRange: "1day" | "7day" | "30day") {
  return {
    name: vault.name,
    address: vault.address,
    network: vault.network,
    protocol: vault.protocol,
    tvlInUsd: Number(vault.tvlDetails.tvlUsd),
    numberOfHolders: vault.numberOfHolders,
    apy: {
      base: vault.apy.base[apyRange] / 100,
      rewards: vault.apy.rewards?.[apyRange] ? vault.apy.rewards[apyRange] / 100 : undefined,
      total: vault.apy.total[apyRange] / 100,
    },
    token: {
      address: vault.token.assetAddress,
      name: vault.token.name,
      symbol: vault.token.symbol,
    },
    vaultsFyiScore: vault.score.vaultScore,
    link: getVaultsLink(vault),
  };
}

/**
 * Transform a detailed vault from the API to a format that can be used by the agent
 *
 * @param vault - The vault to transform
 * @param apyRange - The APY range to use
 * @returns The transformed vault
 */
export function transformDetailedVault(vault: ApiVault, apyRange: "1day" | "7day" | "30day") {
  return {
    ...transformVault(vault, apyRange),
    rewards: vault.rewards.map(reward => ({
      apy: reward.apy[apyRange] / 100,
      asset: {
        address: reward.asset.assetAddress,
        name: reward.asset.name,
        symbol: reward.asset.symbol,
      },
    })),
    description: vault.description,
    additionalIncentives: vault.additionalIncentives,
  };
}
