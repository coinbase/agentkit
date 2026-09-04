import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  OneLySearchSchema,
  OneLyGetDetailsSchema,
  OneLyCallSchema,
  OneLyReviewSchema,
  OneLyCreateStoreSchema,
  OneLyCreateLinkSchema,
  OneLyListLinksSchema,
  OneLyGetStatsSchema,
  OneLyWithdrawSchema,
  OneLyConfig,
} from "./schemas";
import { ONELY_API_BASE, SUPPORTED_NETWORKS } from "./constants";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";

/**
 * OneLyActionProvider enables agents to buy AND sell services on the 1ly x402 marketplace.
 *
 * @description
 * First action provider where AI agents can be both buyers AND sellers:
 * - BUYER ACTIONS: Search APIs, get details, pay with x402, leave reviews
 * - SELLER ACTIONS: Create store, list APIs, view earnings, withdraw funds
 *
 * Production stats (Feb 2026): 5,297 stores, 53 APIs, 143 purchases, 5.3K users
 * Networks: Base mainnet and Solana mainnet only (no testnets)
 * Payment: USDC via x402 protocol
 *
 * @example
 * ```typescript
 * // As buyer (no config needed)
 * const provider = oneLyActionProvider();
 *
 * // As seller (after creating store)
 * const provider = oneLyActionProvider({ apiKey: "..." });
 * ```
 */
export class OneLyActionProvider extends ActionProvider<WalletProvider> {
  private readonly apiKey: string;

  /**
   * Creates a new instance of OneLyActionProvider.
   *
   * @param config - Optional configuration for API key
   */
  constructor(config: OneLyConfig = {}) {
    super("onely", []);
    this.apiKey = config.apiKey ?? process.env.ONELY_API_KEY ?? "";
  }

  // ==========================================
  // BUYER ACTIONS (No Auth Required)
  // ==========================================

  /**
   * Search for APIs and services on the 1ly marketplace.
   *
   * @param walletProvider - Wallet provider (not used for search)
   * @param args - Search parameters including query, type, price filters, and limit
   * @returns JSON string with search results including title, price, seller, and stats
   *
   * @example
   * ```typescript
   * await provider.search({ query: "weather api", maxPrice: 1.0, limit: 10 });
   * ```
   */
  @CreateAction({
    name: "onely_search",
    description: `Search for APIs and services on the 1ly.store marketplace.
Find APIs by keyword, filter by type (api/standard) and price range.
Returns listings with title, description, price, seller info, and buyer stats.`,
    schema: OneLySearchSchema,
  })
  async search(
    _walletProvider: WalletProvider,
    args: z.infer<typeof OneLySearchSchema>,
  ): Promise<string> {
    try {
      const params = new URLSearchParams();
      params.set("q", args.query);
      params.set("limit", args.limit.toString());

      if (args.type) params.set("type", args.type);
      if (args.maxPrice !== undefined) params.set("maxPrice", args.maxPrice.toString());
      if (args.minPrice !== undefined) params.set("minPrice", args.minPrice.toString());

      const url = `${ONELY_API_BASE}/api/discover?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        return JSON.stringify(
          {
            error: true,
            message: "Search failed",
            status: response.status,
          },
          null,
          2,
        );
      }

      const data = await response.json();

      const simplified = {
        results: data.results.map((r: any) => ({
          title: r.title,
          description: r.description,
          endpoint: r.endpoint,
          price: `$${r.price} ${r.currency}`,
          type: r.type,
          seller: r.seller?.displayName || r.seller?.username,
          stats: {
            buyers: r.stats?.buyers || 0,
            rating: r.stats?.rating ? `${r.stats.rating}%` : "No reviews",
          },
        })),
        total: data.pagination?.total || 0,
        showing: data.results.length,
      };

      return JSON.stringify(simplified, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Search request failed",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Get detailed information about a specific API listing.
   *
   * @param walletProvider - Wallet provider (not used for details)
   * @param args - Endpoint path (e.g., 'joe/weather' or '/api/link/joe/weather')
   * @returns JSON string with full API details, pricing, payment info, and reviews
   *
   * @example
   * ```typescript
   * await provider.getDetails({ endpoint: "joe/weather" });
   * ```
   */
  @CreateAction({
    name: "onely_get_details",
    description: `Get detailed information about a specific API listing on 1ly.store.
Returns full details including pricing, payment requirements, recent reviews, and API documentation.
Use this before calling an API to understand requirements and cost.`,
    schema: OneLyGetDetailsSchema,
  })
  async getDetails(
    _walletProvider: WalletProvider,
    args: z.infer<typeof OneLyGetDetailsSchema>,
  ): Promise<string> {
    try {
      const { username, slug } = this.parseEndpoint(args.endpoint);
      const linkUrl = `${ONELY_API_BASE}/api/link/${username}/${slug}`;

      const linkResponse = await fetch(linkUrl, {
        headers: { Accept: "application/json" },
      });

      let linkData: Record<string, unknown> = {};
      let paymentInfo: Record<string, unknown> = {};

      if (linkResponse.status === 402) {
        const x402Header = linkResponse.headers.get("X-Payment-Requirements");
        if (x402Header) {
          try {
            paymentInfo = JSON.parse(x402Header);
          } catch {
            // Ignore parse errors
          }
        }
        try {
          linkData = await linkResponse.json();
        } catch {
          // Response might not be JSON for 402
        }
      } else if (linkResponse.ok) {
        linkData = await linkResponse.json();
      } else {
        return JSON.stringify(
          {
            error: true,
            message: "Failed to get details",
            status: linkResponse.status,
          },
          null,
          2,
        );
      }

      // Fetch reviews (optional)
      const reviewsUrl = `${ONELY_API_BASE}/api/reviews?username=${username}&slug=${slug}&limit=5`;
      let reviewsData: any = null;

      try {
        const reviewsResponse = await fetch(reviewsUrl);
        if (reviewsResponse.ok) {
          reviewsData = await reviewsResponse.json();
        }
      } catch {
        // Reviews fetch is optional
      }

      const result = {
        endpoint: `/api/link/${username}/${slug}`,
        fullUrl: `${ONELY_API_BASE}/api/link/${username}/${slug}`,
        ...linkData,
        paymentInfo: {
          networks: ["solana", "base"],
          ...paymentInfo,
        },
        reviews: reviewsData
          ? {
              stats: reviewsData.stats,
              recent: reviewsData.reviews?.slice(0, 5).map((r: any) => ({
                positive: r.positive,
                comment: r.comment,
              })),
            }
          : null,
      };

      return JSON.stringify(result, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to get API details",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Call a paid API on 1ly with automatic x402 payment handling.
   *
   * @param walletProvider - Wallet provider for signing x402 payments
   * @param args - API endpoint, HTTP method, body, and headers
   * @returns JSON string with API response data and purchase metadata
   *
   * @example
   * ```typescript
   * // GET request
   * await provider.call(walletProvider, { endpoint: "joe/weather" });
   *
   * // POST request with body
   * await provider.call(walletProvider, {
   *   endpoint: "joe/todo-api",
   *   method: "POST",
   *   body: { task: "Buy milk" }
   * });
   * ```
   */
  @CreateAction({
    name: "onely_call",
    description: `Call a paid API on 1ly.store with automatic x402 payment.
Supports all HTTP methods (GET, POST, PUT, DELETE, PATCH).
Payment is handled automatically using the wallet's USDC balance.
Returns API response data plus purchase metadata (purchaseId, reviewToken) for leaving reviews.`,
    schema: OneLyCallSchema,
  })
  async call(
    walletProvider: WalletProvider,
    args: z.infer<typeof OneLyCallSchema>,
  ): Promise<string> {
    try {
      const endpointPath = this.parseEndpointToPath(args.endpoint);
      const fullUrl = `${ONELY_API_BASE}${endpointPath}`;
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(args.headers || {}),
      };

      // Initial request to get payment requirements
      const initialResponse = await fetch(fullUrl, {
        method: args.method,
        headers: requestHeaders,
        body: args.body ? JSON.stringify(args.body) : undefined,
      });

      // If not 402, return response directly
      if (initialResponse.status !== 402) {
        if (initialResponse.ok) {
          const data = await initialResponse.json();
          return JSON.stringify(
            {
              success: true,
              data,
              note: "No payment required (free API)",
            },
            null,
            2,
          );
        }

        return JSON.stringify(
          {
            error: true,
            message: "API call failed",
            status: initialResponse.status,
            statusText: initialResponse.statusText,
          },
          null,
          2,
        );
      }

      // Handle 402 Payment Required
      if (
        !(
          walletProvider instanceof EvmWalletProvider || walletProvider instanceof SvmWalletProvider
        )
      ) {
        return JSON.stringify(
          {
            error: true,
            message: "Unsupported wallet provider",
            details: "Only EvmWalletProvider and SvmWalletProvider are supported for x402 payments",
          },
          null,
          2,
        );
      }

      // Create x402 client with appropriate signer and use wrapFetchWithPayment
      const client = await this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      // Make the request with automatic payment handling
      const paidResponse = await fetchWithPayment(fullUrl, {
        method: args.method,
        headers: requestHeaders,
        body: args.body ? JSON.stringify(args.body) : undefined,
      });

      if (!paidResponse.ok) {
        const errorText = await paidResponse.text();
        return JSON.stringify(
          {
            error: true,
            message: "Payment failed",
            status: paidResponse.status,
            details: errorText,
          },
          null,
          2,
        );
      }

      const responseData = await paidResponse.json();

      // Extract purchase metadata from response
      const purchaseId = responseData._1ly?.purchaseId || responseData.purchaseId;
      const reviewToken = responseData._1ly?.reviewToken || responseData.reviewToken;
      const priceUsd = responseData._1ly?.priceUsd || responseData.priceUsd;

      return JSON.stringify(
        {
          success: true,
          data: responseData,
          purchase: {
            purchaseId,
            reviewToken,
            priceUsd,
            note: "Save purchaseId and reviewToken to leave a review with onely_review",
          },
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to call API",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Leave a review after purchasing an API.
   *
   * @param walletProvider - Wallet provider to get address from
   * @param args - Purchase ID, review token, rating (positive/negative), and optional comment
   * @returns JSON string confirming review submission
   *
   * @example
   * ```typescript
   * await provider.review(walletProvider, {
   *   purchaseId: "...",
   *   reviewToken: "...",
   *   positive: true,
   *   comment: "Great API!"
   * });
   * ```
   */
  @CreateAction({
    name: "onely_review",
    description: `Leave a review after purchasing an API on 1ly.store.
Requires purchaseId and reviewToken from the API call response.
Wallet address is automatically obtained from your wallet.
Reviews can be positive (true) or negative (false) with optional comment (max 500 chars).`,
    schema: OneLyReviewSchema,
  })
  async review(
    walletProvider: WalletProvider,
    args: z.infer<typeof OneLyReviewSchema>,
  ): Promise<string> {
    try {
      // Get wallet address from provider
      const walletAddress = walletProvider.getAddress();

      const response = await fetch(`${ONELY_API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: args.purchaseId,
          wallet: walletAddress,
          token: args.reviewToken,
          positive: args.positive,
          comment: args.comment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return JSON.stringify(
          {
            error: true,
            message: "Failed to submit review",
            status: response.status,
            details: errorData,
          },
          null,
          2,
        );
      }

      const data = await response.json();
      return JSON.stringify(
        {
          success: true,
          message: "Review submitted successfully",
          data,
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to submit review",
          details: message,
        },
        null,
        2,
      );
    }
  }

  // ==========================================
  // SELLER ACTIONS (Require Wallet Signature + API Key)
  // ==========================================

  /**
   * Create a new store on the 1ly marketplace using wallet signature.
   *
   * @param walletProvider - Wallet provider for signing authentication message
   * @param args - Optional username, display name, and avatar URL
   * @returns JSON string with API key and store details
   *
   * @example
   * ```typescript
   * const result = await provider.createStore(walletProvider, {
   *   username: "mystore",
   *   displayName: "My AI Store"
   * });
   * // Save the apiKey from result for future seller actions
   * ```
   */
  @CreateAction({
    name: "onely_create_store",
    description: `Create a new store for your agent on 1ly.store using wallet signature.
Returns an API key that must be saved for subsequent seller actions (create_link, list_links, get_stats, withdraw).
Requires a wallet with USDC balance for future transactions.
This is the first step to become a seller on the marketplace.`,
    schema: OneLyCreateStoreSchema,
  })
  async createStore(
    walletProvider: WalletProvider,
    args: z.infer<typeof OneLyCreateStoreSchema>,
  ): Promise<string> {
    try {
      // Get wallet address and chain
      const address = walletProvider.getAddress();
      const network = walletProvider.getNetwork();

      // Determine chain (base or solana mainnet only)
      const chain = network.networkId === "solana-mainnet" ? "solana" : "base";

      // Get nonce from 1ly
      const nonceRes = await fetch(`${ONELY_API_BASE}/api/agent/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain }),
      });

      if (!nonceRes.ok) {
        return JSON.stringify(
          {
            error: true,
            message: "Failed to get nonce",
            status: nonceRes.status,
          },
          null,
          2,
        );
      }

      const nonceJson = await nonceRes.json();
      const message = nonceJson.data?.message;
      if (!message) {
        return JSON.stringify(
          {
            error: true,
            message: "Missing message from nonce response",
          },
          null,
          2,
        );
      }

      // Sign message using walletProvider
      let signature: string;
      if (walletProvider instanceof EvmWalletProvider) {
        signature = await walletProvider.signMessage(message);
      } else if (walletProvider instanceof SvmWalletProvider) {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = await walletProvider.signMessage(messageBytes);
        signature = Buffer.from(signatureBytes).toString("base64");
      } else {
        return JSON.stringify(
          {
            error: true,
            message: "Unsupported wallet provider",
            details: "Only EvmWalletProvider and SvmWalletProvider are supported",
          },
          null,
          2,
        );
      }

      // Create store with signature
      const signupRes = await fetch(`${ONELY_API_BASE}/api/agent/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          chain,
          signature,
          message,
          username: args.username,
          displayName: args.displayName,
          avatarUrl: args.avatarUrl,
        }),
      });

      if (!signupRes.ok) {
        const errorData = await signupRes.json();
        return JSON.stringify(
          {
            error: true,
            message: "Failed to create store",
            status: signupRes.status,
            details: errorData,
          },
          null,
          2,
        );
      }

      const data = await signupRes.json();
      const apiKey = data.data?.apiKey;
      const store = data.data?.store;

      return JSON.stringify(
        {
          success: true,
          apiKey,
          store,
          instructions:
            "IMPORTANT: Save this API key! Use it to initialize oneLyActionProvider({ apiKey: '...' }) for seller actions.",
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to create store",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Create a new API listing on your store.
   *
   * @param walletProvider - Wallet provider (not used but required by interface)
   * @param args - API title, URL, description, price, and other listing details
   * @returns JSON string with created link details
   *
   * @example
   * ```typescript
   * await provider.createLink(walletProvider, {
   *   title: "Weather API",
   *   url: "https://myapi.com/weather",
   *   description: "Get real-time weather data",
   *   price: "0.01",
   *   currency: "USDC"
   * });
   * ```
   */
  @CreateAction({
    name: "onely_create_link",
    description: `Create a new API listing on your 1ly.store store.
Requires API key from onely_create_store.
Set a price in USDC (e.g., "0.01" for 1 cent) or leave empty for free APIs.
Returns the created listing with its endpoint URL for buyers to discover.`,
    schema: OneLyCreateLinkSchema,
  })
  async createLink(
    _walletProvider: WalletProvider,
    args: z.infer<typeof OneLyCreateLinkSchema>,
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        return JSON.stringify(
          {
            error: true,
            message: "Missing API key",
            details: "Set apiKey in provider config or ONELY_API_KEY environment variable",
          },
          null,
          2,
        );
      }

      const response = await fetch(`${ONELY_API_BASE}/api/v1/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          title: args.title,
          url: args.url,
          description: args.description,
          slug: args.slug,
          price: args.price,
          currency: args.currency || "USDC",
          isPublic: args.isPublic ?? true,
          isStealth: args.isStealth ?? false,
          webhookUrl: args.webhookUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return JSON.stringify(
          {
            error: true,
            message: "Failed to create link",
            status: response.status,
            details: errorData,
          },
          null,
          2,
        );
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to create link",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * List all API listings on your store.
   *
   * @param walletProvider - Wallet provider (not used but required by interface)
   * @param args - Empty object (no parameters required)
   * @returns JSON string with array of all your API listings
   *
   * @example
   * ```typescript
   * const listings = await provider.listLinks(walletProvider, {});
   * ```
   */
  @CreateAction({
    name: "onely_list_links",
    description: `List all API listings on your 1ly.store store.
Requires API key from onely_create_store.
Returns array of all your listings with details, stats, and earnings.`,
    schema: OneLyListLinksSchema,
  })
  async listLinks(
    _walletProvider: WalletProvider,
    _args: z.infer<typeof OneLyListLinksSchema>,
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        return JSON.stringify(
          {
            error: true,
            message: "Missing API key",
            details: "Set apiKey in provider config or ONELY_API_KEY environment variable",
          },
          null,
          2,
        );
      }

      const response = await fetch(`${ONELY_API_BASE}/api/v1/links`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return JSON.stringify(
          {
            error: true,
            message: "Failed to list links",
            status: response.status,
            details: errorData,
          },
          null,
          2,
        );
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to list links",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Get store statistics and earnings.
   *
   * @param walletProvider - Wallet provider (not used but required by interface)
   * @param args - Optional period filter (7d, 30d, 90d, all) and linkId filter
   * @returns JSON string with earnings, sales count, and revenue breakdown
   *
   * @example
   * ```typescript
   * // Get all-time stats
   * await provider.getStats(walletProvider, {});
   *
   * // Get last 30 days stats
   * await provider.getStats(walletProvider, { period: "30d" });
   *
   * // Get stats for specific link
   * await provider.getStats(walletProvider, { linkId: "..." });
   * ```
   */
  @CreateAction({
    name: "onely_get_stats",
    description: `Get store statistics and earnings on 1ly.store.
Requires API key from onely_create_store.
Filter by time period (7d, 30d, 90d, all) or specific link.
Returns total earnings, sales count, and detailed revenue breakdown.`,
    schema: OneLyGetStatsSchema,
  })
  async getStats(
    _walletProvider: WalletProvider,
    args: z.infer<typeof OneLyGetStatsSchema>,
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        return JSON.stringify(
          {
            error: true,
            message: "Missing API key",
            details: "Set apiKey in provider config or ONELY_API_KEY environment variable",
          },
          null,
          2,
        );
      }

      const params = new URLSearchParams();
      if (args.period) params.set("period", args.period);
      if (args.linkId) params.set("linkId", args.linkId);

      const url = `${ONELY_API_BASE}/api/v1/stats?${params}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return JSON.stringify(
          {
            error: true,
            message: "Failed to get stats",
            status: response.status,
            details: errorData,
          },
          null,
          2,
        );
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to get stats",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Withdraw earnings from your store to a Solana wallet.
   *
   * @param walletProvider - Wallet provider (not used but required by interface)
   * @param args - Amount to withdraw in USDC and destination Solana wallet address
   * @returns JSON string confirming withdrawal transaction
   *
   * @example
   * ```typescript
   * await provider.withdraw(walletProvider, {
   *   amount: "10.50",
   *   walletAddress: "YourSolanaAddress..."  // Solana only
   * });
   * ```
   */
  @CreateAction({
    name: "onely_withdraw",
    description: `Withdraw earnings from your 1ly.store store to a Solana wallet.
Requires API key from onely_create_store.
Specify amount in USDC (e.g., "10.50") and destination Solana wallet address.
Note: Withdrawals are Solana-only at this time.
Returns transaction details once withdrawal is processed.`,
    schema: OneLyWithdrawSchema,
  })
  async withdraw(
    _walletProvider: WalletProvider,
    args: z.infer<typeof OneLyWithdrawSchema>,
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        return JSON.stringify(
          {
            error: true,
            message: "Missing API key",
            details: "Set apiKey in provider config or ONELY_API_KEY environment variable",
          },
          null,
          2,
        );
      }

      const response = await fetch(`${ONELY_API_BASE}/api/v1/withdrawals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          amount: args.amount,
          walletAddress: args.walletAddress,
          chain: "solana",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return JSON.stringify(
          {
            error: true,
            message: "Failed to withdraw",
            status: response.status,
            details: errorData,
          },
          null,
          2,
        );
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to withdraw",
          details: message,
        },
        null,
        2,
      );
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported (Base or Solana)
   */
  supportsNetwork = (network: Network) =>
    (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId!);

  /**
   * Creates an x402 client configured for the given wallet provider.
   *
   * @param walletProvider - The wallet provider to configure the client for
   * @returns Configured x402Client
   */
  private async createX402Client(walletProvider: WalletProvider): Promise<x402Client> {
    const client = new x402Client();

    if (walletProvider instanceof EvmWalletProvider) {
      const signer = toClientEvmSigner(walletProvider.toSigner(), walletProvider.getPublicClient());
      registerExactEvmScheme(client, { signer });
    } else if (walletProvider instanceof SvmWalletProvider) {
      const signer = await walletProvider.toSigner();
      registerExactSvmScheme(client, { signer });
    }

    return client;
  }

  /**
   * Parses endpoint string to extract username and slug.
   *
   * @param endpoint - Endpoint string (e.g., 'joe/weather' or '/api/link/joe/weather')
   * @returns Object with username and slug
   */
  private parseEndpoint(endpoint: string): { username: string; slug: string } {
    const cleaned = endpoint.replace(/^\/api\/link\//, "").replace(/^\//, "");
    const [username, slug] = cleaned.split("/");

    if (!username || !slug) {
      throw new Error(
        "Invalid endpoint format. Expected 'username/slug' or '/api/link/username/slug'",
      );
    }

    return { username, slug };
  }

  /**
   * Parses endpoint string to API path.
   *
   * @param endpoint - Endpoint string (e.g., 'joe/weather' or '/api/link/joe/weather')
   * @returns API path starting with /api/link/
   */
  private parseEndpointToPath(endpoint: string): string {
    if (endpoint.startsWith("/api/link/")) {
      return endpoint;
    }
    const cleaned = endpoint.replace(/^\//, "");
    return `/api/link/${cleaned}`;
  }
}

/**
 * Factory function to create a new OneLyActionProvider instance.
 *
 * @param config - Optional configuration for API key and custom API base
 * @returns A new OneLyActionProvider instance
 *
 * @example
 * ```typescript
 * // As buyer
 * const provider = oneLyActionProvider();
 *
 * // As seller (after creating store)
 * const provider = oneLyActionProvider({ apiKey: "your-api-key-here" });
 * ```
 */
export const oneLyActionProvider = (config?: OneLyConfig) => new OneLyActionProvider(config);
