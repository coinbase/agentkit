import { Hex, erc20Abi, formatUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { sanitizeOnchainMetadata } from "../../utils";

/**
 * Interface for token details
 */
export interface TokenDetails {
  name: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
}

/**
 * Gets the details of an ERC20 token including name, decimals, and balance.
 *
 * @param walletProvider - The wallet provider to use for the multicall.
 * @param contractAddress - The contract address of the ERC20 token.
 * @param address - The address to check the balance for. If not provided, uses the wallet's address.
 * @returns A promise that resolves to TokenDetails or null if there's an error.
 */
export async function getTokenDetails(
  walletProvider: EvmWalletProvider,
  contractAddress: string,
  address?: string,
): Promise<TokenDetails | null> {
  try {
    const publicClient = walletProvider.getPublicClient();
    const contracts = [
      {
        address: contractAddress as Hex,
        abi: erc20Abi,
        functionName: "name",
        args: [],
      },
      {
        address: contractAddress as Hex,
        abi: erc20Abi,
        functionName: "decimals",
        args: [],
      },
      {
        address: contractAddress as Hex,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [(address || walletProvider.getAddress()) as Hex],
      },
    ] as const;

    let rawName: string | undefined;
    let decimals: number | undefined;
    let balance: bigint | undefined;
    try {
      const results = await publicClient.multicall({ contracts });
      rawName = results[0].result;
      decimals = results[1]?.result;
      balance = results[2]?.result;
    } catch (error) {
      // Chains whose definition has no Multicall3 address (e.g. local Anvil or custom chains)
      // cannot use multicall, so read each value with a plain call instead.
      if ((error as Error)?.name !== "ChainDoesNotSupportContract") {
        throw error;
      }
      [rawName, decimals, balance] = await Promise.all([
        publicClient.readContract(contracts[0]),
        publicClient.readContract(contracts[1]),
        publicClient.readContract(contracts[2]),
      ]);
    }

    if (balance === undefined || decimals === undefined || rawName === undefined) {
      return null;
    }

    const name = sanitizeOnchainMetadata(rawName);
    const formattedBalance = formatUnits(BigInt(balance), decimals);

    return {
      name,
      decimals,
      balance: BigInt(balance),
      formattedBalance,
    };
  } catch {
    return null;
  }
}
