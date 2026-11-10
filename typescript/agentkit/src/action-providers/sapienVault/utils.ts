import { Address, erc20Abi, Hex } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { approve } from "../../utils";
import {
  SAPIEN_TOKEN_ADDRESS,
  SAPIEN_VAULT_ABI,
  SAPIEN_VAULT_ADDRESS,
  SAPIEN_VAULT_APP_URL,
  SAPIEN_VAULT_CHAIN_ID,
  SAPIEN_VAULT_NETWORK_ID,
} from "./constants";

/**
 * Returns true when the wallet is on Base mainnet, the only Sapien Vault deployment.
 *
 * @param network - The wallet network.
 * @returns Whether the network is Base mainnet.
 */
export function isSapienVaultNetwork(network: Network): boolean {
  return (
    network.protocolFamily === "evm" &&
    (network.networkId === SAPIEN_VAULT_NETWORK_ID || network.chainId === SAPIEN_VAULT_CHAIN_ID)
  );
}

/**
 * Builds a clear error when the wallet is not on Base mainnet.
 *
 * @param network - The unsupported network.
 * @returns An error message naming the required and current networks.
 */
export function getUnsupportedNetworkError(network: Network): string {
  const current = network.networkId ?? network.chainId ?? "unknown";
  return (
    `Error: Sapien Vault is only supported on Base mainnet ` +
    `(networkId "${SAPIEN_VAULT_NETWORK_ID}", chainId ${SAPIEN_VAULT_CHAIN_ID}). ` +
    `Current network: ${current}. See ${SAPIEN_VAULT_APP_URL}`
  );
}

/**
 * Returns an error when the wallet is not on Base mainnet.
 *
 * @param wallet - The wallet whose network should be checked.
 * @returns An error message, or undefined when the network is supported.
 */
export function sapienVaultNetworkError(wallet: EvmWalletProvider): string | undefined {
  const network = wallet.getNetwork();
  if (!isSapienVaultNetwork(network)) {
    return getUnsupportedNetworkError(network);
  }
  return undefined;
}

/**
 * Approves the Sapien Vault to spend SAPIEN only when allowance is insufficient.
 *
 * @param wallet - The wallet provider.
 * @param owner - The token owner (the connected wallet).
 * @param amount - The SAPIEN amount to approve, in atomic units.
 * @returns A success message, or an error string starting with "Error".
 */
export async function approveSapienIfNeeded(
  wallet: EvmWalletProvider,
  owner: Address,
  amount: bigint,
): Promise<string> {
  const allowance = (await wallet.readContract({
    address: SAPIEN_TOKEN_ADDRESS as Hex,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, SAPIEN_VAULT_ADDRESS as Address],
  })) as bigint;

  if (allowance >= amount) {
    return `Allowance already sufficient for ${SAPIEN_VAULT_ADDRESS}`;
  }

  return approve(wallet, SAPIEN_TOKEN_ADDRESS, SAPIEN_VAULT_ADDRESS, amount);
}

/**
 * Reads SAPIEN token decimals.
 *
 * @param wallet - The wallet provider.
 * @returns Token decimals.
 */
export async function readSapienTokenDecimals(wallet: EvmWalletProvider): Promise<number> {
  const decimals = await wallet.readContract({
    address: SAPIEN_TOKEN_ADDRESS as Hex,
    abi: erc20Abi,
    functionName: "decimals",
    args: [],
  });
  return Number(decimals);
}

/**
 * Reads vSAPIEN share decimals from the vault.
 *
 * @param wallet - The wallet provider.
 * @returns Share decimals.
 */
export async function readSapienShareDecimals(wallet: EvmWalletProvider): Promise<number> {
  const decimals = await wallet.readContract({
    address: SAPIEN_VAULT_ADDRESS as Hex,
    abi: SAPIEN_VAULT_ABI,
    functionName: "decimals",
    args: [],
  });
  return Number(decimals);
}

/**
 * Normalizes getStakeAccount's return value to a locked-amount bigint.
 *
 * @param stake - Tuple or struct from getStakeAccount.
 * @returns The locked amount in asset terms.
 */
export function parseLockedAmount(stake: unknown): bigint {
  if (stake && typeof stake === "object" && !Array.isArray(stake) && "lockedAmount" in stake) {
    return (stake as { lockedAmount: bigint }).lockedAmount;
  }
  if (Array.isArray(stake) && typeof stake[0] === "bigint") {
    return stake[0];
  }
  throw new Error("Unexpected getStakeAccount return value");
}

/**
 * Normalizes depositAgeStatus's four return values.
 *
 * @param status - Named struct or positional tuple from depositAgeStatus.
 * @returns Matured/pending shares, minAge, and seconds until next maturity.
 */
export function parseDepositAgeStatus(status: unknown): {
  matured: bigint;
  pending: bigint;
  minAge: bigint;
  nextMaturityRemaining: bigint;
} {
  if (status && typeof status === "object" && !Array.isArray(status) && "matured" in status) {
    const named = status as {
      matured: bigint;
      pending: bigint;
      minAge: bigint;
      nextMaturityRemaining: bigint;
    };
    return named;
  }
  if (Array.isArray(status) && status.length >= 4) {
    return {
      matured: status[0] as bigint,
      pending: status[1] as bigint,
      minAge: status[2] as bigint,
      nextMaturityRemaining: status[3] as bigint,
    };
  }
  throw new Error("Unexpected depositAgeStatus return value");
}
