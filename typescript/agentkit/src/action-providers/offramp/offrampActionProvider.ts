/**
 * Offramp Action Provider
 *
 * Native AgentKit wrapper around @usdctofiat/offramp (Galleon / USDCtoFiat).
 * Does not republish or flatten the SDK.
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
  constructor() {
    super("offramp", []);
  }

  /**
   * Sell Base USDC for fiat through Galleon / USDCtoFiat (@usdctofiat/offramp).
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
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm" && network.networkId === BASE_MAINNET;
  }
}

/**
 * Factory for OfframpActionProvider.
 */
export const offrampActionProvider = () => new OfframpActionProvider();
