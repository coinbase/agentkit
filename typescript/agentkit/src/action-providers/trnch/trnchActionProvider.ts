import { z } from "zod";
import { Hex } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  GetTrnchHeatSchema,
  GetTrnchStatsSchema,
  TrnchBuySchema,
  TrnchSellSchema,
} from "./schemas";

const TRNCH_API = "https://trnch.fun/api/bot/v1";
const ROBINHOOD_CHAIN_ID = "4663";

/**
 * Configuration for the TrnchActionProvider.
 */
export interface TrnchActionProviderConfig {
  /**
   * TRNCH bot API key. Optional: without it, a key is created on first use by signing a message with the wallet (no funds move).
   */
  apiKey?: string;

  /**
   * Your TRNCH referral code. Optional: every swap made with a key this provider creates pays its owner a share of the TRNCH fee.
   */
  ref?: string;
}

interface BuiltSwap {
  router: string;
  approval: { to: Hex; data: Hex } | null;
  /** `gas`: the router estimate plus 30%, sent as is. */
  tx: { to: Hex; data: Hex; value?: string; gas?: string | null };
}

/**
 * TrnchActionProvider trades new Robinhood Chain tokens through TRNCH (https://trnch.fun):
 * a live feed of launches screened by TIA and the best route across six routers. Non-custodial.
 */
export class TrnchActionProvider extends ActionProvider<EvmWalletProvider> {
  #apiKey: string | undefined;
  #ref: string | undefined;

  /**
   * Constructor for the TrnchActionProvider.
   *
   * @param config - Configuration for the provider.
   */
  constructor(config: TrnchActionProviderConfig = {}) {
    super("trnch", []);
    this.#apiKey = config.apiKey || process.env.TRNCH_API_KEY;
    this.#ref = config.ref || process.env.TRNCH_REF;
  }

  /**
   * Gets live TRNCH numbers for the last 24 hours.
   *
   * @param _walletProvider - The wallet provider (unused).
   * @param _args - No input.
   * @returns The stats as JSON.
   */
  @CreateAction({
    name: "get_trnch_stats",
    description: `
This tool returns TRNCH live numbers for the last 24 hours on Robinhood Chain: tokens spotted, tokens kept out as High risk by TIA, rugs detected, median detection delay in seconds and the bot fee. No API key needed.`,
    schema: GetTrnchStatsSchema,
  })
  async getStats(
    _walletProvider: EvmWalletProvider,
    _args: z.infer<typeof GetTrnchStatsSchema>,
  ): Promise<string> {
    return this.#run(() => this.#request("/stats"));
  }

  /**
   * Gets the live TRNCH Heat feed.
   *
   * @param walletProvider - The wallet provider, used to create an API key if needed.
   * @param args - The input arguments for the action.
   * @returns The feed as JSON.
   */
  @CreateAction({
    name: "get_trnch_heat",
    description: `
This tool returns the TRNCH Heat: new Robinhood Chain tokens screened by TIA (rugs, honeypots, scam contracts, heavy sell taxes and copycats are kept out), ranked live.

Each token has an opaque id to pass to trnch_buy or trnch_sell, with price, liquidity, volume and price changes. The "new" list holds just-spotted tokens, not yet screened (higher risk).
Pass nextSince back as since to get only new entries.`,
    schema: GetTrnchHeatSchema,
  })
  async getHeat(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTrnchHeatSchema>,
  ): Promise<string> {
    return this.#run(async () => {
      const key = await this.#key(walletProvider);
      const since = args.since ? `?since=${encodeURIComponent(args.since)}` : "";
      return this.#request(`/heat${since}`, {}, key);
    });
  }

  /**
   * Buys a token through TRNCH with USDG.
   *
   * @param walletProvider - The wallet provider that sends the transactions.
   * @param args - The input arguments for the action.
   * @returns The transaction hash as JSON.
   */
  @CreateAction({
    name: "trnch_buy",
    description: `
This tool buys a Robinhood Chain token through TRNCH, paid in USDG.

It quotes six routers (KyberSwap, LI.FI, Uniswap, 0x, SushiSwap, 1inch), sends the approval if needed, then the swap from this wallet, and returns the transaction hash.
Tokens kept out by TIA are refused. The 0.5% TRNCH fee is already deducted from the quote.
Inputs: tokenId (from get_trnch_heat) or token (address), amountUsd, optional slippageBps.`,
    schema: TrnchBuySchema,
  })
  async buy(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TrnchBuySchema>,
  ): Promise<string> {
    return this.#run(async () => {
      const key = await this.#key(walletProvider);
      const body = {
        ...(args.tokenId ? { tokenId: args.tokenId } : { token: args.token }),
        amountUsd: args.amountUsd,
        slippageBps: args.slippageBps,
      };
      const built = (await this.#request(
        "/buy",
        { method: "POST", body: JSON.stringify(body) },
        key,
      )) as BuiltSwap;
      return this.#execute(walletProvider, built, key);
    });
  }

  /**
   * Sells a token through TRNCH for USDG.
   *
   * @param walletProvider - The wallet provider that sends the transactions.
   * @param args - The input arguments for the action.
   * @returns The transaction hash as JSON.
   */
  @CreateAction({
    name: "trnch_sell",
    description: `
This tool sells a Robinhood Chain token for USDG through TRNCH: a percent of this wallet's balance, best route across six routers, approval and swap sent from this wallet. Returns the transaction hash.
The 0.5% TRNCH fee is already deducted from the quote.
Inputs: tokenId (from get_trnch_heat) or token (address), percent, optional slippageBps.`,
    schema: TrnchSellSchema,
  })
  async sell(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TrnchSellSchema>,
  ): Promise<string> {
    return this.#run(async () => {
      const key = await this.#key(walletProvider);
      const body = {
        ...(args.tokenId ? { tokenId: args.tokenId } : { token: args.token }),
        percent: args.percent,
        slippageBps: args.slippageBps,
      };
      const built = (await this.#request(
        "/sell",
        { method: "POST", body: JSON.stringify(body) },
        key,
      )) as BuiltSwap;
      return this.#execute(walletProvider, built, key);
    });
  }

  /**
   * Checks if the TRNCH action provider supports the given network (Robinhood Chain only).
   *
   * @param network - The network to check.
   * @returns True on Robinhood Chain.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.chainId === ROBINHOOD_CHAIN_ID;

  /**
   * Runs an action and returns its result or error as JSON.
   *
   * @param fn - The action body.
   * @returns JSON string.
   */
  async #run(fn: () => Promise<unknown>): Promise<string> {
    try {
      return JSON.stringify({ success: true, ...((await fn()) as object) });
    } catch (error) {
      return JSON.stringify({ success: false, error: `${error}` });
    }
  }

  /**
   * Calls the TRNCH bot API.
   *
   * @param path - API path.
   * @param init - Fetch options.
   * @param key - API key.
   * @returns The JSON body.
   */
  async #request(path: string, init: RequestInit = {}, key?: string) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (key) headers.authorization = `Bearer ${key}`;
    const response = await fetch(`${TRNCH_API}${path}`, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(`TRNCH ${path} ${response.status}: ${body.error ?? response.statusText}`);
    return body;
  }

  /**
   * Returns the API key, creating one by wallet signature if none was given.
   *
   * @param walletProvider - The wallet provider that signs.
   * @returns The API key.
   */
  async #key(walletProvider: EvmWalletProvider): Promise<string> {
    if (this.#apiKey) return this.#apiKey;
    const wallet = walletProvider.getAddress();
    const { message } = await this.#request(`/register?wallet=${wallet}`);
    const signature = await walletProvider.signMessage(message);
    const reg = await this.#request("/register", {
      method: "POST",
      body: JSON.stringify({
        wallet,
        message,
        signature,
        label: "agentkit",
        ...(this.#ref ? { ref: this.#ref } : {}),
      }),
    });
    this.#apiKey = reg.key as string;
    return this.#apiKey;
  }

  /**
   * Sends the approval (if any) and the swap, then reports the hash to TRNCH.
   *
   * @param walletProvider - The wallet provider that sends.
   * @param built - The swap built by TRNCH.
   * @param key - API key.
   * @returns The hash and router.
   */
  async #execute(walletProvider: EvmWalletProvider, built: BuiltSwap, key: string) {
    if (built.approval) {
      const approvalHash = await walletProvider.sendTransaction({
        to: built.approval.to,
        data: built.approval.data,
      });
      await walletProvider.waitForTransactionReceipt(approvalHash);
    }
    const txHash = await walletProvider.sendTransaction({
      to: built.tx.to,
      data: built.tx.data,
      value: BigInt(built.tx.value ?? 0),
      gas: built.tx.gas ? BigInt(built.tx.gas) : undefined,
    });
    await walletProvider.waitForTransactionReceipt(txHash);
    await this.#request(
      "/confirm",
      { method: "POST", body: JSON.stringify({ txHash }) },
      key,
    ).catch(() => undefined);
    return { txHash, router: built.router };
  }
}

/**
 * Creates a new TrnchActionProvider.
 *
 * @param config - Optional configuration for the provider.
 * @returns A new TrnchActionProvider.
 */
export const trnchActionProvider = (config: TrnchActionProviderConfig = {}) =>
  new TrnchActionProvider(config);
