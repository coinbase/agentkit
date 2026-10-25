import { z } from "zod";
import {
  x402Client,
  wrapFetchWithPayment,
  decodePaymentResponseHeader,
  PaymentPolicy,
} from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  GetModelsSchema,
  RunInferenceSchema,
  RunBatchSchema,
  RunGpuCommandSchema,
  GetGpuJobSchema,
} from "./schemas";

export const DEFAULT_API_BASE = "https://api.prismnetwork.tech";
export const DEFAULT_MAX_PAYMENT_USDC = 1;

const USDC_DECIMALS = 6;

/**
 * Configuration for the Prism action provider.
 */
export interface PrismConfig {
  /**
   * Base URL of the Prism API. Defaults to https://api.prismnetwork.tech.
   */
  apiBase?: string;

  /**
   * The most a single action may pay, in USDC. Prism prices inference by the
   * token cap requested, so a large cap on a large batch is the one way an
   * agent can spend more than it meant to. Defaults to 1 USDC.
   */
  maxPaymentUsdc?: number;
}

/**
 * Turns an unknown thrown value into something worth showing a model.
 *
 * @param error - The thrown value.
 * @returns A readable message.
 */
function message(error: unknown): string {
  if (error instanceof Error) return error.message || String(error);
  const text = String(error);
  if (text !== "[object Object]") return text;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * Reads a response body as JSON, falling back to the raw text when a gateway
 * answers with something that is not JSON at all.
 *
 * @param response - The response to read.
 * @returns The parsed body, or `{ detail: <text> }` when it does not parse.
 */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 500) };
  }
}

/**
 * PrismActionProvider gives an agent metered GPU compute on Prism Network,
 * paid per call with USDC over the x402 protocol.
 *
 * Prism rents GPUs from independent operators and meters them by the second.
 * There is no account to open and no API key to hold: an agent reads the price
 * from the 402 response, pays from its own wallet, and gets the result in the
 * same request.
 */
export class PrismActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiBase: string;
  private readonly maxPaymentAtomic: bigint;

  /**
   * Creates a new PrismActionProvider instance.
   *
   * @param config - Optional API base and per-action spend cap.
   */
  constructor(config: PrismConfig = {}) {
    super("prism", []);
    this.apiBase = (config.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, "");
    const cap = config.maxPaymentUsdc ?? DEFAULT_MAX_PAYMENT_USDC;
    this.maxPaymentAtomic = BigInt(Math.floor(cap * 10 ** USDC_DECIMALS));
  }

  /**
   * List the models Prism serves, with prices and current GPU state.
   *
   * @param _walletProvider - Unused; this action costs nothing.
   * @param _args - Empty args object.
   * @returns JSON string with models, pricing and pool state.
   */
  @CreateAction({
    name: "get_models",
    description: `Lists the models Prism Network serves, what each costs, and whether a GPU is warm right now.
This action is free and needs no payment.

Call this before run_inference or run_batch when you do not already know which models exist.
The response includes per-model pricing in micro-USD (1,000,000 micros = 1 USDC), a base price
plus a per-token price, and a "state" field. A state of "cold" or "warming" means the next paid
call may return a retry notice while a GPU is leased and the model is pulled.`,
    schema: GetModelsSchema,
  })
  async getModels(
    _walletProvider: EvmWalletProvider,
    _args: z.infer<typeof GetModelsSchema>,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.apiBase}/inference/v1/models`);
      if (!response.ok) {
        return `Error listing Prism models: the API answered ${response.status}.`;
      }
      return JSON.stringify(await response.json());
    } catch (error) {
      return `Error listing Prism models: ${message(error)}`;
    }
  }

  /**
   * Run one generation on a rented GPU, paying for it from the agent's wallet.
   *
   * @param walletProvider - The wallet that pays for the call.
   * @param args - The prompt, and optionally the model and token cap.
   * @returns JSON string with the generation, token usage and settlement.
   */
  @CreateAction({
    name: "run_inference",
    description: `Runs one LLM generation on a GPU rented from Prism Network, paid with USDC on Base
via the x402 protocol. No account and no API key are needed; the wallet pays per call.

Inputs:
- prompt: the text to send to the model (required)
- model: which model to run, e.g. 'llama3.2:3b'. Omit to use the cheapest model Prism serves.
  Use get_models first if you are unsure which models exist.
- maxTokens: cap on generated tokens. The price scales with this cap, so ask for the smallest
  cap that will fit the answer. Omit for the endpoint default.

The price is a few tenths of a cent per call. Returns the generated text, token usage,
the GPU lease that served it, and the settlement transaction hash.

If no GPU is warm the call returns a retry notice and nothing is charged. When that happens,
tell the user how long to wait rather than retrying in a tight loop.`,
    schema: RunInferenceSchema,
  })
  async runInference(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RunInferenceSchema>,
  ): Promise<string> {
    const body: Record<string, unknown> = { prompt: args.prompt };
    if (args.model) body.model = args.model;
    if (args.maxTokens) body.options = { num_predict: args.maxTokens };

    return this.payFor("running Prism inference", walletProvider, "/inference/v1/inference", body);
  }

  /**
   * Run many independent prompts in one paid call.
   *
   * @param walletProvider - The wallet that pays for the call.
   * @param args - The prompts, and optionally the model and token cap.
   * @returns JSON string with every answer, the batch receipt and settlement.
   */
  @CreateAction({
    name: "run_batch",
    description: `Runs many independent prompts in a single paid call on Prism Network. The prompts are
spread across every GPU the gateway currently holds, so a batch finishes faster than the same
prompts sent one at a time, and it settles as one payment instead of many.

Inputs:
- prompts: the prompts to answer, returned in the order given (required)
- model: which model to run for every prompt. Omit to use the cheapest model Prism serves.
- maxTokens: per-prompt cap on generated tokens. The price scales with this cap and with the
  number of prompts, so keep it tight.

Use this instead of calling run_inference in a loop whenever you have more than one prompt.

The response carries a Merkle receipt over the whole set: every answer comes with its own
commitment hash and an audit path, so any single answer can be checked against the batch root
without revealing the others.`,
    schema: RunBatchSchema,
  })
  async runBatch(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RunBatchSchema>,
  ): Promise<string> {
    const body: Record<string, unknown> = { prompts: args.prompts };
    if (args.model) body.model = args.model;
    if (args.maxTokens) body.options = { num_predict: args.maxTokens };

    return this.payFor("running a Prism batch", walletProvider, "/inference/v1/batch", body);
  }

  /**
   * Lease a GPU and run one shell command on it.
   *
   * @param walletProvider - The wallet that pays for the call.
   * @param args - The shell command to run.
   * @returns JSON string with the job id and the token needed to poll it.
   */
  @CreateAction({
    name: "run_gpu_command",
    description: `Leases a GPU on Prism Network and runs one shell command on it, for example 'nvidia-smi'
or a short training or benchmark script. Costs a fixed 0.03 USDC on Base.

The command is queued rather than run inline, so this action returns a job id and a token.
Pass both to get_gpu_job to read the status and the output. Payment is only taken once the job
has succeeded, so a job that fails costs nothing.

Input:
- command: the shell command to run on the GPU box (required)

Use this when the user wants to run their own code on a GPU. For plain text generation,
run_inference is cheaper and returns the answer directly.`,
    schema: RunGpuCommandSchema,
  })
  async runGpuCommand(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RunGpuCommandSchema>,
  ): Promise<string> {
    return this.payFor("running a Prism GPU command", walletProvider, "/x402/run", {
      command: args.command,
    });
  }

  /**
   * Read the status and output of a queued GPU command.
   *
   * @param _walletProvider - Unused; polling costs nothing.
   * @param args - The job id and its polling token.
   * @returns JSON string with the job status and any output.
   */
  @CreateAction({
    name: "get_gpu_job",
    description: `Reads the status and output of a GPU command started with run_gpu_command.
This action is free; the command itself was already paid for.

Inputs:
- jobId: the job id returned by run_gpu_command (required)
- token: the token returned by run_gpu_command (required)

A job moves through queued and running before it finishes. Wait a few seconds between polls.`,
    schema: GetGpuJobSchema,
  })
  async getGpuJob(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetGpuJobSchema>,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.apiBase}/x402/jobs/${encodeURIComponent(args.jobId)}`, {
        headers: { authorization: `Bearer ${args.token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        return `Error reading Prism job ${args.jobId}: the API answered ${response.status} ${JSON.stringify(payload)}.`;
      }
      return JSON.stringify(payload);
    } catch (error) {
      return `Error reading Prism job ${args.jobId}: ${message(error)}`;
    }
  }

  /**
   * Prism settles x402 payments on EVM networks.
   *
   * @param network - The network to check.
   * @returns True when the wallet is on an EVM network.
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm";
  }

  /**
   * POSTs to a paid Prism endpoint, letting x402 answer the 402 challenge.
   *
   * @param label - What the caller was doing, used in error messages.
   * @param walletProvider - The wallet that pays.
   * @param path - The API path to call.
   * @param body - The JSON body to send.
   * @returns JSON string with the result, or a readable failure.
   */
  private async payFor(
    label: string,
    walletProvider: EvmWalletProvider,
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    try {
      const pay = wrapFetchWithPayment(fetch, this.createClient(walletProvider));
      const response = await pay(`${this.apiBase}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await readJson(response);

      // Prism answers 429 while it leases a GPU and 503 only for a real fault;
      // older deployments answered 503 for both, so both are read here.
      if (response.status === 429 || response.status === 503) {
        const seconds = (payload as { retry_after_seconds?: number }).retry_after_seconds;
        return JSON.stringify({
          charged: false,
          retryAfterSeconds: seconds ?? null,
          detail:
            (payload as { detail?: string }).detail ??
            "No GPU is warm yet. Nothing was charged; try again shortly.",
        });
      }

      if (!response.ok) {
        return `Error ${label}: the API answered ${response.status} ${JSON.stringify(payload)}.`;
      }

      const settlement =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
      return JSON.stringify({
        ...(payload as Record<string, unknown>),
        settlement: settlement ? decodePaymentResponseHeader(settlement) : null,
      });
    } catch (error) {
      return `Error ${label}: ${message(error)}`;
    }
  }

  /**
   * Builds an x402 client bound to the agent's wallet, capped at the
   * configured spend limit.
   *
   * @param walletProvider - The wallet that signs payment authorizations.
   * @returns A configured x402Client.
   */
  private createClient(walletProvider: EvmWalletProvider): x402Client {
    const account = walletProvider.toSigner();
    const signer = {
      ...account,
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

    const client = new x402Client();
    client.registerPolicy(this.spendCap());
    registerExactEvmScheme(client, { signer });
    return client;
  }

  /**
   * A payment policy that drops any option priced above the configured cap, so
   * an agent cannot be talked into an unbounded payment by a 402 response.
   *
   * @returns The policy function.
   */
  private spendCap(): PaymentPolicy {
    const cap = this.maxPaymentAtomic;
    return (_version, requirements) =>
      requirements.filter(requirement => {
        const amount = requirement as unknown as { amount?: string; maxAmountRequired?: string };
        const raw = amount.amount ?? amount.maxAmountRequired;
        if (raw === undefined) return false;
        try {
          return BigInt(raw) <= cap;
        } catch {
          return false;
        }
      });
  }
}

/**
 * Factory function to create a new PrismActionProvider instance.
 *
 * @param config - Optional API base and per-action spend cap.
 * @returns A new PrismActionProvider.
 */
export const prismActionProvider = (config?: PrismConfig) => new PrismActionProvider(config);
