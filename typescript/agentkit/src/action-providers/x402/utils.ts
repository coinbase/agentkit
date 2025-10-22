import { Network } from "../../network";
import { AxiosError } from "axios";
import { getTokenDetails } from "../erc20/utils";
import { TOKEN_ADDRESSES_BY_SYMBOLS } from "../erc20/constants";
import { formatUnits, parseUnits } from "viem";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";

/**
 * Supported network types for x402 protocol
 */
export type X402Network = "base" | "base-sepolia" | "solana" | "solana-devnet";

/**
 * USDC token addresses for Solana networks
 */
const SOLANA_USDC_ADDRESSES = {
  "solana-devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "solana-mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

/**
 * Converts the internal network ID to the format expected by the x402 protocol.
 *
 * @param network - The network to convert
 * @returns The network ID in x402 format
 * @throws Error if the network is not supported
 */
export function getX402Network(network: Network): X402Network | string | undefined {
  switch (network.networkId) {
    case "base-mainnet":
      return "base";
    case "base-sepolia":
      return "base-sepolia";
    case "solana-mainnet":
      return "solana";
    case "solana-devnet":
      return "solana-devnet";
    default:
      return network.networkId;
  }
}

/**
 * Helper method to handle HTTP errors consistently.
 *
 * @param error - The axios error to handle
 * @param url - The URL that was being accessed when the error occurred
 * @returns A JSON string containing formatted error details
 */
export function handleHttpError(error: AxiosError, url: string): string {
  if (error.response) {
    return JSON.stringify(
      {
        error: true,
        message: `HTTP ${error.response.status} error when accessing ${url}`,
        details: (error.response.data as { error?: string })?.error || error.response.statusText,
        suggestion: "Check if the URL is correct and the API is available.",
      },
      null,
      2,
    );
  }

  if (error.request) {
    return JSON.stringify(
      {
        error: true,
        message: `Network error when accessing ${url}`,
        details: error.message,
        suggestion: "Check your internet connection and verify the API endpoint is accessible.",
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      error: true,
      message: `Error making request to ${url}`,
      details: error.message,
      suggestion: "Please check the request parameters and try again.",
    },
    null,
    2,
  );
}

/**
 * Formats a payment option into a human-readable string.
 *
 * @param option - The payment option to format
 * @param option.asset - The asset address or identifier
 * @param option.maxAmountRequired - The maximum amount required for the payment
 * @param option.network - The network identifier
 * @param walletProvider - The wallet provider for token details lookup
 * @returns A formatted string like "0.1 USDC on base"
 */
export async function formatPaymentOption(
  option: { asset: string; maxAmountRequired: string; network: string },
  walletProvider: WalletProvider,
): Promise<string> {
  const { asset, maxAmountRequired, network } = option;

  // Check if this is an EVM network and we can use ERC20 helpers
  const walletNetwork = walletProvider.getNetwork();
  const isEvmNetwork = walletNetwork.protocolFamily === "evm";
  const isSvmNetwork = walletNetwork.protocolFamily === "svm";

  if (isEvmNetwork && walletProvider instanceof EvmWalletProvider) {
    const networkId = walletNetwork.networkId as keyof typeof TOKEN_ADDRESSES_BY_SYMBOLS;
    const tokenSymbols = TOKEN_ADDRESSES_BY_SYMBOLS[networkId];

    if (tokenSymbols) {
      for (const [symbol, address] of Object.entries(tokenSymbols)) {
        if (asset.toLowerCase() === address.toLowerCase()) {
          const decimals = symbol === "USDC" || symbol === "EURC" ? 6 : 18;
          const formattedAmount = formatUnits(BigInt(maxAmountRequired), decimals);
          return `${formattedAmount} ${symbol} on ${network} network`;
        }
      }
    }

    // Fall back to getTokenDetails for unknown tokens
    try {
      const tokenDetails = await getTokenDetails(walletProvider, asset);
      if (tokenDetails) {
        const formattedAmount = formatUnits(BigInt(maxAmountRequired), tokenDetails.decimals);
        return `${formattedAmount} ${tokenDetails.name} on ${network} network`;
      }
    } catch {
      // If we can't get token details, fall back to raw format
    }
  }

  if (isSvmNetwork && walletProvider instanceof SvmWalletProvider) {
    // Check if the asset is USDC on Solana networks
    const networkId = walletNetwork.networkId as keyof typeof SOLANA_USDC_ADDRESSES;
    const usdcAddress = SOLANA_USDC_ADDRESSES[networkId];

    if (usdcAddress && asset === usdcAddress) {
      // USDC has 6 decimals on Solana
      const formattedAmount = formatUnits(BigInt(maxAmountRequired), 6);
      return `${formattedAmount} USDC on ${network} network`;
    }
  }

  // Fallback to original format for non-EVM/SVM networks or when token details can't be fetched
  return `${asset} ${maxAmountRequired} on ${network} network`;
}

/**
 * Checks if an asset is USDC on any supported network.
 *
 * @param asset - The asset address or identifier
 * @param walletProvider - The wallet provider for network context
 * @returns True if the asset is USDC, false otherwise
 */
export function isUsdcAsset(asset: string, walletProvider: WalletProvider): boolean {
  const walletNetwork = walletProvider.getNetwork();
  const isEvmNetwork = walletNetwork.protocolFamily === "evm";
  const isSvmNetwork = walletNetwork.protocolFamily === "svm";

  if (isEvmNetwork && walletProvider instanceof EvmWalletProvider) {
    const networkId = walletNetwork.networkId as keyof typeof TOKEN_ADDRESSES_BY_SYMBOLS;
    const tokenSymbols = TOKEN_ADDRESSES_BY_SYMBOLS[networkId];

    if (tokenSymbols && tokenSymbols.USDC) {
      return asset.toLowerCase() === tokenSymbols.USDC.toLowerCase();
    }
  }

  if (isSvmNetwork && walletProvider instanceof SvmWalletProvider) {
    const networkId = walletNetwork.networkId as keyof typeof SOLANA_USDC_ADDRESSES;
    const usdcAddress = SOLANA_USDC_ADDRESSES[networkId];

    if (usdcAddress) {
      return asset === usdcAddress;
    }
  }

  return false;
}

/**
 * Converts whole units to atomic units for a given asset.
 *
 * @param wholeUnits - The amount in whole units (e.g., 0.1 for 0.1 USDC)
 * @param asset - The asset address or identifier
 * @param walletProvider - The wallet provider for token details lookup
 * @returns The amount in atomic units as a string, or null if conversion fails
 */
export async function convertWholeUnitsToAtomic(
  wholeUnits: number,
  asset: string,
  walletProvider: WalletProvider,
): Promise<string | null> {
  // Check if this is an EVM network and we can use ERC20 helpers
  const walletNetwork = walletProvider.getNetwork();
  const isEvmNetwork = walletNetwork.protocolFamily === "evm";
  const isSvmNetwork = walletNetwork.protocolFamily === "svm";

  if (isEvmNetwork && walletProvider instanceof EvmWalletProvider) {
    const networkId = walletNetwork.networkId as keyof typeof TOKEN_ADDRESSES_BY_SYMBOLS;
    const tokenSymbols = TOKEN_ADDRESSES_BY_SYMBOLS[networkId];

    if (tokenSymbols) {
      for (const [symbol, address] of Object.entries(tokenSymbols)) {
        if (asset.toLowerCase() === address.toLowerCase()) {
          const decimals = symbol === "USDC" || symbol === "EURC" ? 6 : 18;
          return parseUnits(wholeUnits.toString(), decimals).toString();
        }
      }
    }

    // Fall back to getTokenDetails for unknown tokens
    try {
      const tokenDetails = await getTokenDetails(walletProvider, asset);
      if (tokenDetails) {
        return parseUnits(wholeUnits.toString(), tokenDetails.decimals).toString();
      }
    } catch {
      // If we can't get token details, fall back to assuming 18 decimals
    }
  }

  if (isSvmNetwork && walletProvider instanceof SvmWalletProvider) {
    // Check if the asset is USDC on Solana networks
    const networkId = walletNetwork.networkId as keyof typeof SOLANA_USDC_ADDRESSES;
    const usdcAddress = SOLANA_USDC_ADDRESSES[networkId];

    if (usdcAddress && asset === usdcAddress) {
      // USDC has 6 decimals on Solana
      return parseUnits(wholeUnits.toString(), 6).toString();
    }
  }

  // Fallback to 18 decimals for unknown tokens or non-EVM/SVM networks
  return parseUnits(wholeUnits.toString(), 18).toString();
}
