import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { HttpRequestSchema, RetryWithX402Schema, DirectX402RequestSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import axios, { AxiosError } from "axios";
import { withPaymentInterceptor, decodeXPaymentResponse } from "x402-axios";
import { PaymentRequirements, PaymentRequirementsSchema } from "x402/types";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * X402ActionProvider provides actions for making HTTP requests, with optional x402 payment handling.
 */
export class X402ActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Creates a new instance of X402ActionProvider.
   * Initializes the provider with x402 capabilities.
   */
  constructor() {
    super("x402", []);
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
- Testing x402: make_http_request("http://localhost:3000/protected")

If you receive a 402 Payment Required response, use retry_http_request_with_x402 to handle the payment.`,
    schema: HttpRequestSchema,
  })
  async makeHttpRequest(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof HttpRequestSchema>,
  ): Promise<string> {
    try {
      const response = await axios.request({
        url: args.url,
        method: args.method ?? "GET",
        headers: args.headers ?? undefined,
        data: args.body,
        validateStatus: status => status === 402 || (status >= 200 && status < 300),
      });

      if (response.status !== 402) {
        return JSON.stringify(
          {
            success: true,
            url: args.url,
            method: args.method,
            status: response.status,
            data: response.data,
          },
          null,
          2,
        );
      }

      const paymentRequirements = (response.data.accepts as PaymentRequirements[]).map(accept =>
        PaymentRequirementsSchema.parse(accept),
      );

      return JSON.stringify({
        status: "error_402_payment_required",
        acceptablePaymentOptions: paymentRequirements,
        nextSteps: [
          "Inform the user that the requested server replied with a 402 Payment Required response.",
          `The payment options are: ${paymentRequirements.map(option => `${option.asset} ${option.maxAmountRequired} ${option.network}`).join(", ")}`,
          "Ask the user if they want to retry the request with payment.",
          `Use retry_http_request_with_x402 to retry the request with payment.`,
        ],
      });
    } catch (error) {
      return this.handleHttpError(error as AxiosError, args.url);
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
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RetryWithX402Schema>,
  ): Promise<string> {
    try {
      // Validate the payment option matches the URL
      if (args.paymentOption.resource !== args.url) {
        return JSON.stringify({
          status: "error_invalid_payment_option",
          message: "The payment option resource does not match the request URL",
          details: {
            expected: args.url,
            received: args.paymentOption.resource,
          },
        });
      }

      // Make the request with payment handling
      const account = walletProvider.toSigner();
      const api = withPaymentInterceptor(axios.create({}), account);

      const response = await api.request({
        url: args.url,
        method: args.method ?? "GET",
        headers: args.headers ?? undefined,
        data: args.body,
      });

      // Check for payment proof
      const paymentProof = response.headers["x-payment-response"]
        ? decodeXPaymentResponse(response.headers["x-payment-response"])
        : null;

      return JSON.stringify({
        status: "success",
        data: response.data,
        message: "Request completed successfully with payment",
        details: {
          url: args.url,
          method: args.method,
          paymentUsed: {
            network: args.paymentOption.network,
            asset: args.paymentOption.asset,
            amount: args.paymentOption.maxAmountRequired,
          },
          paymentProof: paymentProof
            ? {
                transaction: paymentProof.transaction,
                network: paymentProof.network,
                payer: paymentProof.payer,
              }
            : null,
        },
      });
    } catch (error) {
      return this.handleHttpError(error as AxiosError, args.url);
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
⚠️ WARNING: This action automatically handles payments without asking for confirmation!
Only use this when explicitly told to skip the confirmation flow.

For most cases, you should:
1. First try make_http_request
2. Then use retry_http_request_with_x402 if payment is required

This action combines both steps into one, which means:
- No chance to review payment details before paying
- No confirmation step
- Automatic payment processing

EXAMPLES:
- Production: make_http_request_with_x402("https://api.example.com/data")
- Local dev: make_http_request_with_x402("http://localhost:3000/protected")

Unless specifically instructed otherwise, prefer the two-step approach with make_http_request first.`,
    schema: DirectX402RequestSchema,
  })
  async makeHttpRequestWithX402(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DirectX402RequestSchema>,
  ): Promise<string> {
    try {
      const account = walletProvider.toSigner();
      const api = withPaymentInterceptor(axios.create({}), account);

      const response = await api.request({
        url: args.url,
        method: args.method ?? "GET",
        headers: args.headers ?? undefined,
        data: args.body,
      });

      // Check for payment proof
      const paymentProof = response.headers["x-payment-response"]
        ? decodeXPaymentResponse(response.headers["x-payment-response"])
        : null;

      return JSON.stringify(
        {
          success: true,
          message: "Request completed successfully (payment handled automatically if required)",
          url: args.url,
          method: args.method,
          status: response.status,
          data: response.data,
          paymentProof: paymentProof
            ? {
                transaction: paymentProof.transaction,
                network: paymentProof.network,
                payer: paymentProof.payer,
              }
            : null,
        },
        null,
        2,
      );
    } catch (error) {
      return this.handleHttpError(error as AxiosError, args.url);
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported, false otherwise
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);

  /**
   * Helper method to handle HTTP errors consistently.
   *
   * @param error - The axios error to handle
   * @param url - The URL that was being accessed when the error occurred
   * @returns A JSON string containing formatted error details
   */
  private handleHttpError(error: AxiosError, url: string): string {
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
}

export const x402ActionProvider = () => new X402ActionProvider();
