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
      console.log(
        `Fetch error${contextStr}: ${error instanceof Error ? error.message : error}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
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
      console.log(`Failed to fetch ${pageContext}, skipping to next page`);
      offset += pageSize;
      pageNumber++;

      // Stop if we've exceeded the known total (from previous successful responses)
      if (knownTotal > 0 && offset >= knownTotal) {
        break;
      }
      // If we've never had a successful response, stop after first failure
      if (knownTotal === 0) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 250));
      continue;
    }

    const data = await response.json();
    const resources = data.resources ?? data.items ?? [];
    const total = data.pagination?.total ?? 0;

    // Update known total from successful response
    if (total > 0) {
      knownTotal = total;
    }

    allResources.push(...resources);

    // Use pagination.total to determine if we're done
    offset += resources.length;
    pageNumber++;

    if (resources.length === 0 || offset >= knownTotal) {
      break;
    }

    // Small delay between pages to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return allResources;
}

/**
 * Filters resources by network compatibility.
 * Matches resources that accept any of the wallet's network identifiers (v1 or v2 format).
 *
 * @param resources - Array of discovery resources
 * @param walletNetworks - Array of network identifiers to match
 * @returns Filtered array of resources
 */
export function filterByNetwork(
  resources: DiscoveryResource[],
  walletNetworks: string[],
): DiscoveryResource[] {
  return resources.filter(resource => {
    const accepts = resource.accepts ?? [];
    return accepts.some(option => walletNetworks.includes(option.network));
  });
}

/**
 * Extracts description from a resource based on its x402 version.
 * - v1: description is in accepts[].description
 * - v2: description is in metadata.description
 *
 * @param resource - The discovery resource
 * @returns The description string or empty string if not found
 */
function getResourceDescription(resource: DiscoveryResource): string {
  if (resource.x402Version === 2) {
    const metadataDesc = resource.metadata?.description;
    return typeof metadataDesc === "string" ? metadataDesc : "";
  }

  // v1: look in accepts[].description
  const accepts = resource.accepts ?? [];
  for (const option of accepts) {
    if (option.description?.trim()) {
      return option.description;
    }
  }
  return "";
}

/**
 * Filters resources by having a valid description.
 * Removes resources with empty or default descriptions.
 * Supports both v1 (accepts[].description) and v2 (metadata.description) formats.
 *
 * @param resources - Array of discovery resources
 * @returns Filtered array of resources with valid descriptions
 */
export function filterByDescription(resources: DiscoveryResource[]): DiscoveryResource[] {
  return resources.filter(resource => {
    const desc = getResourceDescription(resource).trim();
    return desc && desc !== "" && desc !== "Access to protected content";
  });
}

/**
 * Filters resources by x402 protocol version.
 * Uses the x402Version field on the resource.
 *
 * @param resources - Array of discovery resources
 * @param allowedVersions - Array of allowed versions (default: [1, 2])
 * @returns Filtered array of resources matching the allowed versions
 */
export function filterByX402Version(
  resources: DiscoveryResource[],
  allowedVersions: X402Version[] = [1, 2],
): DiscoveryResource[] {
  return resources.filter(resource => {
    const version = resource.x402Version;
    if (version === undefined) {
      return true; // Include resources without version info
    }
    return allowedVersions.includes(version as X402Version);
  });
}

/**
 * Filters resources by keyword appearing in description or URL.
 * Case-insensitive search.
 * Supports both v1 (accepts[].description) and v2 (metadata.description) formats.
 *
 * @param resources - Array of discovery resources
 * @param keyword - The keyword to search for in descriptions and URLs
 * @returns Filtered array of resources with matching descriptions or URLs
 */
export function filterByKeyword(
  resources: DiscoveryResource[],
  keyword: string,
): DiscoveryResource[] {
  const lowerKeyword = keyword.toLowerCase();
  return resources.filter(resource => {
    // Check description (version-aware)
    const desc = getResourceDescription(resource).toLowerCase();
    if (desc.includes(lowerKeyword)) {
      return true;
    }

    // Also check the URL for keyword matches
    const url = (resource.resource ?? resource.url ?? "").toLowerCase();
    if (url.includes(lowerKeyword)) {
      return true;
    }

    return false;
  });
}

/**
 * Filters resources by maximum USDC price.
 *
 * @param resources - Array of discovery resources
 * @param maxUsdcPrice - Maximum price in whole USDC units
 * @param walletProvider - Wallet provider for asset identification
 * @param walletNetworks - Array of network identifiers to match
 * @returns Filtered array of resources within price limit
 */
export async function filterByMaxPrice(
  resources: DiscoveryResource[],
  maxUsdcPrice: number,
  walletProvider: WalletProvider,
  walletNetworks: string[],
): Promise<DiscoveryResource[]> {
  const filtered: DiscoveryResource[] = [];

  for (const resource of resources) {
    const accepts = resource.accepts ?? [];
    let shouldInclude = false;

    for (const option of accepts) {
      if (!walletNetworks.includes(option.network)) {
        continue;
      }

      if (!option.asset) {
        continue;
      }

      // Check if this is a USDC asset
      if (!isUsdcAsset(option.asset, walletProvider)) {
        continue;
      }

      // Get the amount (supports both v1 maxAmountRequired and v2 amount/price)
      const amountStr = option.maxAmountRequired ?? option.amount ?? option.price;
      if (!amountStr) {
        continue;
      }

      try {
        const maxUsdcPriceAtomic = await convertWholeUnitsToAtomic(
          maxUsdcPrice,
          option.asset,
          walletProvider,
        );
        if (maxUsdcPriceAtomic) {
          const resourceAmount = BigInt(amountStr);
          const maxAmount = BigInt(maxUsdcPriceAtomic);
          if (resourceAmount <= maxAmount) {
            shouldInclude = true;
            break;
          }
        }
      } catch {
        // Skip if conversion fails
        continue;
      }
    }

    if (shouldInclude) {
      filtered.push(resource);
    }
  }

  return filtered;
}

/**
 * Formats resources into simplified output for LLM consumption.
 *
 * @param resources - Array of discovery resources
 * @param walletNetworks - Array of network identifiers to match for price extraction
 * @param walletProvider - Wallet provider for formatting
 * @returns Array of simplified resources with url, price, description
 */
export async function formatSimplifiedResources(
  resources: DiscoveryResource[],
  walletNetworks: string[],
  walletProvider: WalletProvider,
): Promise<SimplifiedResource[]> {
  const simplified: SimplifiedResource[] = [];

  for (const resource of resources) {
    const accepts = resource.accepts ?? [];
    const matchingOption = accepts.find(opt => walletNetworks.includes(opt.network));

    if (!matchingOption) {
      continue;
    }

    // Extract URL: v1 and v2 both use resource.resource, but v2 docs show resource.url
    const url = resource.resource ?? resource.url ?? "";

    // Extract description (version-aware via helper)
    const description = getResourceDescription(resource);

    let price = "Unknown";

    // Get the amount (supports both v1 and v2 formats)
    const amountStr =
      matchingOption.maxAmountRequired ?? matchingOption.amount ?? matchingOption.price;
    if (amountStr && matchingOption.asset) {
      price = await formatPaymentOption(
        {
          asset: matchingOption.asset,
          maxAmountRequired: amountStr,
          network: matchingOption.network,
        },
        walletProvider,
      );
    }

    simplified.push({
      url,
      price,
      description,
    });
  }

  return simplified;
}

/**
 * Helper method to handle HTTP errors consistently.
 *
 * @param error - The error to handle
 * @param url - The URL that was being accessed when the error occurred
 * @returns A JSON string containing formatted error details
 */
export function handleHttpError(error: unknown, url: string): string {
  if (error instanceof Response) {
    return JSON.stringify(
      {
        error: true,
        message: `HTTP ${error.status} error when accessing ${url}`,
        details: error.statusText,
        suggestion: "Check if the URL is correct and the API is available.",
      },
      null,
      2,
    );
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
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

  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify(
    {
      error: true,
      message: `Error making request to ${url}`,
      details: message,
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
          return `${formattedAmount} ${symbol} on ${getNetworkId(network)}`;
        }
      }
    }

    // Fall back to getTokenDetails for unknown tokens
    try {
      const tokenDetails = await getTokenDetails(walletProvider, asset);
      if (tokenDetails) {
        const formattedAmount = formatUnits(BigInt(maxAmountRequired), tokenDetails.decimals);
        return `${formattedAmount} ${tokenDetails.name} on ${getNetworkId(network)}`;
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
      return `${formattedAmount} USDC on ${getNetworkId(network)}`;
    }
  }

  // Fallback to original format for non-EVM/SVM networks or when token details can't be fetched
  return `${asset} ${maxAmountRequired} on ${getNetworkId(network)}`;
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

/**
 * Builds a URL with query parameters appended.
 *
 * @param baseUrl - The base URL
 * @param queryParams - Optional query parameters to append
 * @returns URL string with query parameters
 */
export function buildUrlWithParams(
  baseUrl: string,
  queryParams?: Record<string, string> | null,
): string {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return baseUrl;
  }
  const url = new URL(baseUrl);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
}

/**
 * Checks if a URL is registered for x402 requests.
 * Matches by origin (protocol + hostname + port) or by same-origin path prefix.
 *
 * Does **not** use raw `url.startsWith(registered)` — that allows hostname-suffix
 * and other prefix bypasses (e.g. `https://good.com.evil.com` vs `https://good.com`).
 *
 * @param url - The URL to check
 * @param registeredServices - Set of registered service URLs or origins
 * @returns True if the service is registered, false otherwise
 */
export function isServiceRegistered(url: string, registeredServices: Set<string>): boolean {
  if (registeredServices.size === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);

    for (const registered of registeredServices) {
      // Bare origin registration: "https://api.example.com"
      if (parsed.origin === registered) {
        return true;
      }

      let reg: URL;
      try {
        reg = new URL(registered);
      } catch {
        continue;
      }

      if (parsed.origin !== reg.origin) {
        continue;
      }

      // Origin-only URL form ("https://api.example.com/") → any path on that origin
      if (reg.pathname === "/" && reg.search === "" && reg.hash === "") {
        return true;
      }

      // Same-origin path match or segment-boundary prefix
      const regPrefix = reg.pathname.endsWith("/") ? reg.pathname : `${reg.pathname}/`;
      if (parsed.pathname === reg.pathname || parsed.pathname.startsWith(regPrefix)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Filters payment options to only include USDC payments.
 *
 * @param accepts - Array of payment options
 * @param walletProvider - Wallet provider for USDC address lookup
 * @returns Array of USDC-only payment options
 */
export function filterUsdcPaymentOptions(
  accepts: Array<{
    scheme?: string;
    network: string;
    asset: string;
    maxAmountRequired?: string;
    amount?: string;
    payTo?: string;
  }>,
  walletProvider: WalletProvider,
): typeof accepts {
  return accepts.filter(option => isUsdcAsset(option.asset, walletProvider));
}

/**
 * Validates that a payment amount is within the configured limit.
 *
 * @param amountAtomic - The payment amount in atomic units (e.g., 6 decimals for USDC)
 * @param maxPaymentUsdc - Maximum payment in USDC whole units
 * @returns Object with isValid flag and formatted amounts for error messages
 */
export function validatePaymentLimit(
  amountAtomic: string,
  maxPaymentUsdc: number,
): { isValid: boolean; requestedAmount: string; maxAmount: string } {
  const USDC_DECIMALS = 6;
  const maxAmountAtomic = parseUnits(maxPaymentUsdc.toString(), USDC_DECIMALS);
  const requested = BigInt(amountAtomic);

  return {
    isValid: requested <= maxAmountAtomic,
    requestedAmount: formatUnits(requested, USDC_DECIMALS),
    maxAmount: maxPaymentUsdc.toString(),
  };
}

/**
 * Checks if a URL is allowed for x402 requests.
 *
 * @param url - The URL to check
 * @param registeredServices - Set of registered service URLs
 * @returns True if registered, false otherwise
 */
export function isUrlAllowed(url: string, registeredServices: Set<string>): boolean {
  return isServiceRegistered(url, registeredServices);
}

/**
 * Checks if a facilitator is allowed (known name or registered name).
 *
 * @param facilitator - The facilitator name to check
 * @param registeredFacilitators - Map of registered custom facilitator names to URLs
 * @returns Object with isAllowed flag and resolved URL
 */
export function validateFacilitator(
  facilitator: string,
  registeredFacilitators: Record<string, string>,
): { isAllowed: boolean; resolvedUrl: string } {
  // Check if it's a known facilitator name (CDP, PayAI)
  if (facilitator in KNOWN_FACILITATORS) {
    return {
      isAllowed: true,
      resolvedUrl: KNOWN_FACILITATORS[facilitator as KnownFacilitatorName],
    };
  }

  // Check if it's a registered custom facilitator name
  if (facilitator in registeredFacilitators) {
    return { isAllowed: true, resolvedUrl: registeredFacilitators[facilitator] };
  }

  return { isAllowed: false, resolvedUrl: facilitator };
}
