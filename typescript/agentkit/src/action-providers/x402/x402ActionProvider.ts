import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  HttpRequestSchema,
  RetryWithX402Schema,
  DirectX402RequestSchema,
  ListX402ServicesSchema,
  resolveFacilitatorUrl,
} from "./schemas";
import { EvmWalletProvider, WalletProvider, SvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import {
  getX402Networks,
  handleHttpError,
  formatPaymentOption,
  fetchAllDiscoveryResources,
  filterByNetwork,
  filterByDescription,
  filterByX402Version,
  filterByKeyword,
  filterByMaxPrice,
  formatSimplifiedResources,
  buildUrlWithParams,
} from "./utils";
import { SUPPORTED_NETWORKS } from "./constants";

/**
 * X402ActionProvider provides actions for making HTTP requests, with optional x402 payment handling.
 */
export class X402ActionProvider extends ActionProvider<WalletProvider> {
  /**
   * Creates a new instance of X402ActionProvider.
   * Initializes the provider with x402 capabilities.
   */
  constructor() {
    super("x402", []);
  }

  /**
   * Discovers available x402 services with optional filtering.
   *
   * @param walletProvider - The wallet provider to use for network filtering
   * @param args - Optional filters: discoveryUrl, maxUsdcPrice
   * @returns JSON string with the list of services (filtered by network and description)
   */
  @CreateAction({
    name: "discover_x402_services",
    description:
      "Discover available x402 services. Only services available on the current network will be returned. Optionally filter by a maximum price in whole units of USDC (only USDC payment options will be considered when filter is applied).",
    schema: ListX402ServicesSchema,
  })
  async discoverX402Services(
    walletProvider: WalletProvider,
    args: z.infer<typeof ListX402ServicesSchema>,
  ): Promise<string> {
    try {
      console.log("args", args);
      const facilitatorUrl = resolveFacilitatorUrl(args.facilitator);
      const discoveryUrl = facilitatorUrl + "/discovery/resources";

      // Fetch all resources with pagination
      const allResources = await fetchAllDiscoveryResources(discoveryUrl);

      if (allResources.length === 0) {
        return JSON.stringify({
          error: true,
          message: "No services found",
        });
      }

      // Get the wallet's network identifiers (both v1 and v2 formats)
      const walletNetworks = getX402Networks(walletProvider.getNetwork());

      // Apply filter pipeline
      let filteredResources = filterByNetwork(allResources, walletNetworks);
      filteredResources = filterByDescription(filteredResources);
      filteredResources = filterByX402Version(filteredResources, args.x402Versions);

      // Apply keyword filter if provided
      if (args.keyword) {
        filteredResources = filterByKeyword(filteredResources, args.keyword);
      }

      // Apply price filter if maxUsdcPrice is provided
      if (args.maxUsdcPrice !== undefined) {
        filteredResources = await filterByMaxPrice(
          filteredResources,
          args.maxUsdcPrice,
          walletProvider,
          walletNetworks,
        );
      }

      // Format simplified output
      const simplifiedResources = await formatSimplifiedResources(
        filteredResources,
        walletNetworks,
        walletProvider,
      );

      return JSON.stringify(
        {
          success: true,
          services: simplifiedResources,
          walletNetworks,
          total: allResources.length,
          returned: simplifiedResources.length,
        },
        null,
        2,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          error: true,
          message: "Failed to list x402 services",
          details: message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Makes a basic HTTP request to an API endpoint.
   *
   * @param walletProvider - The wallet provider to use for potential payments
   * @param args - The request parameters including URL, method, headers, and body
   * @returns A JSON string containing the response or error details
   */
  @CreateAction({
    name: "make_http_request",
    description: `
Makes a basic HTTP request to an API endpoint. If the endpoint requires payment (returns 402),
it will return payment details that can be used with retry_http_request_with_x402.

EXAMPLES:
- Production API: make_http_request("https://api.example.com/weather")
- Local development: make_http_request("http://localhost:3000/api/data")

If you receive a 402 Payment Required response, use retry_http_request_with_x402 to handle the payment.
`,
    schema: HttpRequestSchema,
  })
  async makeHttpRequest(
    walletProvider: WalletProvider,
    args: z.infer<typeof HttpRequestSchema>,
  ): Promise<string> {
    try {
      const finalUrl = buildUrlWithParams(args.url, args.queryParams);
      let method = args.method ?? "GET";
      let canHaveBody = ["POST", "PUT", "PATCH"].includes(method);

      let response = await fetch(finalUrl, {
        method,
        headers: args.headers ?? undefined,
        body: canHaveBody && args.body ? JSON.stringify(args.body) : undefined,
      });

      // Retry with other http method for 404 status code
      if (response.status === 404) {
        method = method === "GET" ? "POST" : "GET";
        canHaveBody = ["POST", "PUT", "PATCH"].includes(method);
        response = await fetch(finalUrl, {
          method,
          headers: args.headers ?? undefined,
          body: canHaveBody && args.body ? JSON.stringify(args.body) : undefined,
        });
      }

      if (response.status !== 402) {
        const data = await this.parseResponseData(response);
        return JSON.stringify(
          {
            success: true,
            url: finalUrl,
            method,
            status: response.status,
            data,
          },
          null,
          2,
        );
      }

      // Handle 402 Payment Required
      // v2 sends requirements in PAYMENT-REQUIRED header; v1 sends in body
      const walletNetworks = getX402Networks(walletProvider.getNetwork());

      let acceptsArray: Array<{
        scheme?: string;
        network: string;
        asset: string;
        maxAmountRequired?: string;
        amount?: string;
        payTo?: string;
      }> = [];
      let paymentData: Record<string, unknown> = {};

      // Check for v2 header-based payment requirements
      const paymentRequiredHeader = response.headers.get("payment-required");
      if (paymentRequiredHeader) {
        try {
          const decoded = JSON.parse(atob(paymentRequiredHeader));
          acceptsArray = decoded.accepts ?? [];
          paymentData = decoded;
        } catch {
          // Header parsing failed, fall back to body
        }
      }

      // Fall back to v1 body-based requirements if header not present or empty
      if (acceptsArray.length === 0) {
        paymentData = await response.json();
        acceptsArray = (paymentData.accepts as typeof acceptsArray) ?? [];
      }

      const availableNetworks = acceptsArray.map(option => option.network);
      const hasMatchingNetwork = availableNetworks.some((net: string) =>
        walletNetworks.includes(net),
      );

      let paymentOptionsText = `The wallet networks ${walletNetworks.join(", ")} do not match any available payment options (${availableNetworks.join(", ")}).`;

      if (hasMatchingNetwork) {
        const matchingOptions = acceptsArray.filter(option =>
          walletNetworks.includes(option.network),
        );
        const formattedOptions = await Promise.all(
          matchingOptions.map(option =>
            formatPaymentOption(
              {
                asset: option.asset,
                maxAmountRequired: option.maxAmountRequired ?? option.amount ?? "0",
                network: option.network,
              },
              walletProvider,
            ),
          ),
        );
        paymentOptionsText = `The payment options are: ${formattedOptions.join(", ")}`;
      }

      // Extract discovery info from v2 response (description, mimeType, extensions)
      const discoveryInfo: Record<string, unknown> = {};
      if (paymentData.description) discoveryInfo.description = paymentData.description;
      if (paymentData.mimeType) discoveryInfo.mimeType = paymentData.mimeType;
      if (paymentData.extensions) discoveryInfo.extensions = paymentData.extensions;

      return JSON.stringify({
        status: "error_402_payment_required",
        acceptablePaymentOptions: acceptsArray,
        ...(Object.keys(discoveryInfo).length > 0 && { discoveryInfo }),
        nextSteps: [
          "Inform the user that the requested server replied with a 402 Payment Required response.",
          paymentOptionsText,
          "Include the description of the service in the response.",
          "IMPORTANT: Identify required or optional query or body parameters based on this response. If there are any, you must inform the user and request them to provide the values. Always suggest example values.",
          "CRITICAL: For POST/PUT/PATCH requests, you MUST use the 'body' parameter (NOT queryParams) to send data.",
          hasMatchingNetwork ? "Ask the user if they want to retry the request with payment." : "",
          hasMatchingNetwork
            ? "Use retry_http_request_with_x402 to retry the request with payment. IMPORTANT: You must retry_http_request_with_x402 with the correct Http method. "
            : "",
        ],
      });
    } catch (error) {
      return handleHttpError(error, args.url);
    }
  }

  /**
   * Retries a request with x402 payment after receiving a 402 response.
   *
   * @param walletProvider - The wallet provider to use for making the payment
   * @param args - The request parameters including URL, method, headers, body, and payment option
   * @returns A JSON string containing the response with payment details or error information
   */
  @CreateAction({
    name: "retry_http_request_with_x402",
    description: `
Retries an HTTP request with x402 payment after receiving a 402 Payment Required response.
This should be used after make_http_request returns a 402 response.

EXAMPLE WORKFLOW:
1. First call make_http_request("http://localhost:3000/protected")
2. If you get a 402 response, use this action to retry with payment
3. Pass the entire original response to this action

DO NOT use this action directly without first trying make_http_request!`,
    schema: RetryWithX402Schema,
  })
  async retryWithX402(
    walletProvider: WalletProvider,
    args: z.infer<typeof RetryWithX402Schema>,
  ): Promise<string> {
    try {
      console.log("args", args);

      // Check network compatibility before attempting payment
      const walletNetworks = getX402Networks(walletProvider.getNetwork());
      const selectedNetwork = args.selectedPaymentOption.network;

      if (!walletNetworks.includes(selectedNetwork)) {
        return JSON.stringify(
          {
            error: true,
            message: "Network mismatch",
            details: `Wallet is on ${walletNetworks.join(", ")} but payment requires ${selectedNetwork}`,
          },
          null,
          2,
        );
      }

      // Check if wallet provider is supported
      if (
        !(
          walletProvider instanceof SvmWalletProvider || walletProvider instanceof EvmWalletProvider
        )
      ) {
        return JSON.stringify(
          {
            error: true,
            message: "Unsupported wallet provider",
            details: "Only SvmWalletProvider and EvmWalletProvider are supported",
          },
          null,
          2,
        );
      }

      // Create x402 client with appropriate signer
      const client = await this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      // Build URL with query params and determine if body is allowed
      const finalUrl = buildUrlWithParams(args.url, args.queryParams);
      const method = args.method ?? "GET";
      const canHaveBody = ["POST", "PUT", "PATCH"].includes(method);

      // Build headers, adding Content-Type for JSON body
      const headers: Record<string, string> = { ...(args.headers ?? {}) };
      if (canHaveBody && args.body) {
        headers["Content-Type"] = "application/json";
      }

      // Make the request with payment handling
      const response = await fetchWithPayment(finalUrl, {
        method,
        headers,
        body: canHaveBody && args.body ? JSON.stringify(args.body) : undefined,
      });

      const data = await this.parseResponseData(response);

      // Check for payment proof in headers (v2: payment-response, v1: x-payment-response)
      const paymentResponseHeader =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");

      let paymentProof: Record<string, unknown> | null = null;
      if (paymentResponseHeader) {
        try {
          paymentProof = JSON.parse(atob(paymentResponseHeader));
        } catch {
          // If parsing fails, include raw header
          paymentProof = { raw: paymentResponseHeader };
        }
      }

      // Get the amount used (supports both v1 and v2 formats)
      const amountUsed =
        args.selectedPaymentOption.maxAmountRequired ??
        args.selectedPaymentOption.amount ??
        args.selectedPaymentOption.price;

      // Check if the response was successful
      // Payment is only settled on 200 status
      if (response.status !== 200) {
        return JSON.stringify({
          status: "error",
          message: `Request failed with status ${response.status}. Payment was not settled.`,
          httpStatus: response.status,
          data,
          details: {
            url: finalUrl,
            method,
          },
        });
      }

      return JSON.stringify({
        status: "success",
        data,
        message: "Request completed successfully with payment",
        details: {
          url: finalUrl,
          method,
          paymentUsed: {
            network: args.selectedPaymentOption.network,
            asset: args.selectedPaymentOption.asset,
            amount: amountUsed,
          },
          paymentProof,
        },
      });
    } catch (error) {
      return handleHttpError(error, args.url);
    }
  }

  /**
   * Makes an HTTP request with automatic x402 payment handling.
   *
   * @param walletProvider - The wallet provider to use for automatic payments
   * @param args - The request parameters including URL, method, headers, and body
   * @returns A JSON string containing the response with optional payment details or error information
   */
  @CreateAction({
    name: "make_http_request_with_x402",
    description: `
WARNING: This action automatically handles payments without asking for confirmation!
Only use this when explicitly told to skip the confirmation flow.

For most cases, you should:
1. First try make_http_request
2. Then use retry_http_request_with_x402 if payment is required

This action combines both steps into one, which means:
- No chance to review payment details before paying
- No confirmation step
- Automatic payment processing
- Assumes payment option is compatible with wallet network

EXAMPLES:
- Production: make_http_request_with_x402("https://api.example.com/data")
- Local dev: make_http_request_with_x402("http://localhost:3000/protected")

Unless specifically instructed otherwise, prefer the two-step approach with make_http_request first.`,
    schema: DirectX402RequestSchema,
  })
  async makeHttpRequestWithX402(
    walletProvider: WalletProvider,
    args: z.infer<typeof DirectX402RequestSchema>,
  ): Promise<string> {
    try {
      if (
        !(
          walletProvider instanceof SvmWalletProvider || walletProvider instanceof EvmWalletProvider
        )
      ) {
        return JSON.stringify(
          {
            error: true,
            message: "Unsupported wallet provider",
            details: "Only SvmWalletProvider and EvmWalletProvider are supported",
          },
          null,
          2,
        );
      }

      // Create x402 client with appropriate signer
      const client = await this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      // Build URL with query params and determine if body is allowed
      const finalUrl = buildUrlWithParams(args.url, args.queryParams);
      const method = args.method ?? "GET";
      const canHaveBody = ["POST", "PUT", "PATCH"].includes(method);

      // Build headers, adding Content-Type for JSON body
      const headers: Record<string, string> = { ...(args.headers ?? {}) };
      if (canHaveBody && args.body) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetchWithPayment(finalUrl, {
        method,
        headers,
        body: canHaveBody && args.body ? JSON.stringify(args.body) : undefined,
      });

      const data = await this.parseResponseData(response);

      // Check for payment proof in headers (v2: payment-response, v1: x-payment-response)
      const paymentResponseHeader =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");

      let paymentProof: Record<string, unknown> | null = null;
      if (paymentResponseHeader) {
        try {
          paymentProof = JSON.parse(atob(paymentResponseHeader));
        } catch {
          // If parsing fails, include raw header
          paymentProof = { raw: paymentResponseHeader };
        }
      }

      // Check if the response was successful
      // Payment is only settled on 200 status
      if (response.status !== 200) {
        return JSON.stringify(
          {
            success: false,
            message: `Request failed with status ${response.status}. Payment was not settled.`,
            url: finalUrl,
            method,
            status: response.status,
            data,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          message: "Request completed successfully (payment handled automatically if required)",
          url: finalUrl,
          method,
          status: response.status,
          data,
          paymentProof,
        },
        null,
        2,
      );
    } catch (error) {
      return handleHttpError(error, args.url);
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported, false otherwise
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
      const signer = walletProvider.toSigner();
      registerExactEvmScheme(client, { signer });
    } else if (walletProvider instanceof SvmWalletProvider) {
      const signer = await walletProvider.toSigner();
      registerExactSvmScheme(client, { signer });
    }

    return client;
  }

  /**
   * Parses response data based on content type.
   *
   * @param response - The fetch Response object
   * @returns Parsed response data
   */
  private async parseResponseData(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }
}

export const x402ActionProvider = () => new X402ActionProvider();
