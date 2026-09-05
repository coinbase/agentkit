import { z } from "zod";
import { encodeFunctionData, parseUnits, formatUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { validatePaymentLimit } from "../x402/utils";
import {
  SprayEthSchema,
  SprayTokenSchema,
  SprayEthVariableSchema,
  SprayTokenVariableSchema,
  SpraayValidateBatchSchema,
  SpraayEstimateBatchSchema,
  SpraayExecuteBatchGatewaySchema,
  SpraayCreateEscrowSchema,
  SpraayActionProviderConfig,
} from "./schemas";
import {
  SPRAAY_CONTRACT_ADDRESS,
  SPRAAY_ABI,
  ERC20_ABI,
  EIP2612_PERMIT_TYPES,
  PERMIT_DEADLINE_SECONDS,
  SPRAAY_PROTOCOL_FEE_BPS,
  SPRAAY_GATEWAY_BASE_URL,
  SPRAAY_FREE_VALIDATE_BATCH_PATH,
  SPRAAY_FREE_ESTIMATE_BATCH_PATH,
  SPRAAY_GATEWAY_BATCH_EXECUTE_PATH,
  SPRAAY_GATEWAY_BATCH_ESTIMATE_PATH,
  SPRAAY_GATEWAY_ESCROW_CREATE_PATH,
  SPRAAY_BPA_VERSION,
  ZERO_ADDRESS,
} from "./constants";

/** Internal config type with all fields resolved */
interface ResolvedSpraayConfig {
  maxGatewayPaymentUsdc: number;
  x402PaymentHeader: string | null;
  gatewayBaseUrl: string;
}

/** A single (recipient, amount) batch entry in whole units */
interface BatchEntry {
  recipient: string;
  amount: string;
}

/** Result of a free gateway pre-flight validation */
interface PreflightResult {
  proceed: boolean;
  report: string | null;
}

/**
 * SpraayActionProvider — payment coordination for AgentKit agents on Base.
 *
 * Batch payments are the core capability: send ETH or any ERC-20 token to up
 * to 200 recipients with per-recipient amounts, atomically, in a single
 * transaction against the deployed Spraay batch contract. Escrow creation via
 * the Spraay gateway is the complementary second pillar.
 *
 * Capabilities:
 * - Direct on-chain batch execution (agent signs, agent pays gas):
 *   equal or variable amounts, ETH or ERC-20, up to 200 recipients atomically
 * - EIP-2612 permit-optimized approvals for tokens that support it (e.g. USDC
 *   on Base), with clean fallback to approve for non-permit tokens
 * - Free gateway pre-flight: validate a batch and estimate its cost before
 *   signing anything (POST /free/validate-batch, GET /free/estimate-batch)
 * - x402-metered gateway execution (gateway signs and settles, agent pays a
 *   metered USDC fee via the x402 protocol): POST /api/v1/batch/execute
 * - Escrow creation via the x402-metered gateway: POST /api/v1/escrow/create
 *
 * Contract: 0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC (Base Mainnet)
 * Gateway: https://gateway.spraay.app
 * Website: https://spraay.app
 */
export class SpraayActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: ResolvedSpraayConfig;

  /**
   * Creates a new SpraayActionProvider instance.
   *
   * @param config - Optional configuration for gateway payment limits and endpoints
   */
  constructor(config: SpraayActionProviderConfig = {}) {
    super("spraay", []);
    this.config = {
      maxGatewayPaymentUsdc:
        config.maxGatewayPaymentUsdc ??
        parseFloat(process.env.SPRAAY_MAX_GATEWAY_PAYMENT_USDC ?? "1.0"),
      x402PaymentHeader: config.x402PaymentHeader ?? null,
      gatewayBaseUrl: config.gatewayBaseUrl ?? SPRAAY_GATEWAY_BASE_URL,
    };
  }

  /**
   * Spray equal amounts of ETH to multiple recipients in one transaction.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (recipients, amountPerRecipient, preflight).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_eth",
    description: `
Send equal amounts of ETH to multiple recipients in a single atomic transaction via the Spraay batch contract on Base.
Ideal for team payments, airdrops, or distributing rewards. Up to 200 recipients per transaction; the protocol fee (default 0.3%) is added on top.
This is the direct on-chain path: the agent signs the transaction and pays gas itself. For x402-metered gateway execution instead, use spraay_execute_batch_gateway.
Set preflight=true to validate the batch against the free Spraay gateway endpoint before signing.
    `.trim(),
    schema: SprayEthSchema,
  })
  async sprayEth(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayEthSchema>,
  ): Promise<string> {
    const { recipients, amountPerRecipient } = args;

    try {
      let preflightReport: string | null = null;
      if (args.preflight) {
        const preflight = await this.runPreflight(
          "ETH",
          recipients.map(recipient => ({ recipient, amount: amountPerRecipient })),
        );
        if (!preflight.proceed) {
          return `Batch failed Spraay gateway pre-flight validation; no transaction was signed.\n${preflight.report}`;
        }
        preflightReport = preflight.report;
      }

      const amountWei = parseUnits(amountPerRecipient, 18);
      const subtotal = amountWei * BigInt(recipients.length);
      const feeBps = await this.getFeeBps(walletProvider);
      const fee = (subtotal * BigInt(feeBps)) / BigInt(10000);
      const totalValue = subtotal + fee;

      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayEqual",
        args: [ZERO_ADDRESS, recipients as `0x${string}`[], amountWei],
      });

      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS,
        data,
        value: totalValue,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      return this.formatSprayResult({
        headline: `Successfully sprayed ${amountPerRecipient} ETH to ${recipients.length} recipients via Spraay.`,
        subtotal,
        fee,
        feeBps,
        decimals: 18,
        symbol: "ETH",
        txHash,
        blockNumber: receipt.blockNumber,
        preflightReport,
      });
    } catch (error) {
      return `Error spraying ETH via Spraay: ${error}`;
    }
  }

  /**
   * Spray equal amounts of an ERC-20 token to multiple recipients.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (tokenAddress, recipients, amountPerRecipient, preflight).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_token",
    description: `
Send equal amounts of an ERC-20 token (like USDC) to multiple recipients in a single atomic transaction via the Spraay batch contract on Base.
Up to 200 recipients per transaction; the protocol fee (default 0.3%) is added on top.
Allowance handling is automatic: for tokens that support EIP-2612 permit (USDC on Base does), a signed permit grants an exact, deadline-bounded allowance instead of a standard approve; non-permit tokens fall back to approve.
This is the direct on-chain path: the agent signs and pays gas itself. For x402-metered gateway execution instead, use spraay_execute_batch_gateway.
Set preflight=true to validate the batch against the free Spraay gateway endpoint before signing.
    `.trim(),
    schema: SprayTokenSchema,
  })
  async sprayToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayTokenSchema>,
  ): Promise<string> {
    const { tokenAddress, recipients, amountPerRecipient } = args;

    try {
      const decimals = await this.getTokenDecimals(walletProvider, tokenAddress);
      const symbol = await this.getTokenSymbol(walletProvider, tokenAddress);

      let preflightReport: string | null = null;
      if (args.preflight) {
        const preflight = await this.runPreflight(
          symbol,
          recipients.map(recipient => ({ recipient, amount: amountPerRecipient })),
        );
        if (!preflight.proceed) {
          return `Batch failed Spraay gateway pre-flight validation; no transaction was signed.\n${preflight.report}`;
        }
        preflightReport = preflight.report;
      }

      const amountPerRecipientWei = parseUnits(amountPerRecipient, decimals);
      const subtotal = amountPerRecipientWei * BigInt(recipients.length);
      const feeBps = await this.getFeeBps(walletProvider);
      const fee = (subtotal * BigInt(feeBps)) / BigInt(10000);
      const totalAmount = subtotal + fee;

      const allowanceResult = await this.ensureTokenAllowance(
        walletProvider,
        tokenAddress,
        totalAmount,
      );

      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayEqual",
        args: [tokenAddress as `0x${string}`, recipients as `0x${string}`[], amountPerRecipientWei],
      });

      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS,
        data,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      return this.formatSprayResult({
        headline: `Successfully sprayed ${amountPerRecipient} ${symbol} to ${recipients.length} recipients via Spraay.`,
        preflightReport,
        allowanceResult,
        subtotal,
        fee,
        feeBps,
        decimals,
        symbol,
        txHash,
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      return `Error spraying tokens via Spraay: ${error}`;
    }
  }

  /**
   * Spray variable amounts of ETH to multiple recipients.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (recipients, amounts, preflight).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_eth_variable",
    description: `
Send different amounts of ETH to multiple recipients in a single atomic transaction via the Spraay batch contract on Base.
Each recipient gets its own specified amount — ideal for bounty payouts or tiered distributions. Up to 200 recipients per transaction; the protocol fee (default 0.3%) is added on top.
This is the direct on-chain path: the agent signs and pays gas itself. For x402-metered gateway execution instead, use spraay_execute_batch_gateway.
Set preflight=true to validate the batch against the free Spraay gateway endpoint before signing.
    `.trim(),
    schema: SprayEthVariableSchema,
  })
  async sprayEthVariable(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayEthVariableSchema>,
  ): Promise<string> {
    const { recipients, amounts: amountStrings } = args;

    if (recipients.length !== amountStrings.length) {
      return `Error: recipients array length (${recipients.length}) must match amounts array length (${amountStrings.length}).`;
    }

    try {
      let preflightReport: string | null = null;
      if (args.preflight) {
        const preflight = await this.runPreflight(
          "ETH",
          recipients.map((recipient, i) => ({ recipient, amount: amountStrings[i] })),
        );
        if (!preflight.proceed) {
          return `Batch failed Spraay gateway pre-flight validation; no transaction was signed.\n${preflight.report}`;
        }
        preflightReport = preflight.report;
      }

      const amounts = amountStrings.map(a => parseUnits(a, 18));
      const subtotal = amounts.reduce((sum, a) => sum + a, BigInt(0));
      const feeBps = await this.getFeeBps(walletProvider);
      const fee = (subtotal * BigInt(feeBps)) / BigInt(10000);
      const totalValue = subtotal + fee;

      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayETH",
        args: [
          recipients.map((recipient, i) => ({
            recipient: recipient as `0x${string}`,
            amount: amounts[i],
          })),
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS,
        data,
        value: totalValue,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      return this.formatSprayResult({
        headline: `Successfully sprayed variable ETH amounts to ${recipients.length} recipients via Spraay.`,
        preflightReport,
        subtotal,
        fee,
        feeBps,
        decimals: 18,
        symbol: "ETH",
        txHash,
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      return `Error spraying variable ETH via Spraay: ${error}`;
    }
  }

  /**
   * Spray variable amounts of an ERC-20 token to multiple recipients.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (tokenAddress, recipients, amounts, preflight).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_token_variable",
    description: `
Send different amounts of an ERC-20 token to multiple recipients in a single atomic transaction via the Spraay batch contract on Base.
Each recipient gets its own specified amount. Up to 200 recipients per transaction; the protocol fee (default 0.3%) is added on top.
Allowance handling is automatic: EIP-2612 permit for tokens that support it (USDC on Base does), approve fallback otherwise.
This is the direct on-chain path: the agent signs and pays gas itself. For x402-metered gateway execution instead, use spraay_execute_batch_gateway.
Set preflight=true to validate the batch against the free Spraay gateway endpoint before signing.
    `.trim(),
    schema: SprayTokenVariableSchema,
  })
  async sprayTokenVariable(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayTokenVariableSchema>,
  ): Promise<string> {
    const { tokenAddress, recipients, amounts: amountStrings } = args;

    if (recipients.length !== amountStrings.length) {
      return `Error: recipients array length (${recipients.length}) must match amounts array length (${amountStrings.length}).`;
    }

    try {
      const decimals = await this.getTokenDecimals(walletProvider, tokenAddress);
      const symbol = await this.getTokenSymbol(walletProvider, tokenAddress);

      let preflightReport: string | null = null;
      if (args.preflight) {
        const preflight = await this.runPreflight(
          symbol,
          recipients.map((recipient, i) => ({ recipient, amount: amountStrings[i] })),
        );
        if (!preflight.proceed) {
          return `Batch failed Spraay gateway pre-flight validation; no transaction was signed.\n${preflight.report}`;
        }
        preflightReport = preflight.report;
      }

      const amounts = amountStrings.map(a => parseUnits(a, decimals));
      const subtotal = amounts.reduce((sum, a) => sum + a, BigInt(0));
      const feeBps = await this.getFeeBps(walletProvider);
      const fee = (subtotal * BigInt(feeBps)) / BigInt(10000);
      const totalAmount = subtotal + fee;

      const allowanceResult = await this.ensureTokenAllowance(
        walletProvider,
        tokenAddress,
        totalAmount,
      );

      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayToken",
        args: [
          tokenAddress as `0x${string}`,
          recipients.map((recipient, i) => ({
            recipient: recipient as `0x${string}`,
            amount: amounts[i],
          })),
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS,
        data,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      return this.formatSprayResult({
        headline: `Successfully sprayed variable ${symbol} amounts to ${recipients.length} recipients via Spraay.`,
        preflightReport,
        allowanceResult,
        subtotal,
        fee,
        feeBps,
        decimals,
        symbol,
        txHash,
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      return `Error spraying variable tokens via Spraay: ${error}`;
    }
  }

  /**
   * Validate a batch via the free Spraay gateway pre-flight endpoint.
   *
   * @param _walletProvider - The wallet provider (unused; validation is off-chain and free).
   * @param args - The batch to validate (token, recipients, chain).
   * @returns A JSON string with the gateway validation result.
   */
  @CreateAction({
    name: "spraay_validate_batch",
    description: `
Validate a batch payment against the free Spraay gateway pre-flight endpoint (POST ${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_FREE_VALIDATE_BATCH_PATH}). No payment and no transaction signing required.
Checks recipients and amounts and returns valid/errors/warnings/summary. Use this before spraay_eth/spraay_token/spraay_eth_variable/spraay_token_variable or spraay_execute_batch_gateway to catch malformed batches before signing anything.
    `.trim(),
    schema: SpraayValidateBatchSchema,
  })
  async validateBatch(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof SpraayValidateBatchSchema>,
  ): Promise<string> {
    try {
      const response = await fetch(
        `${this.config.gatewayBaseUrl}${SPRAAY_FREE_VALIDATE_BATCH_PATH}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.buildValidateBody(args.chain, args.token, args.recipients)),
        },
      );

      const data = await this.parseResponseData(response);

      if (!response.ok) {
        return JSON.stringify(
          {
            error: true,
            message: `Spraay gateway validation request failed with status ${response.status}`,
            data,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          endpoint: SPRAAY_FREE_VALIDATE_BATCH_PATH,
          validation: data,
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: true,
          message: "Failed to reach the Spraay gateway for batch validation",
          details: error instanceof Error ? error.message : String(error),
          note: "Validation is an optional pre-flight step; the direct on-chain batch actions remain available.",
        },
        null,
        2,
      );
    }
  }

  /**
   * Estimate batch execution cost via the free Spraay gateway endpoint.
   *
   * @param _walletProvider - The wallet provider (unused; estimation is off-chain and free).
   * @param args - The estimate parameters (recipients count, token, chain).
   * @returns A JSON string with the gateway cost estimate.
   */
  @CreateAction({
    name: "spraay_estimate_batch",
    description: `
Estimate the cost of a batch payment via the free Spraay gateway endpoint (GET ${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_FREE_ESTIMATE_BATCH_PATH}?recipients=<count>&chain=<chain>&amount=<total>). No payment and no transaction signing required.
Returns rough per-chain gas and protocol-fee estimates (protocol fee requires the optional total amount). Use this to preview costs for a batch of a given size before executing on-chain or via the gateway; for a live quote use the paid POST ${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_GATEWAY_BATCH_ESTIMATE_PATH}.
    `.trim(),
    schema: SpraayEstimateBatchSchema,
  })
  async estimateBatch(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof SpraayEstimateBatchSchema>,
  ): Promise<string> {
    try {
      const url = new URL(`${this.config.gatewayBaseUrl}${SPRAAY_FREE_ESTIMATE_BATCH_PATH}`);
      url.searchParams.set("recipients", String(args.recipients));
      url.searchParams.set("chain", args.chain);
      if (args.amount) {
        url.searchParams.set("amount", args.amount);
      }

      const response = await fetch(url.toString());
      const data = await this.parseResponseData(response);

      if (!response.ok) {
        return JSON.stringify(
          {
            error: true,
            message: `Spraay gateway estimate request failed with status ${response.status}`,
            data,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          endpoint: SPRAAY_FREE_ESTIMATE_BATCH_PATH,
          estimate: data,
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: true,
          message: "Failed to reach the Spraay gateway for batch estimation",
          details: error instanceof Error ? error.message : String(error),
          note: "Estimation is an optional pre-flight step; the direct on-chain batch actions remain available.",
        },
        null,
        2,
      );
    }
  }

  /**
   * Execute a batch payment through the x402-metered Spraay gateway.
   *
   * @param walletProvider - The wallet provider used to sign the x402 payment.
   * @param args - The batch to execute (token, recipients, chain).
   * @returns A JSON string with the gateway execution result and payment details.
   */
  @CreateAction({
    name: "spraay_execute_batch_gateway",
    description: `
Execute a batch payment through the x402-metered Spraay gateway (POST ${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_GATEWAY_BATCH_EXECUTE_PATH}). This is a PAID endpoint: pricing is returned via an x402 402 Payment Required challenge and settled in USDC before execution. A live quote is available the same way from POST ${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_GATEWAY_BATCH_ESTIMATE_PATH}.
Tradeoff vs the direct on-chain actions (spraay_eth / spraay_token / spraay_eth_variable / spraay_token_variable): direct on-chain means the agent signs the batch transaction and pays gas itself on Base; gateway execution is x402-metered and multi-chain capable — the gateway handles submission and the agent pays a metered USDC fee instead of managing gas.
Payments respect the provider's maxGatewayPaymentUsdc limit. Use spraay_validate_batch (free) first to catch malformed batches.
    `.trim(),
    schema: SpraayExecuteBatchGatewaySchema,
  })
  async executeBatchGateway(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SpraayExecuteBatchGatewaySchema>,
  ): Promise<string> {
    return this.requestWithX402(
      walletProvider,
      SPRAAY_GATEWAY_BATCH_EXECUTE_PATH,
      this.buildExecuteBody(args.token, args.recipients, walletProvider.getAddress()),
    );
  }

  /**
   * Create an escrow through the x402-metered Spraay gateway.
   *
   * @param walletProvider - The wallet provider used to sign the x402 payment.
   * @param args - The escrow parameters (token, amount, beneficiary, depositor, arbiter, description, conditions, expiresIn).
   * @returns A JSON string with the gateway escrow creation result and payment details.
   */
  @CreateAction({
    name: "spraay_create_escrow",
    description: `
Create an escrow through the x402-metered Spraay gateway (POST ${SPRAAY_GATEWAY_BASE_URL}${SPRAAY_GATEWAY_ESCROW_CREATE_PATH}). This is a PAID endpoint: pricing is returned via an x402 402 Payment Required challenge and settled in USDC.
Escrow complements Spraay batch payments: lock funds for a beneficiary (with an optional arbiter, release conditions, and expiry in hours), then release or refund later. The depositor defaults to the connected wallet and must differ from the beneficiary.
This action covers creation only — the gateway's POST /api/v1/escrow/fund, /release, and /cancel endpoints handle the rest of the lifecycle (see ${SPRAAY_GATEWAY_BASE_URL}).
Payments respect the provider's maxGatewayPaymentUsdc limit.
    `.trim(),
    schema: SpraayCreateEscrowSchema,
  })
  async createEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SpraayCreateEscrowSchema>,
  ): Promise<string> {
    const depositor = args.depositor ?? walletProvider.getAddress();

    // The gateway rejects depositor === beneficiary, but only after the x402
    // payment has settled — catch it locally before paying anything.
    if (depositor.toLowerCase() === args.beneficiary.toLowerCase()) {
      return JSON.stringify(
        {
          error: true,
          message: "Depositor and beneficiary cannot be the same address",
          details: "No payment was made.",
        },
        null,
        2,
      );
    }

    return this.requestWithX402(walletProvider, SPRAAY_GATEWAY_ESCROW_CREATE_PATH, {
      depositor,
      beneficiary: args.beneficiary,
      token: args.token,
      amount: args.amount,
      ...(args.arbiter ? { arbiter: args.arbiter } : {}),
      ...(args.description ? { description: args.description } : {}),
      ...(args.conditions?.length ? { conditions: args.conditions } : {}),
      ...(args.expiresIn ? { expiresIn: args.expiresIn } : {}),
    });
  }

  /**
   * Spraay's batch contract is currently deployed only on Base mainnet.
   *
   * @param network - The network to check support for.
   * @returns True if the network is supported.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.networkId === "base-mainnet";

  /**
   * Builds the request body for the free BPA 1.0 validation endpoint.
   * The gateway's validator expects entries keyed as {to, amount} inside a
   * "recipients" array (not "payments"), plus chain and token (symbol or
   * contract address).
   *
   * @param chain - Target chain identifier.
   * @param token - Token symbol or contract address.
   * @param recipients - Batch entries as (recipient, amount) pairs.
   * @returns The validation request body.
   */
  private buildValidateBody(chain: string, token: string, recipients: BatchEntry[]) {
    return {
      bpa_version: SPRAAY_BPA_VERSION,
      chain,
      token,
      recipients: recipients.map(entry => ({
        to: entry.recipient,
        amount: entry.amount,
      })),
    };
  }

  /**
   * Builds the request body for the paid batch execution endpoint.
   * The gateway's execute handler expects entries keyed as {address, amount}
   * (human-decimal amounts) plus token (symbol or contract address, default
   * USDC) and an optional sender used for approval encoding.
   *
   * @param token - Token symbol or contract address.
   * @param recipients - Batch entries as (recipient, amount) pairs.
   * @param sender - The sending wallet address.
   * @returns The execution request body.
   */
  private buildExecuteBody(token: string, recipients: BatchEntry[], sender: string) {
    return {
      token,
      recipients: recipients.map(entry => ({
        address: entry.recipient,
        amount: entry.amount,
      })),
      sender,
    };
  }

  /**
   * Runs the free gateway pre-flight validation for an on-chain batch.
   * Gateway unavailability never blocks the on-chain path; an explicit
   * "valid: false" verdict does.
   *
   * @param token - Token symbol for the batch.
   * @param entries - Batch entries as (recipient, amount) pairs.
   * @returns Whether to proceed, plus a report to surface in the action result.
   */
  private async runPreflight(token: string, entries: BatchEntry[]): Promise<PreflightResult> {
    try {
      const response = await fetch(
        `${this.config.gatewayBaseUrl}${SPRAAY_FREE_VALIDATE_BATCH_PATH}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.buildValidateBody("base", token, entries)),
        },
      );

      if (!response.ok) {
        return {
          proceed: true,
          report: `Pre-flight validation skipped: gateway responded with status ${response.status}.`,
        };
      }

      const data = (await this.parseResponseData(response)) as Record<string, unknown>;
      const report = `Pre-flight validation: ${JSON.stringify(data)}`;

      if (data && typeof data === "object" && data.valid === false) {
        return { proceed: false, report };
      }

      return { proceed: true, report };
    } catch (error) {
      return {
        proceed: true,
        report: `Pre-flight validation skipped: gateway unreachable (${
          error instanceof Error ? error.message : String(error)
        }).`,
      };
    }
  }

  /**
   * Formats a successful spray result into the human-readable multi-line shape
   * shared by all on-chain actions.
   *
   * @param params - The result fields.
   * @param params.headline - First line describing the outcome.
   * @param params.allowanceResult - Optional allowance message (permit/approve).
   * @param params.subtotal - Total amount sent, excluding fee.
   * @param params.fee - Protocol fee amount.
   * @param params.feeBps - Protocol fee in basis points.
   * @param params.decimals - Token decimals for formatting.
   * @param params.symbol - Token symbol for formatting.
   * @param params.txHash - The spray transaction hash.
   * @param params.blockNumber - The block the transaction was mined in.
   * @param params.preflightReport - Optional pre-flight report to surface.
   * @returns The formatted result string.
   */
  private formatSprayResult(params: {
    headline: string;
    allowanceResult?: string | null;
    subtotal: bigint;
    fee: bigint;
    feeBps: number;
    decimals: number;
    symbol: string;
    txHash: string;
    blockNumber: unknown;
    preflightReport?: string | null;
  }): string {
    const lines: string[] = [];
    if (params.preflightReport) {
      lines.push(params.preflightReport);
    }
    if (params.allowanceResult) {
      lines.push(params.allowanceResult);
    }
    lines.push(
      params.headline,
      `Total sent: ${formatUnits(params.subtotal, params.decimals)} ${params.symbol}`,
      `Protocol fee (${params.feeBps / 100}%): ${formatUnits(params.fee, params.decimals)} ${params.symbol}`,
      `Transaction hash: ${params.txHash}`,
      `Block: ${params.blockNumber}`,
      `View on BaseScan: https://basescan.org/tx/${params.txHash}`,
    );
    return lines.join("\n");
  }

  /**
   * Reads the live protocol fee from the contract, falling back to the
   * default constant if the read fails.
   *
   * @param walletProvider - The wallet provider to read with.
   * @returns The protocol fee in basis points.
   */
  private async getFeeBps(walletProvider: EvmWalletProvider): Promise<number> {
    try {
      const result = await walletProvider.readContract({
        address: SPRAAY_CONTRACT_ADDRESS,
        abi: SPRAAY_ABI,
        functionName: "feeBps",
      });
      return Number(result);
    } catch {
      return SPRAAY_PROTOCOL_FEE_BPS;
    }
  }

  /**
   * Ensures the Spraay contract has a sufficient token allowance, preferring
   * an EIP-2612 permit (exact value, deadline-bounded) when the token
   * supports it, and falling back to a standard approve otherwise.
   *
   * @param walletProvider - The wallet provider to sign and send with.
   * @param tokenAddress - The ERC-20 token contract address.
   * @param requiredAmount - The allowance required, in atomic units.
   * @returns A message describing what was done, or null if no action was needed.
   */
  private async ensureTokenAllowance(
    walletProvider: EvmWalletProvider,
    tokenAddress: string,
    requiredAmount: bigint,
  ): Promise<string | null> {
    const walletAddress = walletProvider.getAddress() as `0x${string}`;

    const currentAllowance = (await walletProvider.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [walletAddress, SPRAAY_CONTRACT_ADDRESS],
    })) as bigint;

    if (BigInt(currentAllowance) >= requiredAmount) {
      return null;
    }

    const permitResult = await this.tryPermit(walletProvider, tokenAddress, requiredAmount);
    if (permitResult) {
      return permitResult;
    }

    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [SPRAAY_CONTRACT_ADDRESS, requiredAmount],
    });

    const approveTxHash = await walletProvider.sendTransaction({
      to: tokenAddress as `0x${string}`,
      data: approveData,
    });

    await walletProvider.waitForTransactionReceipt(approveTxHash);

    return `Token approval granted to Spraay contract (token does not support EIP-2612 permit). Approval tx: ${approveTxHash}`;
  }

  /**
   * Attempts to grant the allowance via an EIP-2612 permit. Support is
   * detected at runtime (nonces/name reads) rather than from a hardcoded
   * token list. Returns null when the token does not support permit or any
   * step fails, so the caller can fall back to approve.
   *
   * @param walletProvider - The wallet provider to sign and send with.
   * @param tokenAddress - The ERC-20 token contract address.
   * @param requiredAmount - The allowance value to permit, in atomic units.
   * @returns A message describing the permit, or null to signal fallback.
   */
  private async tryPermit(
    walletProvider: EvmWalletProvider,
    tokenAddress: string,
    requiredAmount: bigint,
  ): Promise<string | null> {
    try {
      const owner = walletProvider.getAddress() as `0x${string}`;

      // Detect permit support: EIP-2612 tokens expose nonces(owner).
      const nonce = (await walletProvider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "nonces",
        args: [owner],
      })) as bigint;

      const name = (await walletProvider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "name",
      })) as string;

      // EIP-2612 domain version: USDC on Base reports "2"; default to "1".
      let version = "1";
      try {
        version = (await walletProvider.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "version",
        })) as string;
      } catch {
        // Tokens without version() use "1" per the EIP-2612 reference implementation.
      }

      const chainId = Number(walletProvider.getNetwork().chainId ?? 8453);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + PERMIT_DEADLINE_SECONDS);

      const signature = await walletProvider.signTypedData({
        domain: {
          name,
          version,
          chainId,
          verifyingContract: tokenAddress as `0x${string}`,
        },
        types: EIP2612_PERMIT_TYPES,
        primaryType: "Permit",
        message: {
          owner,
          spender: SPRAAY_CONTRACT_ADDRESS,
          value: requiredAmount,
          nonce: BigInt(nonce),
          deadline,
        },
      });

      const { r, s, v } = this.splitSignature(signature);

      const permitData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "permit",
        args: [owner, SPRAAY_CONTRACT_ADDRESS, requiredAmount, deadline, v, r, s],
      });

      const permitTxHash = await walletProvider.sendTransaction({
        to: tokenAddress as `0x${string}`,
        data: permitData,
      });

      await walletProvider.waitForTransactionReceipt(permitTxHash);

      // Verify the permit took effect (e.g. smart-wallet ERC-1271 signatures
      // do not pass permit's ecrecover); otherwise fall back to approve.
      const allowanceAfter = (await walletProvider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, SPRAAY_CONTRACT_ADDRESS],
      })) as bigint;
      if (BigInt(allowanceAfter) < requiredAmount) {
        return null;
      }

      return `Token allowance granted via EIP-2612 permit (exact value, ${PERMIT_DEADLINE_SECONDS / 60}-minute deadline, no standing unlimited approval). Permit tx: ${permitTxHash}`;
    } catch {
      // Token does not support EIP-2612 permit (or signing failed) — fall back to approve.
      return null;
    }
  }

  /**
   * Splits a 65-byte hex signature into its r, s, v components.
   *
   * @param signature - The 0x-prefixed 65-byte signature.
   * @returns The r, s, and v components.
   */
  private splitSignature(signature: `0x${string}`): {
    r: `0x${string}`;
    s: `0x${string}`;
    v: number;
  } {
    const r = signature.slice(0, 66) as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
    let v = parseInt(signature.slice(130, 132), 16);
    if (v < 27) {
      v += 27;
    }
    return { r, s, v };
  }

  /**
   * Makes a request to an x402-metered Spraay gateway endpoint. The first
   * request is unpaid; on a 402 challenge the payment is validated against
   * the configured limit and settled either with a pre-funded payment header
   * or by signing with the wallet provider via the x402 client. Payment is
   * never faked or stubbed.
   *
   * @param walletProvider - The wallet provider used to sign the x402 payment.
   * @param path - The gateway endpoint path.
   * @param body - The JSON request body.
   * @returns A JSON string with the result and payment details.
   */
  private async requestWithX402(
    walletProvider: EvmWalletProvider,
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const url = `${this.config.gatewayBaseUrl}${path}`;

    try {
      const initialResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (initialResponse.status !== 402) {
        const data = await this.parseResponseData(initialResponse);
        return JSON.stringify(
          {
            success: initialResponse.ok,
            url,
            status: initialResponse.status,
            data,
          },
          null,
          2,
        );
      }

      // Parse the 402 challenge: v2 sends requirements in the PAYMENT-REQUIRED
      // header; v1 sends them in the body.
      let acceptsArray: Array<{
        network?: string;
        asset?: string;
        maxAmountRequired?: string;
        amount?: string;
        price?: string;
      }> = [];

      const paymentRequiredHeader = initialResponse.headers.get("payment-required");
      if (paymentRequiredHeader) {
        try {
          const decoded = JSON.parse(atob(paymentRequiredHeader));
          acceptsArray = decoded.accepts ?? [];
        } catch {
          // Header parsing failed, fall back to body
        }
      }
      if (acceptsArray.length === 0) {
        try {
          const challengeBody = (await initialResponse.json()) as { accepts?: typeof acceptsArray };
          acceptsArray = challengeBody.accepts ?? [];
        } catch {
          // No parseable challenge body
        }
      }

      // Enforce the configured payment limit against the cheapest quoted option.
      const quotedAmounts = acceptsArray
        .map(option => option.maxAmountRequired ?? option.amount ?? option.price)
        .filter((amount): amount is string => Boolean(amount));

      if (quotedAmounts.length > 0) {
        const cheapest = quotedAmounts.reduce((min, amount) =>
          BigInt(amount) < BigInt(min) ? amount : min,
        );
        const paymentValidation = validatePaymentLimit(cheapest, this.config.maxGatewayPaymentUsdc);
        if (!paymentValidation.isValid) {
          return JSON.stringify(
            {
              error: true,
              message: "Gateway payment exceeds limit",
              details: `The Spraay gateway quoted ${paymentValidation.requestedAmount} USDC, which exceeds the maximum gateway payment limit of ${paymentValidation.maxAmount} USDC. No payment was made.`,
              maxGatewayPaymentUsdc: this.config.maxGatewayPaymentUsdc,
              acceptablePaymentOptions: acceptsArray,
            },
            null,
            2,
          );
        }
      }

      // Settle the payment: pre-funded header if configured, otherwise sign
      // with the wallet provider via the x402 client.
      let paidResponse: Response;
      if (this.config.x402PaymentHeader) {
        // The gateway's x402 v2 middleware reads Payment-Signature, with
        // X-PAYMENT kept as the v1 fallback.
        paidResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Payment-Signature": this.config.x402PaymentHeader,
            "X-PAYMENT": this.config.x402PaymentHeader,
          },
          body: JSON.stringify(body),
        });
      } else {
        const client = new x402Client();
        const account = walletProvider.toSigner();
        const signer = {
          ...account,
          readContract: (readArgs: {
            address: `0x${string}`;
            abi: readonly unknown[];
            functionName: string;
            args?: readonly unknown[];
          }) =>
            walletProvider.readContract({
              address: readArgs.address,
              abi: readArgs.abi as never,
              functionName: readArgs.functionName as never,
              args: readArgs.args as never,
            }),
        };
        registerExactEvmScheme(client, { signer });
        const fetchWithPayment = wrapFetchWithPayment(fetch, client);

        paidResponse = await fetchWithPayment(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await this.parseResponseData(paidResponse);

      const paymentResponseHeader =
        paidResponse.headers.get("payment-response") ??
        paidResponse.headers.get("x-payment-response");

      let paymentProof: Record<string, unknown> | null = null;
      if (paymentResponseHeader) {
        try {
          paymentProof = JSON.parse(atob(paymentResponseHeader));
        } catch {
          paymentProof = { raw: paymentResponseHeader };
        }
      }

      if (paidResponse.status !== 200) {
        return JSON.stringify(
          {
            error: true,
            message: `Gateway request failed with status ${paidResponse.status}. Payment was not settled.`,
            url,
            status: paidResponse.status,
            data,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          message: "Gateway request completed with x402 payment",
          url,
          status: paidResponse.status,
          data,
          paymentProof,
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: true,
          message: `Error calling the Spraay gateway at ${url}`,
          details: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      );
    }
  }

  /**
   * Parses response data based on content type.
   *
   * @param response - The fetch Response object.
   * @returns Parsed response data.
   */
  private async parseResponseData(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }
    return response.text();
  }

  /**
   * Gets the number of decimals for an ERC-20 token.
   *
   * @param walletProvider - The wallet provider to read with.
   * @param tokenAddress - The ERC-20 token contract address.
   * @returns The token decimals, defaulting to 18 on failure.
   */
  private async getTokenDecimals(
    walletProvider: EvmWalletProvider,
    tokenAddress: string,
  ): Promise<number> {
    try {
      const result = await walletProvider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "decimals",
      });
      return Number(result);
    } catch {
      return 18;
    }
  }

  /**
   * Gets the symbol for an ERC-20 token.
   *
   * @param walletProvider - The wallet provider to read with.
   * @param tokenAddress - The ERC-20 token contract address.
   * @returns The token symbol, defaulting to "TOKEN" on failure.
   */
  private async getTokenSymbol(
    walletProvider: EvmWalletProvider,
    tokenAddress: string,
  ): Promise<string> {
    try {
      const result = await walletProvider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "symbol",
      });
      return result as string;
    } catch {
      return "TOKEN";
    }
  }
}

/**
 * Factory function to create a new SpraayActionProvider instance.
 *
 * @param config - Optional configuration for gateway payment limits and endpoints.
 * @returns A new SpraayActionProvider.
 *
 * @example
 * ```typescript
 * import { spraayActionProvider } from "@coinbase/agentkit";
 *
 * const agentKit = await AgentKit.from({
 *   walletProvider,
 *   actionProviders: [spraayActionProvider({ maxGatewayPaymentUsdc: 0.5 })],
 * });
 * ```
 */
export const spraayActionProvider = (config?: SpraayActionProviderConfig) =>
  new SpraayActionProvider(config);
