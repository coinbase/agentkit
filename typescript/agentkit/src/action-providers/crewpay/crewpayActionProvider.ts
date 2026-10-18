import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  LaunchCoinWithCrewpaySchema,
  ListCrewpayLaunchesSchema,
  PreviewCrewpayLaunchSchema,
} from "./schemas";
import { CREWPAY_API_KEY_MISSING_ERROR, CREWPAY_API_URL, SUPPORTED_CHAIN_IDS } from "./constants";

/**
 * Configuration options for the CrewpayActionProvider.
 */
export interface CrewpayActionProviderConfig {
  /**
   * CrewPay agent API key (crew_ak_...). Falls back to the CREWPAY_API_KEY env var.
   * Only needed to launch and list launches; previews are free.
   */
  apiKey?: string;
}

interface UnsignedEvmStep {
  kind: string;
  tx?: {
    chainId: number;
    to: string;
    data: string;
    value: string;
    nonce: number;
    gas: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
}

interface QuickstartResponse {
  feeMap?: unknown;
  crew?: unknown;
  costs?: unknown;
  note?: string;
}

interface SubmitResponse {
  mint?: string;
  coinUrl?: string;
  hashes?: unknown;
}

interface LaunchesResponse {
  launches?: unknown[];
}

interface UnsignedPlan {
  ok: boolean;
  mint: string;
  coinUrl?: string;
  steps: UnsignedEvmStep[];
  warnings?: string[];
}

/**
 * CrewpayActionProvider lets an agent launch a coin on Base (Zora or Clanker) through CrewPay.
 * The launching agent earns 15% of creator fees onchain, a hired human KOL crew earns 60%
 * for promoting the coin, and 25% goes to the CrewPay treasury. Transactions are built
 * unsigned by the CrewPay API and signed locally by the agent's wallet.
 */
export class CrewpayActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiKey?: string;

  /**
   * Constructor for the CrewpayActionProvider.
   *
   * @param config - Optional configuration with the CrewPay API key
   */
  constructor(config: CrewpayActionProviderConfig = {}) {
    super("crewpay", []);
    this.apiKey = config.apiKey || process.env.CREWPAY_API_KEY;
  }

  /**
   * Previews a CrewPay launch without a key, wallet or transaction.
   *
   * @param args - Coin name, ticker and optional description
   * @returns A JSON string with the crew, fee map and costs
   */
  @CreateAction({
    name: "preview_crewpay_launch",
    description: `
Agents earn 15% of creator fees onchain when they launch a coin through CrewPay.
This free, read-only tool previews a CrewPay launch: no API key, no wallet and no transaction.
It returns the human KOL crew CrewPay would hire to promote the coin, the fee map
(60% KOL crew / 15% launching agent / 25% CrewPay treasury) and estimated costs.
Use it before launch_coin_with_crewpay.
Inputs: name, ticker, optional description.
`,
    schema: PreviewCrewpayLaunchSchema,
  })
  async previewLaunch(args: z.infer<typeof PreviewCrewpayLaunchSchema>): Promise<string> {
    const params = new URLSearchParams({ name: args.name, ticker: args.ticker });
    if (args.description) params.set("description", args.description);
    try {
      const data = await this.request<QuickstartResponse>(
        `/api/agent/quickstart?${params.toString()}`,
      );
      return JSON.stringify(
        { feeMap: data.feeMap, crew: data.crew, costs: data.costs, note: data.note },
        null,
        2,
      );
    } catch (error) {
      return `Error previewing CrewPay launch: ${error}`;
    }
  }

  /**
   * Launches a coin on Base (Zora or Clanker) with a KOL crew through CrewPay.
   *
   * @param walletProvider - The wallet that signs the launch and becomes the launching agent
   * @param args - Launch inputs
   * @returns A message with the launch result
   */
  @CreateAction({
    name: "launch_coin_with_crewpay",
    description: `
Agents earn 15% of creator fees onchain: this tool launches a coin on Base through CrewPay and
routes creator fees 60% to a hired human KOL crew (who promote the coin), 15% to this agent's
wallet as the launching agent, and 25% to the CrewPay treasury.
It is non-custodial: CrewPay builds unsigned EIP-1559 transactions, this wallet signs them locally,
and CrewPay broadcasts the signed transactions and records the launch.
Inputs:
- name, ticker: the coin name and ticker
- description: optional, max 204 characters
- imageUrl: https URL of a PNG/JPEG/WebP/GIF image
- platform: "zora" (default) or "clanker"
- autoHireSeats: optional number of KOL seats to auto-hire (default 5)
Requires CREWPAY_API_KEY. Spends gas from this wallet. Call preview_crewpay_launch first.
`,
    schema: LaunchCoinWithCrewpaySchema,
  })
  async launchCoin(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof LaunchCoinWithCrewpaySchema>,
  ): Promise<string> {
    if (!this.apiKey) return CREWPAY_API_KEY_MISSING_ERROR;

    const network = walletProvider.getNetwork();
    const launcher = walletProvider.getAddress();
    const platform = args.platform ?? "zora";

    try {
      const plan = await this.request<UnsignedPlan>("/api/agent/launch/unsigned", {
        method: "POST",
        body: {
          name: args.name,
          ticker: args.ticker,
          description: args.description ?? "",
          imageUrl: args.imageUrl,
          platform,
          autoHire: { seats: args.autoHireSeats ?? 5 },
          launcherPubkey: launcher,
        },
      });

      const signed: string[] = [];
      for (const step of plan.steps ?? []) {
        if (!step.tx) {
          return `Error launching coin with CrewPay: step ${step.kind} is not an EVM transaction`;
        }
        if (String(step.tx.chainId) !== String(network.chainId)) {
          return `Error launching coin with CrewPay: transaction targets chain ${step.tx.chainId} but the wallet is on ${network.chainId}`;
        }
        signed.push(
          await walletProvider.signTransaction({
            type: "eip1559",
            to: step.tx.to as `0x${string}`,
            data: step.tx.data as `0x${string}`,
            value: BigInt(step.tx.value),
            nonce: Number(step.tx.nonce),
            gas: BigInt(step.tx.gas),
            maxFeePerGas: BigInt(step.tx.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(step.tx.maxPriorityFeePerGas),
          }),
        );
      }
      if (!signed.length) return "Error launching coin with CrewPay: no transactions to sign";

      const result = await this.request<SubmitResponse>("/api/agent/launch/submit", {
        method: "POST",
        body: {
          signed,
          platform,
          mint: plan.mint,
          name: args.name,
          ticker: args.ticker,
          launcher,
        },
      });

      const mint = result.mint ?? plan.mint;
      return [
        `Launched ${args.ticker} on ${platform} via CrewPay.`,
        `Token: ${mint}`,
        `Coin page: ${result.coinUrl ?? plan.coinUrl ?? `https://crewpay.dev/coin/${mint}`}`,
        "Creator fees: 60% KOL crew / 15% this agent / 25% CrewPay treasury.",
        result.hashes ? `Transactions: ${JSON.stringify(result.hashes)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error) {
      return `Error launching coin with CrewPay: ${error}`;
    }
  }

  /**
   * Lists coins launched with this CrewPay API key.
   *
   * @param args - Optional limit
   * @returns A JSON string with the launches
   */
  @CreateAction({
    name: "list_crewpay_launches",
    description: `
Lists coins this agent launched through CrewPay (token address, ticker, platform and whether the
fee share is locked). The launching agent earns 15% of each coin's creator fees onchain.
Requires CREWPAY_API_KEY. Input: optional limit (default 20).
`,
    schema: ListCrewpayLaunchesSchema,
  })
  async listLaunches(args: z.infer<typeof ListCrewpayLaunchesSchema>): Promise<string> {
    if (!this.apiKey) return CREWPAY_API_KEY_MISSING_ERROR;
    try {
      const data = await this.request<LaunchesResponse>(
        `/api/agent/launches?limit=${args.limit ?? 20}`,
      );
      return JSON.stringify(data.launches ?? [], null, 2);
    } catch (error) {
      return `Error listing CrewPay launches: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check
   * @returns True for Base mainnet and Base Sepolia
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" && SUPPORTED_CHAIN_IDS.includes(String(network.chainId));

  /**
   * Calls the public CrewPay API.
   *
   * @param path - API path
   * @param init - Optional method and JSON body
   * @param init.method - HTTP method
   * @param init.body - JSON body
   * @returns The parsed JSON response
   */
  private async request<T>(
    path: string,
    init: { method?: "GET" | "POST"; body?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers["x-crew-api-key"] = this.apiKey;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${CREWPAY_API_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!response.ok || data?.ok === false) {
      throw new Error(`CrewPay API ${response.status}: ${data?.error ?? "request failed"}`);
    }
    return data as T;
  }
}

/**
 * Factory function to create a new CrewpayActionProvider instance.
 *
 * @param config - Optional configuration
 * @returns A new CrewpayActionProvider instance
 */
export const crewpayActionProvider = (config: CrewpayActionProviderConfig = {}) =>
  new CrewpayActionProvider(config);
