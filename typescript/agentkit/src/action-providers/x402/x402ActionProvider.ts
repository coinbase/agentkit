import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { PaidRequestSchema, FetchPaymentInfoSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import axios, { AxiosError } from "axios";
import { withPaymentInterceptor, decodeXPaymentResponse } from "x402-axios";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * X402ActionProvider is an action provider for making paid requests to x402-protected APIs.
 */
export class X402ActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the X402ActionProvider.
   */
  constructor() {
    super("x402", []);
  }

  /**
   * Makes a paid request to an x402-protected API endpoint.
   *
   * @param walletProvider - The wallet provider to use for payment signing.
   * @param args - The input arguments for the action.
   * @returns A message containing the API response data.
   */
  @CreateAction({
    name: "paid_request",
    description: `
This tool makes HTTP requests to APIs that are protected by x402 paywalls. It automatically handles the payment flow when a 402 Payment Required response is received.

Inputs:
- url: The full URL of the x402-protected API endpoint
- method: The HTTP method (GET, POST, PUT, DELETE, PATCH) - defaults to GET
- headers: Optional additional headers to include in the request
- body: Optional request body for POST/PUT/PATCH requests

The tool will:
1. Make the initial request to the protected endpoint
2. If a 402 Payment Required response is received, automatically handle the payment using the wallet
3. Retry the request with payment proof
4. Return the API response data

Supported on EVM networks where the wallet can sign payment transactions.
`,
    schema: PaidRequestSchema,
  })
  async paidRequest(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PaidRequestSchema>,
  ): Promise<string> {
    try {
      // Get the viem account from the wallet provider for x402-axios
      const account = walletProvider.toSigner();

      // Create an axios instance with the payment interceptor
      const api = withPaymentInterceptor(axios.create({}), account);

      // Make the request
      const response = await api.request({
        url: args.url,
        method: args.method,
        headers: args.headers,
        data: args.body,
      });

      // Extract payment information if available
      const paymentResponseHeader = response.headers["x-payment-response"];
      let paymentResponse: Record<string, unknown> | null = null;

      if (paymentResponseHeader) {
        try {
          paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
        } catch {
          // Fall back to JSON parsing if decodeXPaymentResponse fails
          try {
            paymentResponse = JSON.parse(paymentResponseHeader);
          } catch {
            paymentResponse = {
              error: "Failed to decode payment response",
              rawHeader: paymentResponseHeader,
            };
          }
        }
      }

      // Structure the response to clearly separate API response and payment details
      const result = {
        success: true,
        url: args.url,
        method: args.method,
        status: response.status,
        data: response.data,
        paymentResponse: paymentResponse,
      };

      return JSON.stringify(result, null, 2);
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      if (axiosError.response) {
        return `Error making paid request to ${args.url}: HTTP ${axiosError.response.status} - ${axiosError.response.data?.error || axiosError.response.statusText}`;
      } else if (axiosError.request) {
        return `Error making paid request to ${args.url}: Network error - ${axiosError.message}`;
      } else {
        return `Error making paid request to ${args.url}: ${axiosError.message}`;
      }
    }
  }

  /**
   * Fetches payment information from an x402-protected API endpoint without making the payment.
   *
   * @param walletProvider - The wallet provider (not used for this action but required by interface).
   * @param args - The input arguments for the action.
   * @returns A message containing the payment requirements and endpoint information.
   */
  @CreateAction({
    name: "fetch_payment_info",
    description: `
This tool fetches payment information from x402-protected API endpoints without actually making any payments. It's useful for checking payment requirements before deciding whether to proceed with a paid request.

Inputs:
- url: The full URL of the x402-protected API endpoint
- method: The HTTP method (GET, POST, PUT, DELETE, PATCH) - defaults to GET
- headers: Optional additional headers to include in the request

The tool will:
1. Make a request to the protected endpoint
2. Receive the 402 Payment Required response with payment details
3. Return information about the payment requirements (amount, token, etc.)

Note: Payment amounts are returned in the smallest unit of the token. For example, for USDC (which has 6 decimal places) maxAmountRequired "10000" corresponds to 0.01 USDC.

This is useful for understanding what payment will be required before using the paid_request action.
`,
    schema: FetchPaymentInfoSchema,
  })
  async fetchPaymentInfo(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FetchPaymentInfoSchema>,
  ): Promise<string> {
    try {
      // Make a simple axios request without payment interceptor to get the 402 response
      const response = await axios.request({
        url: args.url,
        method: args.method,
        headers: args.headers,
        validateStatus: status => status === 402 || (status >= 200 && status < 300), // Accept 402 responses
      });

      if (response.status === 402) {
        return JSON.stringify(
          {
            paymentRequired: true,
            url: args.url,
            status: response.status,
            data: response.data,
          },
          null,
          2,
        );
      } else {
        // Endpoint is not payment-protected or request succeeded without payment
        return JSON.stringify(
          {
            paymentRequired: false,
            url: args.url,
            status: response.status,
            data: response.data,
          },
          null,
          2,
        );
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      if (axiosError.response) {
        if (axiosError.response.status === 402) {
          // Handle 402 responses that axios might treat as errors
          const paymentResponseHeader = axiosError.response.headers["x-payment-response"];
          let paymentDetails: Record<string, unknown> | null = null;

          if (paymentResponseHeader) {
            try {
              paymentDetails = decodeXPaymentResponse(paymentResponseHeader);
            } catch {
              // Fall back to JSON parsing if decodeXPaymentResponse fails
              try {
                paymentDetails = JSON.parse(paymentResponseHeader);
              } catch {
                paymentDetails = {
                  error: "Failed to decode payment response",
                  rawHeader: paymentResponseHeader,
                };
              }
            }
          }

          return JSON.stringify(
            {
              paymentRequired: true,
              url: args.url,
              status: 402,
              paymentDetails: paymentDetails,
              data: axiosError.response.data,
            },
            null,
            2,
          );
        } else {
          return `Error fetching payment info from ${args.url}: HTTP ${axiosError.response.status} - ${axiosError.response.data?.error || axiosError.response.statusText}`;
        }
      } else if (axiosError.request) {
        return `Error fetching payment info from ${args.url}: Network error - ${axiosError.message}`;
      } else {
        return `Error fetching payment info from ${args.url}: ${axiosError.message}`;
      }
    }
  }

  /**
   * Checks if the X402 action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the X402 action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const x402ActionProvider = () => new X402ActionProvider();
