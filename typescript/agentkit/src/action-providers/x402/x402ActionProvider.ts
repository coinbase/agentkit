import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  HttpRequestSchema,
  RetryWithX402Schema,
  DirectX402RequestSchema,
  ListX402ServicesSchema,
  RegisterServiceSchema,
  EmptySchema,
  X402Config,
} from "./schemas";
import { EvmWalletProvider, WalletProvider, SvmWalletProvider } from "../../wallet-providers";
import { x402Client, x402HTTPClient, type SelectPaymentRequirements } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import {
  QuoteBindingStore,
  QUOTE_BINDING_MAX_PENDING,
  QUOTE_BINDING_TTL_MS,
  canonicalizeRequest,
  createFrozenBeforePaymentHook,
  createFrozenSelector,
  frozenPaymentUsed,
  isWellFormedSettlementTransaction,
  settlementPayersEqual,
  type FrozenApproval,
  type FrozenRequirement,
} from "./quoteBinding";
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
  filterUsdcPaymentOptions,
  validatePaymentLimit,
  isUsdcAsset,
  isUrlAllowed,
  validateFacilitator,
} from "./utils";
import { SUPPORTED_NETWORKS, KNOWN_FACILITATORS } from "./constants";

/** Internal config type with all fields required */
interface ResolvedX402Config {
  registeredServices: string[];
  allowDynamicServiceRegistration: boolean;
  registeredFacilitators: Record<string, string>;
  maxPaymentUsdc: number;
}

/**
 * X402ActionProvider provides actions for making HTTP requests, with optional x402 payment handling.
 */
export class X402ActionProvider extends ActionProvider<WalletProvider> {
  private readonly config: ResolvedX402Config;
  private registeredServices: Set<string>;
  private readonly quoteStore = new QuoteBindingStore();

  /**
   * Creates a new instance of X402ActionProvider.
   * Initializes the provider with x402 capabilities.
   *
   * @param config - Optional configuration for service registration and payment limits
   */
  constructor(config: X402Config = {}) {
    super("x402", []);
    this.config = {
      registeredServices: config.registeredServices ?? [],
      allowDynamicServiceRegistration:
        config.allowDynamicServiceRegistration ??
        process.env.X402_ALLOW_DYNAMIC_SERVICE_REGISTRATION === "true",
      registeredFacilitators: config.registeredFacilitators ?? {},
      maxPaymentUsdc:
        config.maxPaymentUsdc ?? parseFloat(process.env.X402_MAX_PAYMENT_USDC ?? "1.0"),
    };
    this.registeredServices = new Set(this.config.registeredServices);
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
      // Validate facilitator is allowed (known name or registered name)
      const { isAllowed, resolvedUrl } = validateFacilitator(
        args.facilitator,
        this.config.registeredFacilitators,
      );
      if (!isAllowed) {
        const knownNames = Object.keys(KNOWN_FACILITATORS);
        const customNames = Object.keys(this.config.registeredFacilitators);
        const allNames = [...knownNames, ...customNames];
        return JSON.stringify(
          {
            error: true,
            message: "Facilitator not allowed",
            details: `The facilitator "${args.facilitator}" is not recognized. Use one of: ${allNames.join(", ")}`,
          },
          null,
          2,
        );
      }

      const discoveryUrl = resolvedUrl + "/discovery/resources";

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

      // Apply price filter
      filteredResources = await filterByMaxPrice(
        filteredResources,
        args.maxUsdcPrice,
        walletProvider,
        walletNetworks,
      );

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
it freezes the inspected request and one selected payment requirement, and returns a quoteBinding
handle for retry_http_request_with_x402. No payment authority is created on this step.

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
      // Check if service is registered
      if (!isUrlAllowed(args.url, this.registeredServices)) {
        return JSON.stringify(
          {
            error: true,
            message: "Service not registered",
            details: `The service URL "${args.url}" is not registered. Only approved services can be called.`,
            registeredServices: Array.from(this.registeredServices),
            suggestion: this.config.allowDynamicServiceRegistration
              ? "Use register_x402_service to register this service first."
              : "Dynamic service registration is disabled. Only pre-registered services can be used. Set allowDynamicServiceRegistration to true in the agent configuration to enable dynamic service registration.",
          },
          null,
          2,
        );
      }

      const finalUrl = buildUrlWithParams(args.url, args.queryParams);
      let method = args.method;
      let canHaveBody = ["POST", "PUT", "PATCH"].includes(method);
      let bodyBytes = canHaveBody && args.body ? JSON.stringify(args.body) : null;

      let response = await fetch(finalUrl, {
        method,
        headers: args.headers ?? undefined,
        body: bodyBytes ?? undefined,
        redirect: "manual",
      });

      // Retry with other http method for 404 status code
      if (response.status === 404) {
        method = method === "GET" ? "POST" : "GET";
        canHaveBody = ["POST", "PUT", "PATCH"].includes(method);
        bodyBytes = canHaveBody && args.body ? JSON.stringify(args.body) : null;
        response = await fetch(finalUrl, {
          method,
          headers: args.headers ?? undefined,
          body: bodyBytes ?? undefined,
          redirect: "manual",
        });
      }

      if (response.status >= 300 && response.status < 400) {
        return JSON.stringify(
          {
            error: true,
            message: "Redirect rejected",
            details:
              "The unpaid inspect request received a redirect. Redirect targets are not followed and cannot be frozen for payment.",
            httpStatus: response.status,
            url: finalUrl,
            method,
          },
          null,
          2,
        );
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

      // Filter to USDC-only payment options
      const usdcOptions = filterUsdcPaymentOptions(acceptsArray, walletProvider);
      const availableNetworks = usdcOptions.map(option => option.network);
      const hasMatchingNetwork = availableNetworks.some((net: string) =>
        walletNetworks.includes(net),
      );

      // Check if no USDC options available
      if (usdcOptions.length === 0) {
        return JSON.stringify(
          {
            error: true,
            message: "No USDC payment option available",
            details:
              "This service does not accept USDC payments. Only USDC payments are supported.",
            originalOptions: acceptsArray,
          },
          null,
          2,
        );
      }

      let paymentOptionsText = `The wallet networks ${walletNetworks.join(", ")} do not match any available USDC payment options (${availableNetworks.join(", ")}).`;

      if (hasMatchingNetwork) {
        const matchingOptions = usdcOptions.filter(option =>
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
        paymentOptionsText = `The USDC payment options are: ${formattedOptions.join(", ")}`;
      }

      // Extract discovery info from v2 response (description, mimeType, extensions)
      const discoveryInfo: Record<string, unknown> = {};
      if (paymentData.description) discoveryInfo.description = paymentData.description;
      if (paymentData.mimeType) discoveryInfo.mimeType = paymentData.mimeType;
      if (paymentData.extensions) discoveryInfo.extensions = paymentData.extensions;

      const matchingUsdc = usdcOptions.filter(option => walletNetworks.includes(option.network));
      const selectedRequirement = matchingUsdc[0] as FrozenRequirement | undefined;
      let quoteBinding: string | undefined;
      if (selectedRequirement) {
        const nowMs = Date.now();
        quoteBinding = this.quoteStore.create(
          {
            createdAtMs: nowMs,
            expiresAtMs: nowMs + QUOTE_BINDING_TTL_MS,
            request: canonicalizeRequest({
              method,
              url: finalUrl,
              headers: args.headers,
              bodyBytes,
            }),
            paymentRequiredEnvelope: paymentData,
            selectedRequirement,
          },
          nowMs,
        );
      }

      return JSON.stringify({
        status: "error_402_payment_required",
        acceptablePaymentOptions: usdcOptions,
        selectedRequirement: selectedRequirement ?? null,
        quoteBinding: quoteBinding ?? null,
        quoteBindingTtlMs: QUOTE_BINDING_TTL_MS,
        quoteBindingMaxPending: QUOTE_BINDING_MAX_PENDING,
        ...(Object.keys(discoveryInfo).length > 0 && { discoveryInfo }),
        nextSteps: [
          "Inform the user that the requested server replied with a 402 Payment Required response.",
          paymentOptionsText,
          "Include the description of the service in the response.",
          "IMPORTANT: Identify required or optional query or body parameters based on this response. If there are any, you must inform the user and request them to provide the values. Always suggest example values.",
          "CRITICAL: For POST/PUT/PATCH requests, you MUST use the 'body' parameter (NOT queryParams) to send data.",
          hasMatchingNetwork ? "Ask the user if they want to retry the request with payment." : "",
          hasMatchingNetwork
            ? "Use retry_http_request_with_x402 with the quoteBinding handle and the same method, URL, headers, query, and body. The handle is one-use and expires in 60 seconds (max 8 pending)."
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
This should be used after make_http_request returns a 402 response with a quoteBinding.
The official signing client is bound to the frozen request and payment requirement; drifted quotes are refused before the signer is invoked.
Prepared retry signs the frozen requirement via the official 2.7.0 selector and onBeforePaymentCreation hook, then plain-fetches the frozen request once with that payment header. It does not call wrapFetchWithPayment (which re-fetches 402 and can pick a drifted quote).
HTTP binding is transport replay of frozen request bytes. EIP-3009 transferWithAuthorization covers payment authorization fields, not URL/method/body.

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
      // Check if service is registered
      if (!isUrlAllowed(args.url, this.registeredServices)) {
        return JSON.stringify(
          {
            error: true,
            message: "Service not registered",
            details: `The service URL "${args.url}" is not registered. Only pre-registered services can be called.`,
            registeredServices: Array.from(this.registeredServices),
          },
          null,
          2,
        );
      }

      // Check that payment option is USDC
      if (!isUsdcAsset(args.selectedPaymentOption.asset, walletProvider)) {
        return JSON.stringify(
          {
            error: true,
            message: "Only USDC payments are supported",
            details: `The selected payment asset "${args.selectedPaymentOption.asset}" is not USDC.`,
          },
          null,
          2,
        );
      }

      // Validate payment amount against limit
      const paymentAmount =
        args.selectedPaymentOption.maxAmountRequired ??
        args.selectedPaymentOption.amount ??
        args.selectedPaymentOption.price ??
        "0";
      const paymentValidation = validatePaymentLimit(paymentAmount, this.config.maxPaymentUsdc);
      if (!paymentValidation.isValid) {
        return JSON.stringify(
          {
            error: true,
            message: "Payment exceeds limit",
            details: `The requested payment of ${paymentValidation.requestedAmount} USDC exceeds the maximum spending limit of ${paymentValidation.maxAmount} USDC.`,
            maxPaymentUsdc: this.config.maxPaymentUsdc,
          },
          null,
          2,
        );
      }

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

      const finalUrl = buildUrlWithParams(args.url, args.queryParams);
      const method = args.method;
      const canHaveBody = ["POST", "PUT", "PATCH"].includes(method);
      const bodyBytes = canHaveBody && args.body ? JSON.stringify(args.body) : null;
      const frozenRequest = canonicalizeRequest({
        method,
        url: finalUrl,
        headers: args.headers,
        bodyBytes,
      });

      const consumed = this.quoteStore.consume({
        handle: args.quoteBinding,
        request: frozenRequest,
        selectedPaymentOption: args.selectedPaymentOption,
        extensions: args.extensions,
        nowMs: Date.now(),
      });
      if (!consumed.ok) {
        return JSON.stringify(
          {
            error: true,
            message: consumed.message,
            details: consumed.details,
            signCount: 0,
            possibleSpend: false,
          },
          null,
          2,
        );
      }

      const signState = { count: 0 };
      const client = await this.createX402Client(walletProvider, {
        paymentRequirementsSelector: createFrozenSelector(
          consumed.value.selectedRequirement,
        ) as SelectPaymentRequirements,
        onBeforePaymentCreation: createFrozenBeforePaymentHook(consumed.value),
        onSign: () => {
          signState.count += 1;
        },
      });
      const httpClient = new x402HTTPClient(client);

      try {
        const paymentPayload = await httpClient.createPaymentPayload(
          consumed.value.paymentRequiredEnvelope as never,
        );
        const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
        const response = await fetch(consumed.value.request.url, {
          method: consumed.value.request.method,
          headers: {
            ...consumed.value.request.headers,
            ...paymentHeaders,
          },
          body: consumed.value.request.bodyBytes ?? undefined,
          redirect: "manual",
        });

        const data = await this.parseResponseData(response);
        const paymentProof = this.readOfficialSettlement(httpClient, response);
        const frozenRequirement = consumed.value.selectedRequirement;
        const confirmed = this.isConfirmedSettlement({
          paymentProof,
          walletAddress: walletProvider.getAddress(),
          frozenNetwork: frozenRequirement.network,
        });

        if (response.status === 200 && confirmed) {
          return JSON.stringify({
            status: "success",
            data,
            message: "Request completed successfully with payment",
            details: {
              url: consumed.value.request.url,
              method: consumed.value.request.method,
              paymentUsed: frozenPaymentUsed(frozenRequirement),
              paymentProof,
            },
          });
        }

        if (signState.count > 0) {
          return this.possibleSpendResponse({
            signCount: signState.count,
            httpStatus: response.status,
            url: consumed.value.request.url,
            method: consumed.value.request.method,
            data,
            reason: "A payment signature was created but settlement was not confirmed.",
          });
        }

        return JSON.stringify({
          status: "error",
          error: true,
          message:
            response.status === 200
              ? "Request returned 200 without a well-formed payment-response"
              : `Request failed with status ${response.status}`,
          httpStatus: response.status,
          data,
          signCount: 0,
          possibleSpend: false,
          details: {
            url: consumed.value.request.url,
            method: consumed.value.request.method,
          },
        });
      } catch (error) {
        if (signState.count > 0) {
          return this.possibleSpendResponse({
            signCount: signState.count,
            url: consumed.value.request.url,
            method: consumed.value.request.method,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        return JSON.stringify(
          {
            error: true,
            message: error instanceof Error ? error.message : String(error),
            details: "Signer was not invoked; refusing without possible-spend.",
            signCount: 0,
            possibleSpend: false,
          },
          null,
          2,
        );
      }
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
- Still not a user-confirmation flow
- Auto-pay freezes the first 402's exact-one wallet-matching USDC requirement, or fails closed before sign
- A later 402 is never signed: payment is created from the frozen requirement via x402HTTPClient.createPaymentPayload + encodePaymentSignatureHeader + plain fetch (same as retry_http_request_with_x402). wrapFetchWithPayment is not used.
- NOT recipient-screened
- HTTP binding is transport replay of the inspected request, not EIP-3009 crypto binding of URL/method/body
- Paid delivery success requires official x402HTTPClient.getPaymentSettleResponse proof, success===true, nonempty payer, exact frozen network, network-aware transaction, and family-correct payer equality (EVM case-insensitive hex; SVM exact Base58). HTTP 200 alone is never paid success. After a signature, missing or invalid settlement is terminal unreconciled_possible_spend.

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
      // Check if service is registered
      if (!isUrlAllowed(args.url, this.registeredServices)) {
        return JSON.stringify(
          {
            error: true,
            message: "Service not registered",
            details: `The service URL "${args.url}" is not registered. Only pre-registered services can be called.`,
            registeredServices: Array.from(this.registeredServices),
            suggestion: this.config.allowDynamicServiceRegistration
              ? "Use register_x402_service to register this service first."
              : "Dynamic service registration is disabled. Only pre-registered services can be used. Set allowDynamicServiceRegistration to true in the agent configuration to enable dynamic service registration.",
          },
          null,
          2,
        );
      }

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

      const finalUrl = buildUrlWithParams(args.url, args.queryParams);
      const method = args.method;
      const canHaveBody = ["POST", "PUT", "PATCH"].includes(method);
      const bodyBytes = canHaveBody && args.body ? JSON.stringify(args.body) : null;

      const headers: Record<string, string> = { ...(args.headers ?? {}) };
      if (canHaveBody && args.body) {
        headers["Content-Type"] = "application/json";
      }

      const signState = { count: 0 };

      try {
        const inspectResponse = await fetch(finalUrl, {
          method,
          headers,
          body: bodyBytes ?? undefined,
          redirect: "manual",
        });

        if (inspectResponse.status !== 402) {
          const data = await this.parseResponseData(inspectResponse);
          return JSON.stringify(
            {
              success: false,
              error: true,
              message:
                inspectResponse.status === 200
                  ? "Request returned 200 without a well-formed payment-response"
                  : `Request failed with status ${inspectResponse.status}`,
              url: finalUrl,
              method,
              status: inspectResponse.status,
              data,
              signCount: 0,
              possibleSpend: false,
            },
            null,
            2,
          );
        }

        const { paymentData, acceptsArray } =
          await this.readPaymentRequiredEnvelope(inspectResponse);
        const walletNetworks = getX402Networks(walletProvider.getNetwork());
        const usdcOptions = filterUsdcPaymentOptions(acceptsArray, walletProvider);
        const matching = usdcOptions.filter(
          option =>
            walletNetworks.includes(option.network) &&
            typeof option.scheme === "string" &&
            option.scheme.length > 0,
        );

        if (matching.length !== 1) {
          return JSON.stringify(
            {
              success: false,
              error: true,
              message: "Cannot freeze an exact-one payment requirement",
              details:
                matching.length === 0
                  ? "Auto-pay requires exactly one wallet-matching USDC requirement; found 0. Signer will not be invoked."
                  : "Auto-pay requires exactly one wallet-matching USDC requirement; found multiple. A later or drifted 402 is refused before sign.",
              signCount: 0,
              possibleSpend: false,
            },
            null,
            2,
          );
        }

        const selectedRequirement = matching[0] as FrozenRequirement;
        const frozenApproval: FrozenApproval = {
          handle: "autopay",
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + QUOTE_BINDING_TTL_MS,
          request: canonicalizeRequest({
            method,
            url: finalUrl,
            headers,
            bodyBytes,
          }),
          paymentRequiredEnvelope: paymentData,
          selectedRequirement,
        };

        const paymentAmount =
          (typeof selectedRequirement.maxAmountRequired === "string"
            ? selectedRequirement.maxAmountRequired
            : undefined) ??
          (typeof selectedRequirement.amount === "string"
            ? selectedRequirement.amount
            : undefined) ??
          (typeof selectedRequirement.price === "string" ? selectedRequirement.price : undefined) ??
          "0";
        const paymentValidation = validatePaymentLimit(paymentAmount, this.config.maxPaymentUsdc);
        if (!paymentValidation.isValid) {
          return JSON.stringify(
            {
              success: false,
              error: true,
              message: "Payment exceeds limit",
              details: `The requested payment of ${paymentValidation.requestedAmount} USDC exceeds the maximum spending limit of ${paymentValidation.maxAmount} USDC.`,
              maxPaymentUsdc: this.config.maxPaymentUsdc,
              signCount: 0,
              possibleSpend: false,
            },
            null,
            2,
          );
        }

        const client = await this.createX402Client(walletProvider, {
          paymentRequirementsSelector: createFrozenSelector(
            selectedRequirement,
          ) as SelectPaymentRequirements,
          onBeforePaymentCreation: createFrozenBeforePaymentHook(frozenApproval),
          onSign: () => {
            signState.count += 1;
          },
        });
        const httpClient = new x402HTTPClient(client);
        const paymentPayload = await httpClient.createPaymentPayload(paymentData as never);
        const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
        const response = await fetch(finalUrl, {
          method,
          headers: {
            ...headers,
            ...paymentHeaders,
          },
          body: bodyBytes ?? undefined,
          redirect: "manual",
        });

        const data = await this.parseResponseData(response);
        const paymentProof = this.readOfficialSettlement(httpClient, response);
        const confirmed = this.isConfirmedSettlement({
          paymentProof,
          walletAddress: walletProvider.getAddress(),
          frozenNetwork: selectedRequirement.network,
        });

        if (response.status === 200 && confirmed) {
          return JSON.stringify(
            {
              success: true,
              message: "Request completed successfully (payment handled automatically if required)",
              url: finalUrl,
              method,
              status: response.status,
              data,
              paymentProof,
              signCount: signState.count,
              possibleSpend: signState.count > 0,
            },
            null,
            2,
          );
        }

        if (signState.count > 0) {
          return this.possibleSpendResponse({
            signCount: signState.count,
            httpStatus: response.status,
            url: finalUrl,
            method,
            data,
            reason: "A payment signature was created but settlement was not confirmed.",
          });
        }

        return JSON.stringify(
          {
            success: false,
            error: true,
            message:
              response.status === 200
                ? "Request returned 200 without a well-formed payment-response"
                : `Request failed with status ${response.status}`,
            url: finalUrl,
            method,
            status: response.status,
            data,
            signCount: 0,
            possibleSpend: false,
          },
          null,
          2,
        );
      } catch (error) {
        if (signState.count > 0) {
          return this.possibleSpendResponse({
            signCount: signState.count,
            url: finalUrl,
            method,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        if (error instanceof Error && /frozen|exact-one|drift|refusing/i.test(error.message)) {
          return JSON.stringify(
            {
              success: false,
              error: true,
              message: error.message,
              details:
                "Signer was not invoked; refusing drifted auto-pay quote without possible-spend.",
              signCount: 0,
              possibleSpend: false,
            },
            null,
            2,
          );
        }
        return handleHttpError(error, args.url);
      }
    } catch (error) {
      return handleHttpError(error, args.url);
    }
  }

  /**
   * Registers a service URL for x402 requests.
   * Only available when allowDynamicServiceRegistration is true in the config.
   *
   * @param _walletProvider - The wallet provider (unused but required by interface)
   * @param args - The service URL to register
   * @returns A JSON string confirming registration or error if not allowed
   */
  @CreateAction({
    name: "register_x402_service",
    description: `
Registers a service URL for x402 requests. Use this after discovering a service
via discover_x402_services to enable HTTP requests to that service.

NOTE: This action is only available if service discovery is enabled in the agent configuration.
If disabled, services must be pre-registered by the agent administrator.`,
    schema: RegisterServiceSchema,
  })
  async registerService(
    _walletProvider: WalletProvider,
    args: z.infer<typeof RegisterServiceSchema>,
  ): Promise<string> {
    // Check if service discovery is allowed
    if (!this.config.allowDynamicServiceRegistration) {
      return JSON.stringify(
        {
          error: true,
          message: "Dynamic service registration is disabled",
          details:
            "The agent is configured with allowDynamicServiceRegistration: false. Services must be pre-registered.",
        },
        null,
        2,
      );
    }

    try {
      // Validate URL format
      new URL(args.url);

      // Add to registered services (full URL for prefix matching)
      this.registeredServices.add(args.url);

      return JSON.stringify(
        {
          success: true,
          message: `Service registered successfully`,
          registeredUrl: args.url,
          totalRegisteredServices: this.registeredServices.size,
        },
        null,
        2,
      );
    } catch {
      return JSON.stringify(
        {
          error: true,
          message: "Invalid URL format",
          details: `"${args.url}" is not a valid URL.`,
        },
        null,
        2,
      );
    }
  }

  /**
   * Lists all registered service URLs that can be used for x402 requests.
   *
   * @param _walletProvider - The wallet provider (unused but required by interface)
   * @param _args - Empty arguments object (unused but required by interface)
   * @returns A JSON string containing the list of registered services
   */
  @CreateAction({
    name: "list_registered_services",
    description: `
Lists all service URLs that are currently approved for x402 requests.
These are the only services that can be called using make_http_request or make_http_request_with_x402.`,
    schema: EmptySchema,
  })
  async listRegisteredServices(
    _walletProvider: WalletProvider,
    _args: z.infer<typeof EmptySchema>,
  ): Promise<string> {
    const services = Array.from(this.registeredServices);

    return JSON.stringify(
      {
        success: true,
        registeredServices: services,
        count: services.length,
        allowDynamicServiceRegistration: this.config.allowDynamicServiceRegistration,
        note: this.config.allowDynamicServiceRegistration
          ? "You can register new services using register_x402_service."
          : "Dynamic service registration is disabled. Only pre-registered services can be used.",
      },
      null,
      2,
    );
  }

  /**
   * Lists all facilitators (known and custom registered) that can be used for service discovery.
   *
   * @param _walletProvider - The wallet provider (unused but required by interface)
   * @param _args - Empty arguments object (unused but required by interface)
   * @returns A JSON string containing the list of facilitators
   */
  @CreateAction({
    name: "list_registered_facilitators",
    description: "Lists all facilitators that can be used with discover_x402_services.",
    schema: EmptySchema,
  })
  async listRegisteredFacilitators(
    _walletProvider: WalletProvider,
    _args: z.infer<typeof EmptySchema>,
  ): Promise<string> {
    const knownFacilitators = Object.entries(KNOWN_FACILITATORS).map(([name, url]) => ({
      name,
      url,
      type: "known" as const,
    }));

    const customFacilitators = Object.entries(this.config.registeredFacilitators).map(
      ([name, url]) => ({
        name,
        url,
        type: "custom" as const,
      }),
    );

    const allFacilitators = [...knownFacilitators, ...customFacilitators];

    return JSON.stringify(
      {
        success: true,
        facilitators: allFacilitators,
        knownCount: knownFacilitators.length,
        customCount: customFacilitators.length,
        totalCount: allFacilitators.length,
        note: "Use the 'facilitator' parameter in discover_x402_services to query a specific facilitator by name.",
      },
      null,
      2,
    );
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
   * @param options - Optional selector, pre-sign hook, and sign probe
   * @param options.paymentRequirementsSelector - Official 2.7.0 payment-requirements selector
   * @param options.onBeforePaymentCreation - Official pre-creation hook that may abort drift
   * @param options.onSign - Invoked when the official scheme calls a signer method
   * @returns Configured x402Client
   */
  private async createX402Client(
    walletProvider: WalletProvider,
    options?: {
      paymentRequirementsSelector?: SelectPaymentRequirements;
      onBeforePaymentCreation?: (context: {
        paymentRequired: unknown;
        selectedRequirements: unknown;
      }) => Promise<void | { abort: true; reason: string }>;
      onSign?: () => void;
    },
  ): Promise<x402Client> {
    const client = new x402Client(options?.paymentRequirementsSelector);

    const wrapSign = <TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => Promise<TResult>,
    ) => {
      return async (...args: TArgs): Promise<TResult> => {
        options?.onSign?.();
        return fn(...args);
      };
    };

    if (walletProvider instanceof EvmWalletProvider) {
      const account = walletProvider.toSigner();
      const signerRecord =
        account && typeof account === "object"
          ? (account as {
              signTypedData?: (args: never) => Promise<`0x${string}`>;
              signMessage?: (args: never) => Promise<`0x${string}`>;
              signTransaction?: (args: never) => Promise<`0x${string}`>;
              sign?: (args: never) => Promise<`0x${string}`>;
            })
          : {};
      const signer = {
        ...(typeof account === "object" && account ? account : {}),
        ...(typeof signerRecord.signTypedData === "function"
          ? { signTypedData: wrapSign(signerRecord.signTypedData.bind(signerRecord)) }
          : {}),
        ...(typeof signerRecord.signMessage === "function"
          ? { signMessage: wrapSign(signerRecord.signMessage.bind(signerRecord)) }
          : {}),
        ...(typeof signerRecord.signTransaction === "function"
          ? { signTransaction: wrapSign(signerRecord.signTransaction.bind(signerRecord)) }
          : {}),
        ...(typeof signerRecord.sign === "function"
          ? { sign: wrapSign(signerRecord.sign.bind(signerRecord)) }
          : {}),
        readContract: (args: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: args.address,
            abi: args.abi as never,
            functionName: args.functionName as never,
            args: args.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer: signer as never });
    } else if (walletProvider instanceof SvmWalletProvider) {
      const account = await walletProvider.toSigner();
      const signerRecord =
        account && typeof account === "object"
          ? (account as {
              signTransactions?: (...args: never[]) => Promise<unknown>;
            })
          : {};
      // Official @x402/svm 2.7.0 ExactSvmScheme* createPaymentPayload attaches
      // this signer as transfer authority, then
      // @solana/kit partiallySignTransactionMessageWithSigners calls
      // TransactionPartialSigner.signTransactions. Wrap THAT method only.
      const signer = {
        ...(typeof account === "object" && account ? account : {}),
        ...(typeof signerRecord.signTransactions === "function"
          ? { signTransactions: wrapSign(signerRecord.signTransactions.bind(signerRecord)) }
          : {}),
      };
      registerExactSvmScheme(client, { signer: signer as never });
    }

    if (options?.onBeforePaymentCreation) {
      client.onBeforePaymentCreation(options.onBeforePaymentCreation);
    }

    return client;
  }

  /**
   * Reads a 402 payment-required envelope from the v2 header or v1 body.
   *
   * @param response - HTTP 402 response
   * @returns Envelope object and accepts array
   */
  private async readPaymentRequiredEnvelope(response: Response): Promise<{
    paymentData: Record<string, unknown>;
    acceptsArray: Array<{
      scheme?: string;
      network: string;
      asset: string;
      maxAmountRequired?: string;
      amount?: string;
      payTo?: string;
    }>;
  }> {
    let acceptsArray: Array<{
      scheme?: string;
      network: string;
      asset: string;
      maxAmountRequired?: string;
      amount?: string;
      payTo?: string;
    }> = [];
    let paymentData: Record<string, unknown> = {};

    const paymentRequiredHeader = response.headers.get("payment-required");
    if (paymentRequiredHeader) {
      try {
        const decoded = JSON.parse(atob(paymentRequiredHeader)) as Record<string, unknown>;
        acceptsArray = (decoded.accepts as typeof acceptsArray) ?? [];
        paymentData = decoded;
      } catch {
        // Header parsing failed, fall back to body
      }
    }

    if (acceptsArray.length === 0) {
      paymentData = (await response.json()) as Record<string, unknown>;
      acceptsArray = (paymentData.accepts as typeof acceptsArray) ?? [];
    }

    return { paymentData, acceptsArray };
  }

  /**
   * Decodes settlement through the locked official x402 2.7.0 surface.
   * Missing or malformed PAYMENT-RESPONSE / X-PAYMENT-RESPONSE is null.
   *
   * @param httpClient - Official HTTP client already used to create the payload
   * @param response - Paid or unpaid HTTP response
   * @returns Official settle response, or null when the decoder throws
   */
  private readOfficialSettlement(
    httpClient: x402HTTPClient,
    response: Response,
  ): {
    success?: boolean;
    transaction?: string;
    network?: string;
    payer?: string;
  } | null {
    try {
      return httpClient.getPaymentSettleResponse(name => response.headers.get(name));
    } catch {
      return null;
    }
  }

  /**
   * Official settlement gates shared by prepared retry and auto-pay.
   * Both paths require a frozen selected requirement. Paid success requires
   * decoded success===true, a nonempty payer equal to the signing wallet
   * (EVM: case-insensitive hex; SVM: exact case-sensitive Base58), the exact
   * frozen network, and a network-aware transaction identifier (EVM: 0x+64 hex;
   * SVM: Bitcoin-alphabet Base58 64-byte signature). Missing or empty payer or
   * network, arbitrary text such as "not-a-tx", and wrong-family hashes do not
   * promote.
   *
   * @param args - Decoded proof plus wallet / freeze context
   * @param args.paymentProof - Official decoder output, or null
   * @param args.walletAddress - Signing wallet address
   * @param args.frozenNetwork - Frozen selected requirement network
   * @returns True only when paid delivery may be labeled successful
   */
  private isConfirmedSettlement(args: {
    paymentProof: {
      success?: boolean;
      transaction?: string;
      network?: string;
      payer?: string;
    } | null;
    walletAddress: string;
    frozenNetwork: string;
  }): boolean {
    const proof = args.paymentProof;
    if (!proof || proof.success !== true) {
      return false;
    }
    const transactionId = typeof proof.transaction === "string" ? proof.transaction : "";
    if (!isWellFormedSettlementTransaction(args.frozenNetwork, transactionId)) {
      return false;
    }

    if (typeof proof.network !== "string" || proof.network.length === 0) {
      return false;
    }
    if (proof.network !== args.frozenNetwork) {
      return false;
    }

    const decodedPayer = proof.payer;
    if (typeof decodedPayer !== "string" || decodedPayer.length === 0) {
      return false;
    }
    if (!settlementPayersEqual(args.frozenNetwork, decodedPayer, args.walletAddress)) {
      return false;
    }
    return true;
  }

  /**
   * Formats possible-spend evidence after a signature was created.
   *
   * @param args - Sign count and request context
   * @param args.signCount - Number of signer invocations observed
   * @param args.httpStatus - HTTP status after the signed request, if any
   * @param args.url - Frozen request URL
   * @param args.method - Frozen request method
   * @param args.data - Response body if one was parsed
   * @param args.reason - Why settlement could not be confirmed
   * @returns JSON failure that never claims settlement and never invents a tx id
   */
  private possibleSpendResponse(args: {
    signCount: number;
    httpStatus?: number;
    url: string;
    method: string;
    data?: unknown;
    reason: string;
  }): string {
    return JSON.stringify({
      error: true,
      status: "unreconciled_possible_spend",
      unreconciled: true,
      message:
        "Unreconciled possible-spend: a payment signature was created but settlement was not confirmed.",
      details: args.reason,
      signCount: args.signCount,
      possibleSpend: true,
      httpStatus: args.httpStatus,
      request: {
        url: args.url,
        method: args.method,
      },
      data: args.data,
    });
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

export const x402ActionProvider = (config?: X402Config) => new X402ActionProvider(config);
