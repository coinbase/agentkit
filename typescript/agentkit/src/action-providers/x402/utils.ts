import { Network } from "../../network";
import { getTokenDetails } from "../erc20/utils";
import { TOKEN_ADDRESSES_BY_SYMBOLS } from "../erc20/constants";
import { formatUnits, parseUnits } from "viem";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  SOLANA_USDC_ADDRESSES,
  NETWORK_MAPPINGS,
  KNOWN_FACILITATORS,
  KnownFacilitatorName,
  type DiscoveryResource,
  type SimplifiedResource,
  type X402Version,
} from "./constants";

/**
 * Returns array of matching network identifiers (both v1 and v2 CAIP-2 formats).
 * Used for filtering discovery results that may contain either format.
 *
 * @param network - The network object
 * @returns Array of network identifiers that match the wallet's network
 */
export function getX402Networks(network: Network): string[] {
  const networkId = network.networkId;
  if (!networkId) {
    return [];
  }
  return NETWORK_MAPPINGS[networkId] ?? [networkId];
}

/**
 * Gets network ID from a CAIP-2 or v1 network identifier.
 *
 * @param network - The x402 network identifier (e.g., "eip155:8453" for v2 or "base" for v1)
 * @returns The network ID (e.g., "base-mainnet") or the original if not found
 */
export function getNetworkId(network: string): string {
  for (const [agentKitId, formats] of Object.entries(NETWORK_MAPPINGS)) {
    if (formats.includes(network)) {
      return agentKitId;
    }
  }
  return network;
}

/**
 * Fetches a URL with retry logic and exponential backoff for errors.
 *
 * @param url - The URL to fetch
 * @param context - Optional context string for error messages (e.g., "page 1")
 * @param maxRetries - Maximum number of retries (default 3)
 * @param initialDelayMs - Initial delay in milliseconds (default 1000)
 * @returns The fetch Response
 */
async function fetchWithRetry(
  url: string,
  context: string = "",
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
): Promise<Response> {
  const contextStr = context ? ` (${context})` : "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    } catch (error) {
      if (attempt >= maxRetries) {
        throw new Error(
          `Failed to fetch${contextStr} after ${maxRetries} retries: ${error instanceof Error ? error.message : error}`,
        );
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Failed to fetch${contextStr} after ${maxRetries} retries`);
}

/**
 * Fetches all resources from the discovery API with pagination.
 *
 * @param discoveryUrl - The base URL for discovery
 * @param pageSize - Number of resources per page (default 100)
 * @returns Array of all discovered resources
 */
export async function fetchAllDiscoveryResources(
  discoveryUrl: string,
  pageSize: number = 1000,
): Promise<DiscoveryResource[]> {
  const allResources: DiscoveryResource[] = [];
  let offset = 0;
  let pageNumber = 1;
  let knownTotal = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = new URL(discoveryUrl);
    url.searchParams.set("limit", pageSize.toString());
    url.searchParams.set("offset", offset.toString());

    const pageContext = `page ${pageNumber}, offset ${offset}`;

    let response: Response;
    try {
      response = await fetchWithRetry(url.toString(), pageContext);
    } catch {
      // If a page fails, skip to the next page
      offset += pageSize;
      pageNumber++;

      // Stop if we've exceeded the known total (from previous successful responses)
      if (knownTotal > 0 && offset >= knownTotal) {
        break;
      }
      // If we've never had a successful response, stop after first failure
      if (knownTotal === 0 && pageNumber > 2) {
        break;
      }
      continue;
    }

    let data;
    try {
      data = (await response.json()) as {
        resources?: DiscoveryResource[];
        total?: number;
      };
    } catch {
      // If JSON parsing fails, skip to the next page
      offset += pageSize;
      pageNumber++;
      continue;
    }

    // Update known total from successful response
    if (data.total !== undefined) {
      knownTotal = data.total;
    }

    // Add resources to the list
    if (data.resources && data.resources.length > 0) {
      allResources.push(...data.resources);
    }

    // Check if we've fetched all resources
    if (!data.resources || data.resources.length < pageSize) {
      break;
    }

    offset += pageSize;
    pageNumber++;
  }

  return allResources;
}

/**
 * Simplifies a discovery resource for display.
 *
 * @param resource - The discovery resource
 * @returns Simplified resource with essential fields
 */
export function simplifyResource(resource: DiscoveryResource): SimplifiedResource {
  return {
    name: resource.name,
    url: resource.url,
    description: resource.description,
    version: resource.x402Version,
  };
}

/**
 * Gets the facilitator URL for a known facilitator name.
 *
 * @param facilitatorName - The facilitator name (e.g., "coinbase")
 * @returns The facilitator URL or undefined if not found
 */
export function getKnownFacilitatorUrl(facilitatorName: KnownFacilitatorName): string | undefined {
  return KNOWN_FACILITATORS[facilitatorName];
}

/**
 * Validates that the wallet provider is an EvmWalletProvider.
 *
 * @param walletProvider - The wallet provider to validate
 * @returns The wallet provider as EvmWalletProvider
 * @throws Error if the wallet provider is not an EvmWalletProvider
 */
export function validateEvmWalletProvider(
  walletProvider: WalletProvider,
): EvmWalletProvider {
  if (!(walletProvider instanceof EvmWalletProvider)) {
    throw new Error("Wallet provider is not an EvmWalletProvider");
  }
  return walletProvider;
}

/**
 * Validates that the wallet provider is an SvmWalletProvider.
 *
 * @param walletProvider - The wallet provider to validate
 * @returns The wallet provider as SvmWalletProvider
 * @throws Error if the wallet provider is not an SvmWalletProvider
 */
export function validateSvmWalletProvider(
  walletProvider: WalletProvider,
): SvmWalletProvider {
  if (!(walletProvider instanceof SvmWalletProvider)) {
    throw new Error("Wallet provider is not an SvmWalletProvider");
  }
  return walletProvider;
}

/**
 * Gets the USDC address for a given network and version.
 *
 * @param network - The network object
 * @param version - The x402 version ("v1" or "v2")
 * @returns The USDC address for the network and version
 * @throws Error if the network is not supported
 */
export function getUsdcAddress(network: Network, version: X402Version): string {
  if (version === "v1") {
    // v1 uses string network IDs like "base", "base-sepolia"
    const networkId = network.networkId;
    if (!networkId) {
      throw new Error("Network ID is required for v1");
    }

    // Map network IDs to v1 identifiers
    const v1NetworkMap: Record<string, string> = {
      "base-mainnet": "base",
      "base-sepolia": "base-sepolia",
      "ethereum-mainnet": "ethereum",
      "ethereum-sepolia": "ethereum-sepolia",
      "optimism-mainnet": "optimism",
      "optimism-sepolia": "optimism-sepolia",
      "arbitrum-mainnet": "arbitrum",
      "arbitrum-sepolia": "arbitrum-sepolia",
    };

    const v1Network = v1NetworkMap[networkId];
    if (!v1Network) {
      throw new Error(`Network ${networkId} is not supported in x402 v1`);
    }

    const address = TOKEN_ADDRESSES_BY_SYMBOLS[v1Network]?.USDC;
    if (!address) {
      throw new Error(`USDC address not found for network ${v1Network}`);
    }
    return address;
  } else {
    // v2 uses CAIP-2 network IDs like "eip155:8453"
    const caip2Id = network.caip2Id;
    if (!caip2Id) {
      throw new Error("CAIP-2 ID is required for v2");
    }

    // Check if it's a Solana network
    if (caip2Id.startsWith("solana:")) {
      const solanaAddress = SOLANA_USDC_ADDRESSES[caip2Id];
      if (!solanaAddress) {
        throw new Error(`USDC address not found for Solana network ${caip2Id}`);
      }
      return solanaAddress;
    }

    // For EVM networks, extract chain ID from CAIP-2
    const chainId = caip2Id.split(":")[1];
    if (!chainId) {
      throw new Error(`Invalid CAIP-2 ID: ${caip2Id}`);
    }

    // Get token details for USDC on this chain
    const tokenDetails = getTokenDetails("USDC", chainId);
    if (!tokenDetails) {
      throw new Error(`USDC address not found for chain ${chainId}`);
    }
    return tokenDetails.address;
  }
}

/**
 * Formats a token amount for display.
 *
 * @param amount - The amount as a string (in base units)
 * @param decimals - The number of decimals for the token
 * @returns The formatted amount as a string
 */
export function formatTokenAmount(amount: string, decimals: number): string {
  return formatUnits(BigInt(amount), decimals);
}

/**
 * Parses a token amount from user input.
 *
 * @param amount - The amount as a string (in human-readable format)
 * @param decimals - The number of decimals for the token
 * @returns The parsed amount as a bigint (in base units)
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}
