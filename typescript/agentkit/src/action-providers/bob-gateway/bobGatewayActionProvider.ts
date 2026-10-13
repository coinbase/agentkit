import { z } from "zod";
import { Hex, parseUnits, erc20Abi, formatUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve, retryWithExponentialBackoff } from "../../utils";
import { Network } from "../../network";
import {
  GatewayClient,
  BOB_GATEWAY_BASE_URL,
  RouteInfo,
  GatewayOrderStatus,
} from "./gatewayClient";
import { SwapToBtcSchema, GetOrdersSchema, GetSupportedRoutesSchema } from "./schemas";

/** Number of decimal places for Bitcoin amounts. */
const BTC_DECIMALS = 8;

/** Number of retry attempts for registering transactions with the Gateway. */
const REGISTER_TX_RETRIES = 3;

/** Initial delay in milliseconds between retry attempts. */
const REGISTER_TX_RETRY_DELAY_MS = 1000;

/**
 * Extracts a safe error message string, stripping stack traces.
 *
 * @param error - The caught error value
 * @returns The error message string only
 */
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Resolves a wallet network ID to a BOB Gateway chain slug by matching
 * against chains available in the routes API.
 *
 * @param networkId - The wallet's network ID (e.g., "base-mainnet")
 * @param routes - Available routes from the Gateway API
 * @returns The matching chain slug (e.g., "base") or undefined
 */
function resolveChainSlug(networkId: string | undefined, routes: RouteInfo[]): string | undefined {
  if (!networkId) return undefined;

  const chainSlugs = [...new Set(routes.flatMap(r => [r.srcChain, r.dstChain]))];

  if (chainSlugs.includes(networkId)) return networkId;

  const stripped = networkId.replace(/-[^-]+$/, "");
  if (stripped !== networkId && chainSlugs.includes(stripped)) return stripped;

  return undefined;
}

export interface BobGatewayActionProviderConfig {
  baseUrl?: string;
  affiliateId?: string;
  client?: GatewayClient;
}

/**
 * BobGatewayActionProvider enables swapping between EVM tokens and BTC via BOB Gateway.
 */
export class BobGatewayActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly #client: GatewayClient;

  /**
   * Creates a new BobGatewayActionProvider instance.
   *
   * @param config - Optional configuration for the Gateway client
   */
  constructor(config: BobGatewayActionProviderConfig = {}) {
    super("bob_gateway", []);
    this.#client =
      config.client ??
      new GatewayClient(config.baseUrl ?? BOB_GATEWAY_BASE_URL, config.affiliateId);
  }

  /**
   * Returns the supported EVM to BTC swap routes from BOB Gateway with resolved token symbols.
   *
   * @param walletProvider - The wallet provider for on-chain symbol lookups
   * @param _args - Unused (no input required)
   * @returns A formatted list of supported routes
   */
  @CreateAction({
    name: "get_supported_routes",
    description: `Get available EVM to BTC swap routes for BOB Gateway, including token symbols and contract addresses.

Use this to discover which tokens and chains can be swapped to BTC before calling swap_to_btc.`,
    schema: GetSupportedRoutesSchema,
  })
  async getSupportedRoutes(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof GetSupportedRoutesSchema>,
  ): Promise<string> {
    try {
      const routes = await this.#client.getRoutes();
      const evmToBtcRoutes = routes.filter(r => r.dstChain === "bitcoin");

      if (evmToBtcRoutes.length === 0) {
        return "No supported routes found.";
      }

      const network = walletProvider.getNetwork();
      const walletChain = resolveChainSlug(network.networkId, routes);

      const labels = await Promise.all(
        evmToBtcRoutes.map(async r => {
          const srcLabel =
            r.srcChain === walletChain
              ? await this.resolveTokenLabel(walletProvider, r.srcToken)
              : r.srcToken;
          return `  ${r.srcChain}: ${srcLabel} → BTC`;
        }),
      );

      return `Supported BOB Gateway routes:\n${labels.join("\n")}`;
    } catch (error) {
      return `Error fetching supported routes: ${safeErrorMessage(error)}`;
    }
  }

  /**
   * Swaps EVM tokens to native BTC on Bitcoin via BOB Gateway.
   *
   * @param walletProvider - The wallet provider to execute the swap from
   * @param args - The input arguments for the swap action
   * @returns A message with order details or an error description
   */
  @CreateAction({
    name: "swap_to_btc",
    description: `Swap EVM tokens to native BTC on Bitcoin via BOB Gateway.

Use get_supported_routes to discover available tokens and chains. Checks token balance, approves spending, executes the swap, and registers with the gateway. Use get_orders to track progress.`,
    schema: SwapToBtcSchema,
  })
  async swapToBtc(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapToBtcSchema>,
  ): Promise<string> {
    if (Number(args.amount) <= 0) {
      return "Error: Amount must be greater than 0";
    }

    try {
      const address = walletProvider.getAddress();
      const network = walletProvider.getNetwork();

      let routes: RouteInfo[] | null = null;
      try {
        routes = await this.#client.getRoutes();
      } catch {
        // If routes fetch fails, fall back to heuristic chain resolution
      }

      const srcChain = routes
        ? resolveChainSlug(network.networkId, routes)
        : network.networkId?.replace(/-[^-]+$/, "");

      if (!srcChain) {
        return `Error: Could not determine source chain from wallet network '${network.networkId}'. Use get_supported_routes to see available chains.`;
      }

      if (routes) {
        const evmToBtcRoutes = routes.filter(r => r.dstChain === "bitcoin");
        const routeError = await this.validateRoute(
          walletProvider,
          evmToBtcRoutes,
          srcChain,
          args.tokenAddress,
          "bitcoin",
          "BTC",
        );
        if (routeError) return routeError;
      }

      const decimals = (await walletProvider.readContract({
        address: args.tokenAddress as Hex,
        abi: erc20Abi,
        functionName: "decimals",
        args: [],
      })) as number;
      const atomicAmount = parseUnits(args.amount, decimals);

      const balance = (await walletProvider.readContract({
        address: args.tokenAddress as Hex,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as Hex],
      })) as bigint;

      if (balance < atomicAmount) {
        return `Error: Insufficient token balance. Have ${formatUnits(balance, decimals)}, need ${args.amount}.`;
      }

      const tokenLabel = await this.resolveTokenLabel(walletProvider, args.tokenAddress);

      const order = await this.#client.createEvmOrder({
        srcChain,
        dstChain: "bitcoin",
        srcToken: args.tokenAddress,
        dstToken: "0x0000000000000000000000000000000000000000",
        amount: atomicAmount.toString(),
        sender: address,
        recipient: args.btcAddress,
        slippage: String(args.maxSlippage),
      });

      const expectedBtc = formatUnits(BigInt(order.expectedBtcOutput), BTC_DECIMALS);

      if (order.type === "offramp") {
        const approvalResult = await approve(
          walletProvider,
          args.tokenAddress,
          order.tx.to,
          atomicAmount,
        );
        if (approvalResult.startsWith("Error")) {
          return `Error approving token for BOB Gateway: ${approvalResult}`;
        }
      }

      const txHash = await walletProvider.sendTransaction({
        to: order.tx.to as Hex,
        data: order.tx.data as Hex,
        value: order.tx.value,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);
      if (receipt.status === "reverted") {
        return `Error: On-chain transaction reverted. Tx: ${txHash}, Order: ${order.orderId}`;
      }

      try {
        await retryWithExponentialBackoff(
          () => this.#client.registerTx(order.orderId, txHash, order.type),
          REGISTER_TX_RETRIES,
          REGISTER_TX_RETRY_DELAY_MS,
        );
      } catch (registerError) {
        return `Warning: Swap transaction succeeded on-chain but failed to register with BOB Gateway.\n  Order ID: ${order.orderId}\n  Tx: ${txHash}\n  Error: ${safeErrorMessage(registerError)}\n  Contact BOB Gateway support with the order ID and tx hash.`;
      }

      return `Successfully initiated BTC swap via BOB Gateway.\n  Sent: ${args.amount} ${tokenLabel}\n  Expected: ${expectedBtc} BTC\n  Order ID: ${order.orderId}\n  Tx: ${txHash}\n  Recipient: ${args.btcAddress}\n  Use get_orders with order ID "${order.orderId}" to track progress.`;
    } catch (error) {
      return `Error executing BOB Gateway swap: ${safeErrorMessage(error)}`;
    }
  }

  /**
   * Checks the status of BOB Gateway swap orders.
   * Fetches a single order by ID or all orders for the connected wallet.
   *
   * @param walletProvider - The wallet provider for address lookup
   * @param args - Optional order ID to fetch a specific order
   * @returns A message with order status details or an error description
   */
  @CreateAction({
    name: "get_orders",
    description:
      "Check BOB Gateway order status. Pass an order ID to check a specific order, or omit to list all orders for the connected wallet.",
    schema: GetOrdersSchema,
  })
  async getOrders(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetOrdersSchema>,
  ): Promise<string> {
    try {
      if (args.orderId) {
        const status = await this.#client.getOrderStatus(args.orderId);
        return this.formatOrderStatus(status);
      }

      const address = walletProvider.getAddress();
      const orders = await this.#client.getOrdersByAddress(address);

      if (orders.length === 0) {
        return "No BOB Gateway orders found for this wallet.";
      }

      return `BOB Gateway orders (${orders.length}):\n${orders.map(o => this.formatOrderStatus(o)).join("\n\n")}`;
    } catch (error) {
      return `Error fetching BOB Gateway order status: ${safeErrorMessage(error)}`;
    }
  }

  /**
   * Formats a single order status into a readable string.
   */
  private formatOrderStatus(status: GatewayOrderStatus): string {
    const date = new Date(status.timestamp * 1000).toISOString();
    let result = `  Created: ${date}\n  Status: ${status.status}\n  Source: ${status.srcInfo.amount} ${status.srcInfo.token} (${status.srcInfo.chain})\n  Destination: ${status.dstInfo.amount} ${status.dstInfo.token} (${status.dstInfo.chain})`;

    if (status.srcInfo.txHash) result += `\n  Source tx: ${status.srcInfo.txHash}`;
    if (status.dstInfo.txHash) result += `\n  Dest tx: ${status.dstInfo.txHash}`;
    if (status.estimatedTimeSecs) {
      result += `\n  Estimated time: ${status.estimatedTimeSecs} seconds`;
    }

    return result;
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "evm";

  /**
   * Resolves an EVM token address to a human-readable label like "USDC (0x8335...2913)".
   * Falls back to the raw address if the on-chain call fails.
   *
   * @param walletProvider - The wallet provider for on-chain lookups
   * @param token - The token address or symbol to resolve
   * @returns A label like "USDC (0x8335...2913)" or the raw token string
   */
  private async resolveTokenLabel(
    walletProvider: EvmWalletProvider,
    token: string,
  ): Promise<string> {
    if (!token.startsWith("0x")) return token;
    try {
      const symbol = (await walletProvider.readContract({
        address: token as Hex,
        abi: erc20Abi,
        functionName: "symbol",
        args: [],
      })) as string;
      return `${symbol} (${token})`;
    } catch {
      return token;
    }
  }

  /**
   * Validates that a route is supported by the Gateway API.
   * Returns null if valid, or an error message listing available options with token symbols.
   *
   * @param walletProvider - The wallet provider for on-chain symbol lookups
   * @param routes - Available routes from the Gateway API
   * @param srcChain - Source chain slug
   * @param srcToken - Source token address
   * @param dstChain - Destination chain slug
   * @param dstToken - Destination token address
   * @returns null if valid, or an error message listing available options
   */
  private async validateRoute(
    walletProvider: EvmWalletProvider,
    routes: RouteInfo[],
    srcChain: string,
    srcToken: string,
    dstChain: string,
    dstToken: string,
  ): Promise<string | null> {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const normalizeToken = (t: string) => {
      const lower = t.toLowerCase();
      // Treat "btc" and the zero address as equivalent for bitcoin destinations
      if (lower === "btc" || lower === ZERO_ADDRESS) return ZERO_ADDRESS;
      return lower;
    };

    const match = routes.find(
      r =>
        r.srcChain === srcChain &&
        normalizeToken(r.srcToken) === normalizeToken(srcToken) &&
        r.dstChain === dstChain &&
        normalizeToken(r.dstToken) === normalizeToken(dstToken),
    );

    if (match) return null;

    const labels = await Promise.all(
      routes.map(async r => {
        const src = await this.resolveTokenLabel(walletProvider, r.srcToken);
        const dst = await this.resolveTokenLabel(walletProvider, r.dstToken);
        return `${r.srcChain}: ${src} → ${r.dstChain}: ${dst}`;
      }),
    );

    const sameChainPair = routes.some(r => r.srcChain === srcChain && r.dstChain === dstChain);

    if (sameChainPair) {
      return `Error: Token pair not supported on route ${srcChain} → ${dstChain}. Available pairs: ${labels.join(", ")}`;
    }

    return `Error: Route ${srcChain} → ${dstChain} is not supported. Available pairs: ${labels.join(", ")}`;
  }
}

export const bobGatewayActionProvider = (config?: BobGatewayActionProviderConfig) =>
  new BobGatewayActionProvider(config);
