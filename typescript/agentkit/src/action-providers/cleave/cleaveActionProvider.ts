import { z } from "zod";
import { Hex } from "viem";
import {
  CHAIN_IDS,
  callTool,
  screenGetGas,
  screenPlanSwap,
  type ChainId,
  type CleaveToolsOptions,
  type GetGasInput,
  type PlanSwapInput,
  type ToolEndpoint,
} from "@cleave-protocol/ai-sdk/core";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  CleaveBuyGasSchema,
  CleaveExecuteSwapSchema,
  CleaveFindTokenSchema,
  CleavePlanSwapSchema,
  CleaveQuoteGasSchema,
  CleaveTrackSwapSchema,
} from "./schemas";

/**
 * Configuration for the CleaveActionProvider.
 */
export interface CleaveActionProviderConfig {
  /**
   * Optional partner key. No key is needed.
   */
  apiKey?: string;

  /**
   * API origin. Defaults to https://api.cleave.fi.
   */
  baseUrl?: string;

  /**
   * Time limit for each API call in milliseconds. Defaults to 30000.
   */
  timeoutMs?: number;
}

type Body = Record<string, unknown>;

const DELEGATION_PREFIX = "0xef0100";

const SMART_WALLETS = new Set(["cdp_smart_wallet_provider", "zerodev_wallet_provider"]);

const GAS_PAY_CHAINS: readonly number[] = [1, 10, 137, 8453, 42161];

const DECIMAL = /^([0-9]+)(?:\.([0-9]+))?$/;

const CHECKS = `Before a plan is returned or sent, it is checked: every call is from the wallet on its chain; the last call goes to a contract and function on Cleave's published list that fits the route and pays the recipient where its calldata names one; any earlier call only approves the sell token to that contract for exactly what the last call pulls. For USDC and the native or wrapped native coin, the amount sold is also checked against the request.
The checks do not cover the price or the amount received. For other sell tokens they do not check the amount sold against the request, so show the user send.amount and pullsAtMost; when sellToken is another symbol, also show send.token.`;

/**
 * Turns an error into short text for the model, without URLs.
 *
 * @param error - The error.
 * @returns The text.
 */
function errorText(error: unknown): string {
  const e = error as { shortMessage?: unknown; message?: unknown } | null;
  const text =
    typeof e?.shortMessage === "string"
      ? e.shortMessage
      : typeof e?.message === "string"
        ? e.message
        : String(error);
  return text.replace(/\b(?:https?|wss?):\/\/\S+/gi, "[url]").slice(0, 300);
}

/**
 * Compares two decimal strings.
 *
 * @param value - The decimal to compare.
 * @param floor - The decimal it must reach.
 * @returns Whether value is at least floor, or null when either is not a decimal.
 */
function decimalAtLeast(value: string, floor: string): boolean | null {
  const a = DECIMAL.exec(value);
  const b = DECIMAL.exec(floor);
  if (a === null || b === null) return null;
  const scale = Math.max(a[2]?.length ?? 0, b[2]?.length ?? 0);
  const units = (m: RegExpExecArray) => BigInt(m[1] + (m[2] ?? "").padEnd(scale, "0"));
  return units(a) >= units(b);
}

/**
 * Returns a refusal in the shape the Cleave API uses.
 *
 * @param code - The refusal code.
 * @param message - What went wrong.
 * @param extra - Extra fields to add to the error.
 * @returns The refusal as a JSON string.
 */
function refusal(code: string, message: string, extra: Body = {}): string {
  return JSON.stringify({ error: { code, message, retryable: false, ...extra } });
}

/**
 * Reads the wallet's chain id when Cleave supports it.
 *
 * @param walletProvider - The wallet provider.
 * @returns The chain id, or null when Cleave does not support the chain.
 */
function walletChain(walletProvider: EvmWalletProvider): ChainId | null {
  const id = Number(walletProvider.getNetwork().chainId);
  return (CHAIN_IDS as readonly number[]).includes(id) ? (id as ChainId) : null;
}

/**
 * Builds the typed data the wallet signs, with uint fields as bigints.
 *
 * @param typedData - The typed data from a screened gas offer.
 * @returns The typed data ready for signTypedData.
 */
function signable(typedData: Body): Body {
  const types = typedData.types as Record<string, { name: string; type: string }[]>;
  const primaryType = typedData.primaryType as string;
  const message = { ...(typedData.message as Body) };
  for (const field of types[primaryType] ?? []) {
    if (/^u?int[0-9]*$/.test(field.type) && typeof message[field.name] === "string") {
      message[field.name] = BigInt(message[field.name] as string);
    }
  }
  return { ...typedData, message };
}

/**
 * CleaveActionProvider plans and executes swaps, cross-chain swaps and gas top-ups with Cleave.
 */
export class CleaveActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly #options: CleaveToolsOptions;

  /**
   * Constructor for the CleaveActionProvider.
   *
   * @param config - Optional configuration for the provider.
   */
  constructor(config: CleaveActionProviderConfig = {}) {
    super("cleave", []);
    const apiKey = config.apiKey ?? process.env.CLEAVE_API_KEY;
    this.#options = {
      ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
      ...(apiKey !== undefined && apiKey !== "" && { apiKey }),
      ...(config.timeoutMs !== undefined && { timeoutMs: config.timeoutMs }),
    };
  }

  /**
   * Finds a token by symbol or address.
   *
   * @param walletProvider - The wallet provider, used for the default chain.
   * @param args - The input arguments for the action.
   * @returns The token, or the candidates, as a JSON string.
   */
  @CreateAction({
    name: "find_token",
    description: `
This tool finds a token with Cleave by symbol or contract address on Ethereum, Arbitrum, Base, BNB Chain, Polygon or Optimism.

It takes the following inputs:
- query: A token symbol or contract address
- chainId: (Optional) The chain to search on; defaults to the wallet's chain

It returns the token's address, decimals and whether it is on Cleave's token list, with a flag when it resembles a listed token.
A symbol shared by several listed tokens returns up to ten candidates by address instead of picking one.
An unlisted token is found only by its address and comes back flagged, without a name or symbol.
Use it before plan_swap when the user names a token by symbol and the address is unknown.
`,
    schema: CleaveFindTokenSchema,
  })
  async findToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CleaveFindTokenSchema>,
  ): Promise<string> {
    const chainId = args.chainId ?? walletChain(walletProvider);
    if (chainId === null) return this.#unsupported();
    return this.#call("find_token", { chainId, query: args.query });
  }

  /**
   * Plans a swap from the wallet without sending anything.
   *
   * @param walletProvider - The wallet provider whose address and chain the plan is for.
   * @param args - The input arguments for the action.
   * @returns The checked plan as a JSON string.
   */
  @CreateAction({
    name: "plan_swap",
    description: `
This tool plans a token swap with Cleave from the wallet on its current chain: a swap on the same chain, a swap to another of Ethereum, Arbitrum, Base, BNB Chain, Polygon and Optimism, or a swap to the native coin for gas.
It sends nothing and moves no funds.

It takes the following inputs:
- sellToken: The token to sell, a listed symbol or a contract address
- buyToken: The token to receive, a listed symbol or a contract address; it must be on Cleave's token list
- amount: The amount of sellToken in whole units, such as "25.5"
- toChainId: (Optional) The chain of the token to receive; defaults to the wallet's chain
- recipient: (Optional) Who receives; defaults to the wallet. A smart contract wallet must give it for a swap to another chain
- maxSlippageBps: (Optional) The slippage limit in basis points; defaults to 50

The answer leads with blocking notices and warnings, then gives the route, what is sent and received, every third-party cost except network gas, the expected time, validUntil and the calls in signing order.
Cleave's fee is included in the price.
${CHECKS}

Important notes:
- Before execute_swap, show the user the warnings, the recipient, the amounts and the slippage, and get their confirmation
- Do not raise slippage above the default 50 bps without the user's consent
- For an ambiguous symbol, use find_token first
`,
    schema: CleavePlanSwapSchema,
  })
  async planSwap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CleavePlanSwapSchema>,
  ): Promise<string> {
    const fromChainId = walletChain(walletProvider);
    if (fromChainId === null) return this.#unsupported();
    const request = this.#planRequest(walletProvider, fromChainId, args);
    const needsRecipient = await this.#needsRecipient(walletProvider, request);
    if (needsRecipient !== null) return needsRecipient;
    try {
      const plan = screenPlanSwap(request, await callTool("plan_swap", request, this.#options));
      const { next: _next, ...shown } = plan;
      return JSON.stringify(shown);
    } catch (error) {
      return this.#unreachable(error);
    }
  }

  /**
   * Plans a swap again, checks it and sends its calls through the wallet.
   *
   * @param walletProvider - The wallet provider that signs and sends the calls.
   * @param args - The input arguments for the action.
   * @returns The sent transaction hashes and the requestId as a JSON string.
   */
  @CreateAction({
    name: "execute_swap",
    description: `
This tool executes a token swap with Cleave from the wallet on its current chain.
It takes the same inputs as plan_swap, plus:
- confirmed: Must be true
- minimumReceive: (Optional) receive.minimum from the plan_swap answer the user confirmed, in buyToken units; the swap is refused when the new plan's minimum is lower

It plans the swap again with the same inputs and runs the same checks as plan_swap.
It sends nothing when a check fails, when the plan is blocked, when it has expired or when its minimum is below minimumReceive.
Otherwise it sends the calls in order through the wallet and waits for each one, stopping at the first that fails.
It returns the hashes and the requestId; then use track_swap to follow the swap.
${CHECKS}

Important notes:
- Call it only after the user has seen the plan_swap answer and confirmed it, and only then set confirmed to true
- Pass minimumReceive from the plan the user confirmed
- If it returns outcome_unknown, a call may have been sent: track it with track_swap before any retry
- Never call it again for a swap that may still be in flight; check track_swap first, since sending again can pay twice
`,
    schema: CleaveExecuteSwapSchema,
  })
  async executeSwap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CleaveExecuteSwapSchema>,
  ): Promise<string> {
    if (args.confirmed !== true) {
      return refusal("not_confirmed", "execute_swap needs confirmed: true after the user confirms");
    }
    const fromChainId = walletChain(walletProvider);
    if (fromChainId === null) return this.#unsupported();
    const request = this.#planRequest(walletProvider, fromChainId, args);
    const needsRecipient = await this.#needsRecipient(walletProvider, request);
    if (needsRecipient !== null) return needsRecipient;
    let plan: Body;
    try {
      plan = screenPlanSwap(request, await callTool("plan_swap", request, this.#options));
    } catch (error) {
      return this.#unreachable(error);
    }
    if (plan.error !== undefined) return JSON.stringify(plan);
    const calls = Array.isArray(plan.calls) ? (plan.calls as Body[]) : [];
    if (plan.blocked !== false || calls.length === 0) {
      return refusal("blocked", "The plan is blocked; nothing was sent", { notices: plan.notices });
    }
    if (args.minimumReceive != null) {
      const minimum = (plan.receive as Body | undefined)?.minimum;
      const kept =
        typeof minimum === "string" ? decimalAtLeast(minimum, args.minimumReceive) : null;
      if (kept !== true) {
        return refusal(
          "minimum_changed",
          `The new plan's minimum receive is ${String(minimum)}, below the confirmed ${args.minimumReceive}; nothing was sent. Show the user the new plan`,
          { requestId: plan.requestId, receive: plan.receive },
        );
      }
    }
    const validUntil = typeof plan.validUntil === "number" ? plan.validUntil : 0;
    const label = SMART_WALLETS.has(walletProvider.getName()) ? "userOpHash" : "txHash";
    const sent: Body[] = [];
    const unknown = (error: unknown) =>
      refusal(
        "outcome_unknown",
        `A call may have been sent and may still be mined (${errorText(error)}). Track it with track_swap before any retry; do not execute this swap again until then`,
        { chainId: fromChainId, requestId: plan.requestId, sent },
      );
    for (const call of calls) {
      if (Date.now() / 1000 >= validUntil) {
        return refusal("plan_expired", "The plan expired before all calls were sent; plan again", {
          requestId: plan.requestId,
          sent,
        });
      }
      let hash: Hex;
      try {
        hash = await walletProvider.sendTransaction({
          to: call.to as Hex,
          data: call.data as Hex,
          value: BigInt(call.value as string),
        });
      } catch (error) {
        return unknown(error);
      }
      const entry: Body = { [label]: hash, status: "pending" };
      sent.push(entry);
      let receipt: { status?: unknown; transactionHash?: unknown } | undefined;
      try {
        receipt = await walletProvider.waitForTransactionReceipt(hash);
      } catch (error) {
        return unknown(error);
      }
      entry.status = String(receipt?.status);
      if (label === "userOpHash" && typeof receipt?.transactionHash === "string") {
        entry.txHash = receipt.transactionHash;
      }
      if (entry.status !== "success" && entry.status !== "complete") {
        return refusal(
          "transaction_failed",
          sent.length > 1
            ? "A call failed; the calls after it were not sent. The approve before it stays mined: the Cleave contract keeps an allowance for exactly the planned amount"
            : "A call failed; the calls after it were not sent",
          { chainId: fromChainId, requestId: plan.requestId, sent },
        );
      }
    }
    return JSON.stringify({
      requestId: plan.requestId,
      chainId: fromChainId,
      txHash: sent[sent.length - 1]?.txHash,
      sent,
      route: plan.route,
      send: plan.send,
      receive: plan.receive,
      fees: plan.fees,
      notices: plan.notices,
      next: "Call track_swap with chainId, txHash and requestId to follow the swap.",
    });
  }

  /**
   * Reports the status of a sent swap or gas order.
   *
   * @param _walletProvider - The wallet provider (unused).
   * @param args - The input arguments for the action.
   * @returns The status as a JSON string.
   */
  @CreateAction({
    name: "track_swap",
    description: `
This tool reports the status of a swap sent with execute_swap or a gas order placed with buy_gas.

It takes the following inputs:
- chainId and txHash: The chain and hash of the sent transaction
- requestId: The requestId from execute_swap, or for a gas order the requestId alone

It returns the state (for example pending, in flight, delivered, refund pending or refunded), what arrived against the plan and on which chain, and the next action or when to check again.
A transaction to a contract outside Cleave's published list is reported as such.
Use it when the user asks whether a swap arrived, and before any new attempt, since sending a plan that is still in flight again can pay twice.
`,
    schema: CleaveTrackSwapSchema,
  })
  async trackSwap(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof CleaveTrackSwapSchema>,
  ): Promise<string> {
    const input: Body = {};
    if (args.chainId != null) input.chainId = args.chainId;
    if (args.txHash != null) input.txHash = args.txHash;
    if (args.requestId != null) input.requestId = args.requestId;
    return this.#call("track_swap", input);
  }

  /**
   * Quotes a gas top-up paid in USDC from the wallet, without signing.
   *
   * @param walletProvider - The wallet provider that would pay.
   * @param args - The input arguments for the action.
   * @returns The checked offer as a JSON string.
   */
  @CreateAction({
    name: "quote_gas",
    description: `
This tool quotes native gas (ETH, BNB or POL) from Cleave, paid in USDC from the wallet on its current chain, which must be Ethereum, Arbitrum, Base, Optimism or Polygon.
It signs nothing and moves no funds.

It takes the following inputs:
- amount: The USDC to pay, such as "5"
- toChainId: (Optional) The chain the native coin is delivered on; defaults to the wallet's chain
- recipient: (Optional) Who receives the native coin; defaults to the wallet
- refundTo: (Optional) Where a refund goes on the wallet's chain; defaults to the wallet

It returns the fee, the minimum native amount, the deadline and the order, checked against Cleave's published contracts.
An offer needs 2 to 50 USDC (at least 5 USDC for gas on Ethereum) that covers the fee, and a recipient that accepts the native coin; otherwise, or while the route is paused, no offer is returned and the answer says why.
Before buy_gas, show the user the payer, the recipient, the amount and the fee, and get their confirmation.
When the wallet already holds some gas, plan_swap can plan a swap to the native coin instead.
`,
    schema: CleaveQuoteGasSchema,
  })
  async quoteGas(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CleaveQuoteGasSchema>,
  ): Promise<string> {
    const payChainId = walletChain(walletProvider);
    if (payChainId === null) return this.#unsupported();
    if (!GAS_PAY_CHAINS.includes(payChainId)) return this.#noGasPay();
    const request = this.#gasRequest(walletProvider, payChainId, args);
    try {
      const offer = screenGetGas(request, await callTool("get_gas", request, this.#options));
      if (offer.error !== undefined) return JSON.stringify(offer);
      const { typedData: _typedData, offer: _offer, ...shown } = offer;
      return JSON.stringify(shown);
    } catch (error) {
      return this.#unreachable(error);
    }
  }

  /**
   * Buys a gas top-up: signs a fresh offer's USDC authorization and submits it.
   *
   * @param walletProvider - The wallet provider that signs the authorization.
   * @param args - The input arguments for the action.
   * @returns The requestId to track as a JSON string.
   */
  @CreateAction({
    name: "buy_gas",
    description: `
This tool buys native gas with USDC through Cleave from the wallet on its current chain.
It takes the same inputs as quote_gas, plus confirmed, which must be true.

It gets a fresh offer for the same inputs and checks it against Cleave's published contracts.
It then signs the offer's single USDC authorization with the wallet, which costs no gas, and passes the signed order to Cleave's relayer.
It returns a requestId for track_swap.

Important notes:
- Call it only after the user has seen the quote_gas answer and confirmed it, and only then set confirmed to true
- The wallet must sign with its own key; smart contract wallets are refused
- An authorization not used by its deadline expires and takes nothing
- If the submission fails or times out, the order may still have been accepted: track the trackRequestId it returns before buying again
`,
    schema: CleaveBuyGasSchema,
  })
  async buyGas(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CleaveBuyGasSchema>,
  ): Promise<string> {
    if (args.confirmed !== true) {
      return refusal("not_confirmed", "buy_gas needs confirmed: true after the user confirms");
    }
    const payChainId = walletChain(walletProvider);
    if (payChainId === null) return this.#unsupported();
    if (!GAS_PAY_CHAINS.includes(payChainId)) return this.#noGasPay();
    const request = this.#gasRequest(walletProvider, payChainId, args);
    let offer: Body;
    try {
      offer = screenGetGas(request, await callTool("get_gas", request, this.#options));
    } catch (error) {
      return this.#unreachable(error);
    }
    if (offer.error !== undefined) return JSON.stringify(offer);
    if (
      typeof offer.offer !== "string" ||
      typeof offer.typedData !== "object" ||
      offer.typedData === null
    ) {
      return refusal("no_offer", "The answer carries no offer to sign");
    }
    const validBefore = Number((offer.typedData as { message?: Body }).message?.validBefore);
    const deadline = typeof offer.deadline === "number" ? offer.deadline : 0;
    if (!(Date.now() / 1000 < Math.min(validBefore, deadline))) {
      return refusal("offer_expired", "The offer expired before signing; quote again");
    }
    try {
      const code = await walletProvider
        .getPublicClient()
        .getCode({ address: request.wallet as Hex });
      if (
        code !== undefined &&
        code !== "0x" &&
        !(code.startsWith(DELEGATION_PREFIX) && code.length === 48)
      ) {
        return refusal(
          "wallet_not_supported",
          "buy_gas needs a wallet that signs with its own key",
        );
      }
    } catch (error) {
      return refusal(
        "wallet_not_supported",
        `The wallet's code could not be read: ${errorText(error)}`,
      );
    }
    const trackRequestId = `g:${payChainId}:${offer.orderHash}`;
    let signature: string;
    try {
      signature = await walletProvider.signTypedData(signable(offer.typedData as Body));
    } catch (error) {
      return refusal("signing_failed", `The wallet did not sign: ${errorText(error)}`);
    }
    const submit: GetGasInput = { offer: offer.offer, signature, wallet: request.wallet };
    try {
      const order = screenGetGas(submit, await callTool("get_gas", submit, this.#options));
      if (order.error !== undefined) return JSON.stringify({ ...order, trackRequestId });
      return JSON.stringify({
        ...order,
        trackRequestId,
        next: "Call track_swap with requestId to follow the order.",
      });
    } catch (error) {
      return refusal(
        "submission_unknown",
        `The order may have been accepted: ${errorText(error)}`,
        {
          trackRequestId,
        },
      );
    }
  }

  /**
   * Checks if the provider supports the network.
   *
   * @param network - The network to check.
   * @returns True for Ethereum, Optimism, BNB Chain, Polygon, Base and Arbitrum.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    (CHAIN_IDS as readonly number[]).includes(Number(network.chainId));

  /**
   * Builds a plan_swap request for the wallet.
   *
   * @param walletProvider - The wallet provider.
   * @param fromChainId - The wallet's chain id.
   * @param args - The swap inputs.
   * @returns The plan_swap request.
   */
  #planRequest(
    walletProvider: EvmWalletProvider,
    fromChainId: ChainId,
    args: z.infer<typeof CleavePlanSwapSchema>,
  ): PlanSwapInput {
    const request: PlanSwapInput = {
      fromChainId,
      sellToken: args.sellToken,
      buyToken: args.buyToken,
      amount: args.amount,
      wallet: walletProvider.getAddress(),
    };
    if (args.toChainId != null) request.toChainId = args.toChainId;
    if (args.recipient != null) request.recipient = args.recipient;
    if (args.maxSlippageBps != null) request.maxSlippageBps = args.maxSlippageBps;
    return request;
  }

  /**
   * Builds a get_gas offer request for the wallet.
   *
   * @param walletProvider - The wallet provider.
   * @param payChainId - The wallet's chain id.
   * @param args - The gas inputs.
   * @returns The get_gas request.
   */
  #gasRequest(
    walletProvider: EvmWalletProvider,
    payChainId: ChainId,
    args: z.infer<typeof CleaveQuoteGasSchema>,
  ): GetGasInput {
    const wallet = walletProvider.getAddress();
    const request: GetGasInput = {
      payChainId,
      chainId: args.toChainId ?? payChainId,
      recipient: args.recipient ?? wallet,
      amount: args.amount,
      wallet,
    };
    if (args.refundTo != null) request.refundTo = args.refundTo;
    return request;
  }

  /**
   * Calls a read-only endpoint.
   *
   * @param endpoint - The endpoint.
   * @param input - The request body.
   * @returns The answer as a JSON string.
   */
  async #call(endpoint: ToolEndpoint, input: Body): Promise<string> {
    try {
      return JSON.stringify(await callTool(endpoint, input, this.#options));
    } catch (error) {
      return this.#unreachable(error);
    }
  }

  /**
   * Refuses a cross-chain swap from a smart contract wallet that names no recipient.
   *
   * @param walletProvider - The wallet provider.
   * @param request - The plan_swap request.
   * @returns The refusal as a JSON string, or null when the swap may go ahead.
   */
  async #needsRecipient(
    walletProvider: EvmWalletProvider,
    request: PlanSwapInput,
  ): Promise<string | null> {
    if (request.toChainId === undefined || request.toChainId === request.fromChainId) return null;
    if (request.recipient !== undefined) return null;
    let smart = SMART_WALLETS.has(walletProvider.getName());
    if (!smart) {
      try {
        const code = await walletProvider
          .getPublicClient()
          .getCode({ address: request.wallet as Hex });
        smart =
          code !== undefined &&
          code !== "0x" &&
          !(code.startsWith(DELEGATION_PREFIX) && code.length === 48);
      } catch {
        smart = true;
      }
    }
    if (!smart) return null;
    return refusal(
      "recipient_required",
      "This wallet is a smart contract wallet, which may not exist at the same address on the other chain; pass the recipient on that chain",
    );
  }

  /**
   * Describes a wallet chain that gas top-ups are not paid from.
   *
   * @returns The refusal as a JSON string.
   */
  #noGasPay(): string {
    return refusal(
      "unsupported_chain",
      "Gas top-ups are not offered for this chain; they are paid from Ethereum, Optimism, Polygon, Base or Arbitrum",
    );
  }

  /**
   * Describes an unsupported wallet chain.
   *
   * @returns The refusal as a JSON string.
   */
  #unsupported(): string {
    return refusal(
      "unsupported_chain",
      "Cleave supports Ethereum, Optimism, BNB Chain, Polygon, Base and Arbitrum",
    );
  }

  /**
   * Describes an API call that did not complete.
   *
   * @param error - The error thrown.
   * @returns The refusal as a JSON string.
   */
  #unreachable(error: unknown): string {
    return JSON.stringify({
      error: {
        code: "unreachable",
        message: errorText(error),
        retryable: true,
      },
    });
  }
}

export const cleaveActionProvider = (config?: CleaveActionProviderConfig) =>
  new CleaveActionProvider(config);
