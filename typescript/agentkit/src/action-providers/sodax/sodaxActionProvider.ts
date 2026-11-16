import { z } from "zod";
import { formatUnits, Hex, parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  DEFAULT_DEADLINE_OFFSET_SECONDS,
  DEFAULT_SLIPPAGE_BPS,
  SODAX_ANY_SOLVER,
  SODAX_EVM_CHAIN_KEYS,
  SODAX_EVM_CHAIN_KEY_SET,
  SODAX_SWAPS_API_URL,
} from "./constants";
import {
  SodaxGetQuoteSchema,
  SodaxGetSupportedTokensSchema,
  SodaxGetSwapStatusSchema,
  SodaxSwapSchema,
} from "./schemas";
import {
  SodaxApproveResponse,
  SodaxCreateIntentRequest,
  SodaxCreateIntentResponse,
  SodaxEvmTx,
  SodaxQuoteRequest,
  SodaxQuoteResponse,
  SodaxSubmitTxStatusResponse,
  SodaxToken,
  SodaxTokensByChain,
} from "./types";
import {
  applySlippage,
  assertApprovalTx,
  assertTxFromWallet,
  findToken,
  isNativeToken,
  sodaxRequest,
  SodaxRequestOptions,
  txValue,
} from "./utils";

/**
 * Configuration options for the SodaxActionProvider.
 */
export interface SodaxActionProviderConfig {
  /**
   * SODAX partner API key from https://portal.sodax.com, sent as the `x-api-key` header.
   * Defaults to the SODAX_API_KEY environment variable. The public API currently accepts
   * requests without a key.
   */
  apiKey?: string;

  /**
   * Base URL of the SODAX Swaps API. Defaults to https://api.sodax.com/v1/swaps.
   */
  baseUrl?: string;
}

/**
 * SodaxActionProvider provides actions for intent-based cross-network swaps through SODAX.
 *
 * Swaps start on the EVM network the wallet is connected to and can settle on any network
 * SODAX supports, including non-EVM networks such as Solana.
 */
export class SodaxActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly #options: SodaxRequestOptions;

  /**
   * Constructor for the SodaxActionProvider.
   *
   * @param config - The configuration options for the SodaxActionProvider.
   */
  constructor(config: SodaxActionProviderConfig = {}) {
    super("sodax", []);
    this.#options = {
      baseUrl: (config.baseUrl ?? SODAX_SWAPS_API_URL).replace(/\/+$/, ""),
      apiKey: config.apiKey ?? process.env.SODAX_API_KEY,
    };
  }

  /**
   * Lists the tokens SODAX can swap on a network.
   *
   * @param walletProvider - The wallet provider, used to default to the current network.
   * @param args - The input arguments for the action.
   * @returns A JSON list of supported tokens.
   */
  @CreateAction({
    name: "get_supported_tokens",
    description: `
This tool lists the tokens that can be swapped through SODAX, with their symbol, address and decimals.

It takes the following input:
- chainKey: (Optional) SODAX chain key of the network to list, e.g. '0x2105.base', '0xa4b1.arbitrum', 'solana', 'sonic'.
  Use 'all' to list every supported network. Defaults to the wallet's current network.

Use this tool to find token addresses before quoting or swapping, and to discover destination networks.
Never assume a token has the same address on two networks.
`,
    schema: SodaxGetSupportedTokensSchema,
  })
  async getSupportedTokens(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SodaxGetSupportedTokensSchema>,
  ): Promise<string> {
    try {
      if (args.chainKey?.toLowerCase() === "all") {
        const byChain = await sodaxRequest<SodaxTokensByChain>(this.#options, "/tokens");
        const summary = Object.fromEntries(
          Object.entries(byChain).map(([chainKey, tokens]) => [
            chainKey,
            tokens.map(token => ({
              symbol: token.symbol,
              address: token.address,
              decimals: token.decimals,
            })),
          ]),
        );
        return JSON.stringify({ chains: Object.keys(byChain), tokens: summary }, null, 2);
      }

      const chainKey = args.chainKey ?? (await this.getSourceChainKey(walletProvider));
      const tokens = await this.getTokens(chainKey);
      return JSON.stringify(
        {
          chainKey,
          tokens: tokens.map(token => ({
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            decimals: token.decimals,
          })),
        },
        null,
        2,
      );
    } catch (error) {
      return `Error fetching SODAX supported tokens: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Gets a SODAX quote for swapping a token on the current network.
   *
   * @param walletProvider - The wallet provider, used to determine the source network.
   * @param args - The input arguments for the action.
   * @returns A message containing the quote.
   */
  @CreateAction({
    name: "get_quote",
    description: `
This tool gets a quote for a SODAX swap from the wallet's current network to the same or another network.
SODAX supports cross-network swaps, e.g. USDC on Base to USDC on Solana or Arbitrum.

It takes the following inputs:
- inputToken: Symbol or address of the token to sell on the current network (use 0x0000000000000000000000000000000000000000 or e.g. 'ETH' for the native asset)
- outputToken: Symbol or address of the token to receive on the destination network
- destinationChainKey: (Optional) SODAX chain key of the destination network, e.g. 'solana', '0xa4b1.arbitrum', 'sonic'. Defaults to the current network
- amount: Amount of the input token in whole units, e.g. '10' for 10 USDC

Important notes:
- This action is read-only and does not send any transaction
- Use get_supported_tokens to look up token addresses on the destination network
- The quote is the expected output before slippage; the swap sets a minimum output from it
`,
    schema: SodaxGetQuoteSchema,
  })
  async getQuote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SodaxGetQuoteSchema>,
  ): Promise<string> {
    try {
      const srcChainKey = await this.getSourceChainKey(walletProvider);
      const dstChainKey = args.destinationChainKey ?? srcChainKey;
      const { inputToken, outputToken } = await this.resolveTokens(
        srcChainKey,
        dstChainKey,
        args.inputToken,
        args.outputToken,
      );
      const inputAmount = parseUnits(args.amount, inputToken.decimals);
      const quotedAmount = await this.fetchQuote(
        srcChainKey,
        dstChainKey,
        inputToken,
        outputToken,
        inputAmount,
      );

      return [
        `SODAX quote for ${args.amount} ${inputToken.symbol} on ${srcChainKey} -> ${outputToken.symbol} on ${dstChainKey}:`,
        ` - Expected output: ${formatUnits(quotedAmount, outputToken.decimals)} ${outputToken.symbol}`,
        ` - Input token: ${inputToken.address}`,
        ` - Output token: ${outputToken.address}`,
        ` - Input amount (base units): ${inputAmount}`,
        ` - Quoted amount (base units): ${quotedAmount}`,
      ].join("\n");
    } catch (error) {
      return `Error getting SODAX quote: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Swaps a token on the current network through SODAX.
   *
   * @param walletProvider - The wallet provider that signs and sends the transactions.
   * @param args - The input arguments for the action.
   * @returns A message containing the swap details.
   */
  @CreateAction({
    name: "swap",
    description: `
This tool swaps tokens through SODAX, from the wallet's current network to the same or another network
(e.g. USDC on Base to SOL on Solana). It creates a swap intent onchain, which a solver then fills on the destination network.

It takes the following inputs:
- inputToken: Symbol or address of the token to sell on the current network (use 0x0000000000000000000000000000000000000000 or e.g. 'ETH' for the native asset)
- outputToken: Symbol or address of the token to receive on the destination network
- destinationChainKey: (Optional) SODAX chain key of the destination network, e.g. 'solana', '0xa4b1.arbitrum'. Defaults to the current network
- amount: Amount of the input token in whole units, e.g. '10' for 10 USDC
- destinationAddress: (Optional) Recipient on the destination network. Required for non-EVM destinations such as Solana; defaults to the wallet address for EVM destinations
- slippageBps: (Optional) Maximum slippage in basis points, where 100 = 1%. Defaults to 100

Important notes:
- Get a quote first, show it to the user and ask whether to proceed before swapping
- The swap may send an ERC20 approval transaction before the swap transaction
- The wallet pays gas on the current network
- Settlement on the destination network is asynchronous: use get_swap_status with the returned transaction hash to follow it
`,
    schema: SodaxSwapSchema,
  })
  async swap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SodaxSwapSchema>,
  ): Promise<string> {
    try {
      const srcChainKey = await this.getSourceChainKey(walletProvider);
      const dstChainKey = args.destinationChainKey ?? srcChainKey;
      const walletAddress = walletProvider.getAddress();

      const dstAddress =
        args.destinationAddress ??
        (SODAX_EVM_CHAIN_KEY_SET.has(dstChainKey) ? walletAddress : undefined);
      if (!dstAddress) {
        return `Error executing SODAX swap: destinationAddress is required when swapping to ${dstChainKey}, because it is not an EVM network`;
      }

      const { inputToken, outputToken } = await this.resolveTokens(
        srcChainKey,
        dstChainKey,
        args.inputToken,
        args.outputToken,
      );
      const inputAmount = parseUnits(args.amount, inputToken.decimals);
      if (inputAmount <= 0n) {
        return "Error executing SODAX swap: amount must be greater than zero";
      }

      const quotedAmount = await this.fetchQuote(
        srcChainKey,
        dstChainKey,
        inputToken,
        outputToken,
        inputAmount,
      );
      // Callers that skip schema parsing can pass null, so resolve the default here too.
      const slippageBps = args.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const minOutputAmount = applySlippage(quotedAmount, slippageBps);
      if (minOutputAmount <= 0n) {
        return `Error executing SODAX swap: the quoted output for ${args.amount} ${inputToken.symbol} is too small`;
      }

      const { deadline } = await sodaxRequest<{ deadline: string | number }>(
        this.#options,
        `/deadline?offsetSeconds=${DEFAULT_DEADLINE_OFFSET_SECONDS}`,
      );

      const intentRequest: SodaxCreateIntentRequest = {
        srcChainKey,
        dstChainKey,
        inputToken: inputToken.address,
        outputToken: outputToken.address,
        inputAmount: inputAmount.toString(),
        minOutputAmount: minOutputAmount.toString(),
        deadline: String(deadline),
        allowPartialFill: false,
        srcAddress: walletAddress,
        dstAddress,
        solver: SODAX_ANY_SOLVER,
        data: "0x",
      };

      // Build the swap transaction first so the approval can be checked against its target.
      const created = await this.createIntent(intentRequest, walletAddress);
      const expectedValue = isNativeToken(inputToken) ? inputAmount : 0n;
      if (txValue(created.tx) !== expectedValue) {
        throw new Error(
          `SODAX swap transaction value ${txValue(created.tx)} does not match the expected ${expectedValue}`,
        );
      }

      if (!isNativeToken(inputToken)) {
        const allowance = await sodaxRequest<{ valid: boolean }>(
          this.#options,
          "/allowance/check",
          intentRequest,
        );
        if (!allowance.valid) {
          const approval = await sodaxRequest<SodaxApproveResponse>(
            this.#options,
            "/approve",
            intentRequest,
          );
          for (const [label, tx, amount] of [
            ["allowance reset", approval.resetTx, 0n],
            ["approval", approval.tx, inputAmount],
          ] as const) {
            if (!tx) continue;
            assertTxFromWallet(tx, walletAddress, label);
            assertApprovalTx(tx, inputToken.address, created.tx.to, amount);
            const { hash, success } = await this.sendAndWait(walletProvider, tx);
            if (!success) {
              return `Error executing SODAX swap: the ${label} transaction ${hash} failed`;
            }
          }
        }
      }

      const { hash: txHash, success } = await this.sendAndWait(walletProvider, created.tx);
      if (!success) {
        return `Error executing SODAX swap: the swap transaction ${txHash} reverted`;
      }

      await sodaxRequest(this.#options, "/submit-tx", {
        txHash,
        srcChainKey,
        walletAddress,
        intent: created.intent,
        relayData: created.relayData.payload,
      });

      return [
        `Submitted SODAX swap of ${args.amount} ${inputToken.symbol} on ${srcChainKey} for ${outputToken.symbol} on ${dstChainKey}.`,
        ` - Transaction hash: ${txHash}`,
        ` - Expected output: ${formatUnits(quotedAmount, outputToken.decimals)} ${outputToken.symbol}`,
        ` - Minimum output: ${formatUnits(minOutputAmount, outputToken.decimals)} ${outputToken.symbol}`,
        ` - Recipient: ${dstAddress}`,
        `A solver fills the intent on ${dstChainKey} asynchronously.`,
        `Use get_swap_status with txHash ${txHash} and sourceChainKey ${srcChainKey} to follow it.`,
      ].join("\n");
    } catch (error) {
      return `Error executing SODAX swap: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Gets the status of a SODAX swap.
   *
   * @param walletProvider - The wallet provider, used to default to the current network.
   * @param args - The input arguments for the action.
   * @returns A message containing the swap status.
   */
  @CreateAction({
    name: "get_swap_status",
    description: `
This tool checks the status of a SODAX swap created with the swap action.

It takes the following inputs:
- txHash: Hash of the source-network transaction returned by the swap action
- sourceChainKey: (Optional) SODAX chain key of the network the swap was created on. Defaults to the current network

Statuses: pending, relaying, relayed, posting_execution and posted_execution mean the swap is still in progress;
solved means a solver filled it on the destination network; failed means it did not complete and the user message explains why.
`,
    schema: SodaxGetSwapStatusSchema,
  })
  async getSwapStatus(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SodaxGetSwapStatusSchema>,
  ): Promise<string> {
    try {
      const srcChainKey = args.sourceChainKey ?? (await this.getSourceChainKey(walletProvider));
      const response = await sodaxRequest<SodaxSubmitTxStatusResponse>(
        this.#options,
        `/submit-tx/status?txHash=${encodeURIComponent(args.txHash)}&srcChainKey=${encodeURIComponent(srcChainKey)}`,
      );
      const data = response.data ?? {};
      const status = data.status ?? "unknown";
      const lines = [`SODAX swap ${args.txHash} on ${srcChainKey}: ${status}`];

      if (status === "solved") {
        lines.push("The swap was filled on the destination network.");
      } else if (status === "failed") {
        lines.push(
          `The swap failed: ${data.userMessage ?? data.failureReason ?? "no reason given"}`,
        );
        if (data.intentCancelled !== true) {
          lines.push("The intent may still be open; it can be cancelled to recover the funds.");
        }
      } else {
        lines.push("The swap is still in progress. Check again in a few seconds.");
      }
      if (data.result?.dstIntentTxHash) {
        lines.push(` - Hub intent transaction: ${data.result.dstIntentTxHash}`);
      }
      if (data.result?.fillTxHash) {
        lines.push(` - Fill transaction: ${data.result.fillTxHash}`);
      }
      return lines.join("\n");
    } catch (error) {
      return `Error getting SODAX swap status: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if SODAX supports swaps from the network.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    network.chainId !== undefined &&
    SODAX_EVM_CHAIN_KEYS[Number(network.chainId)] !== undefined;

  /**
   * Gets the SODAX chain key of the wallet's current network.
   *
   * @param walletProvider - The wallet provider.
   * @returns The SODAX chain key.
   */
  private async getSourceChainKey(walletProvider: EvmWalletProvider): Promise<string> {
    const { chainId } = walletProvider.getNetwork();
    const chainKey = chainId ? SODAX_EVM_CHAIN_KEYS[Number(chainId)] : undefined;
    if (!chainKey) {
      throw new Error(`SODAX does not support swaps from chain ID ${chainId}`);
    }
    return chainKey;
  }

  /**
   * Gets the tokens SODAX supports on a network.
   *
   * @param chainKey - The SODAX chain key.
   * @returns The supported tokens.
   */
  private async getTokens(chainKey: string): Promise<SodaxToken[]> {
    const tokens = await sodaxRequest<SodaxToken[] | SodaxTokensByChain>(
      this.#options,
      `/tokens/${encodeURIComponent(chainKey)}`,
    );
    if (Array.isArray(tokens)) {
      return tokens;
    }
    return tokens[chainKey] ?? [];
  }

  /**
   * Resolves the input and output tokens of a swap.
   *
   * @param srcChainKey - SODAX chain key of the source network.
   * @param dstChainKey - SODAX chain key of the destination network.
   * @param inputQuery - Input token symbol or address.
   * @param outputQuery - Output token symbol or address.
   * @returns The resolved tokens.
   */
  private async resolveTokens(
    srcChainKey: string,
    dstChainKey: string,
    inputQuery: string,
    outputQuery: string,
  ): Promise<{ inputToken: SodaxToken; outputToken: SodaxToken }> {
    const srcTokens = await this.getTokens(srcChainKey);
    const dstTokens = dstChainKey === srcChainKey ? srcTokens : await this.getTokens(dstChainKey);
    if (dstTokens.length === 0) {
      throw new Error(
        `SODAX has no tokens on ${dstChainKey}. Use get_supported_tokens with chainKey 'all' to list valid chain keys`,
      );
    }
    return {
      inputToken: findToken(srcTokens, inputQuery, srcChainKey),
      outputToken: findToken(dstTokens, outputQuery, dstChainKey),
    };
  }

  /**
   * Fetches a quote from the SODAX API.
   *
   * @param srcChainKey - SODAX chain key of the source network.
   * @param dstChainKey - SODAX chain key of the destination network.
   * @param inputToken - The input token.
   * @param outputToken - The output token.
   * @param inputAmount - Input amount in the input token's smallest unit.
   * @returns The quoted output amount in the output token's smallest unit.
   */
  private async fetchQuote(
    srcChainKey: string,
    dstChainKey: string,
    inputToken: SodaxToken,
    outputToken: SodaxToken,
    inputAmount: bigint,
  ): Promise<bigint> {
    const request: SodaxQuoteRequest = {
      tokenSrc: inputToken.address,
      tokenSrcChainKey: srcChainKey,
      tokenDst: outputToken.address,
      tokenDstChainKey: dstChainKey,
      amount: inputAmount.toString(),
      quoteType: "exact_input",
    };
    const quote = await sodaxRequest<SodaxQuoteResponse>(this.#options, "/quote", request);
    if (!quote.quotedAmount || !/^\d+$/.test(quote.quotedAmount)) {
      throw new Error("SODAX API returned no quoted amount");
    }
    return BigInt(quote.quotedAmount);
  }

  /**
   * Builds the create-intent transaction through the SODAX API.
   *
   * @param request - The intent parameters.
   * @param walletAddress - The agent wallet address.
   * @returns The unsigned transaction, intent and relay data.
   */
  private async createIntent(
    request: SodaxCreateIntentRequest,
    walletAddress: string,
  ): Promise<SodaxCreateIntentResponse> {
    const created = await sodaxRequest<SodaxCreateIntentResponse>(
      this.#options,
      "/intents",
      request,
    );
    assertTxFromWallet(created.tx, walletAddress, "swap");
    if (!created.intent || !created.relayData?.payload) {
      throw new Error("SODAX API did not return the intent and relay data");
    }
    return created;
  }

  /**
   * Sends a transaction built by the SODAX API and waits for its receipt.
   *
   * @param walletProvider - The wallet provider.
   * @param tx - The unsigned transaction.
   * @returns The onchain transaction hash and whether it succeeded.
   */
  private async sendAndWait(
    walletProvider: EvmWalletProvider,
    tx: SodaxEvmTx,
  ): Promise<{ hash: Hex; success: boolean }> {
    const sentHash = await walletProvider.sendTransaction({
      to: tx.to as Hex,
      data: tx.data as Hex,
      value: txValue(tx),
    });
    const receipt = await walletProvider.waitForTransactionReceipt(sentHash);
    if (!receipt) {
      throw new Error(`No receipt returned for transaction ${sentHash}`);
    }
    // Smart wallets return a user operation hash; SODAX needs the onchain transaction hash.
    const hash = (receipt.transactionHash as Hex | undefined) ?? sentHash;
    // Viem receipts report "success"; CDP smart wallet user operations report "complete".
    const success = receipt.status === "success" || receipt.status === "complete";
    return { hash, success };
  }
}

export const sodaxActionProvider = (config?: SodaxActionProviderConfig) =>
  new SodaxActionProvider(config);
