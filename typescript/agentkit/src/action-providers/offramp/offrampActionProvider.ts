/**
 * Offramp Action Provider
 *
 * Native AgentKit wrapper around @usdctofiat/offramp (Galleon / USDCtoFiat).
 *
 * @module offramp
 */

import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { z } from "zod";
import { cashout } from "@usdctofiat/offramp";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { CashoutActionSchema } from "./schemas";

const BASE_MAINNET = "base-mainnet";

/**
 * Adapts an AgentKit EVM wallet to the viem signer expected by the offramp SDK.
 *
 * @param walletProvider - AgentKit wallet connected to Base mainnet
 * @returns A viem wallet client backed by the AgentKit wallet
 */
function toViemWalletClient(walletProvider: EvmWalletProvider) {
  return createWalletClient({
    account: walletProvider.toSigner(),
    chain: base,
    transport: custom(walletProvider.toEip1193Provider()),
  });
}

/**
 * OfframpActionProvider exposes USDCtoFiat cash-out (Fast and Best) via @usdctofiat/offramp.
 */
export class OfframpActionProvider extends ActionProvider<EvmWalletProvider> {
  /** Creates the USDCtoFiat offramp action provider. */
  constructor() {
    super("offramp", []);
  }

  /**
   * Sell Base USDC for fiat through Galleon / USDCtoFiat (@usdctofiat/offramp).
   *
   * @param walletProvider - Wallet that signs and submits the cash-out transactions
   * @param args - Required cash-out mode, amount, currency, platform, and payee
   * @returns The serialized USDCtoFiat cash-out result
   */
  @CreateAction({
    name: "cashout",
    description: `
      Sell Base USDC for fiat using Galleon USDCtoFiat (@usdctofiat/offramp on https://usdctofiat.xyz).
      This is a native wrapper around cashout({ mode, signer, amount, currency, platform, payee }).
      Attribution (peer-ref-TOFIAT and galleonlabs) is locked by the SDK and cannot be replaced.

      mode "fast": Peer Cash at the live market rate, 0% spread. Galleon earns the TOFIAT referral. Do not force this onto Delegate.
      mode "best": deposit is delegated to the Delegate strategy; Galleon earns 10 bps on fill.

      Use this when the user wants to cash out USDC to an eligible payment rail (for example Revolut or Venmo).
      Do not use this to buy crypto (use get_onramp_buy_url). Do not invent a sandbox.
    `,
    schema: CashoutActionSchema,
  })
  async cashout(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CashoutActionSchema>,
  ): Promise<string> {
    const networkId = walletProvider.getNetwork().networkId;
    if (!networkId) {
      throw new Error("Network ID is not set");
    }
    if (networkId !== BASE_MAINNET) {
      throw new Error(
        "USDCtoFiat cashout is Base mainnet only. Switch the wallet to base-mainnet.",
      );
    }

    const result = await cashout({
      mode: args.mode,
      signer: toViemWalletClient(walletProvider),
      amount: args.amount,
      currency: args.currency,
      platform: args.platform,
      payee: args.payee,
    } as Parameters<typeof cashout>[0]);

    return JSON.stringify(result);
  }

  /**
   * Base mainnet only. USDCtoFiat cash-out is Base USDC.
   *
   * @param network - Network to check for support
   * @returns Whether the network is Base mainnet
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm" && network.networkId === BASE_MAINNET;
  }
}

/**
 * Factory for OfframpActionProvider.
 *
 * @returns A new OfframpActionProvider instance
 */
export const offrampActionProvider = () => new OfframpActionProvider();
