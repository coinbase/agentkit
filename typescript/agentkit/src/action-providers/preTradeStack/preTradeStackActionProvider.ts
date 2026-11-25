import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  CounterpartyReportSchema,
  PreTradeGuardSchema,
  ReceiptVerifySchema,
} from "./schemas";
import {
  fetchCounterpartyReport,
  fetchPreTradeGuard,
  fetchReceiptVerify,
  type PreTradeStackOptions,
} from "./utils";

/**
 * PreTradeStackActionProvider gives an agent the pre-trade stack as
 * three native actions against StallRow, a live x402 service:
 *
 * - `pre_trade_guard` (POST /v1/pre-trade-guard, $0.005): screen a payTo
 *   BEFORE paying it — Verdict Index catalog history, an OFAC sanctions
 *   exact-match check, and the wallet's Base age/activity, combined
 *   into PROCEED / CAUTION / ABORT with itemized reasons.
 * - `counterparty_report` (POST /v1/counterparty-report, $1.00): the
 *   full multi-leg dossier on a seller before a larger commitment.
 * - `receipt_verify` (POST /v1/receipt-verify, $0.002): verify that a
 *   Base transaction really paid the claimed payTo and amount.
 *
 * Each action pays its 402 challenge from the agent's own wallet
 * provider — `EvmWalletProvider.toSigner()` supplies the EIP-712
 * signer for the `@x402/evm` exact scheme — and each carries a spend
 * guard pinned to its known price. The service settles through its
 * facilitator server-side.
 *
 * This provider complements AgentKit's generic `x402` action provider:
 * that provider is the general-purpose rail (any x402 endpoint, raw
 * responses, a confirmation flow), while this one is a dedicated, typed
 * surface for one service's real contracts. Builders who prefer the
 * generic route can already reach these endpoints through the `x402`
 * provider today.
 *
 * Usage:
 *   const agentKit = await AgentKit.configureWithWallet({
 *     walletProvider,
 *     actionProviders: [preTradeStackActionProvider()],
 *   });
 */
export class PreTradeStackActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly options: PreTradeStackOptions;

  /**
   * Creates a new PreTradeStackActionProvider.
   *
   * @param options - Optional base URL / spend-guard overrides.
   */
  constructor(options: PreTradeStackOptions = {}) {
    super("pre-trade-stack", []);
    this.options = options;
  }

  /**
   * Screen a payTo before paying it.
   *
   * @param walletProvider - The agent's EVM wallet provider (pays $0.005).
   * @param args - The payTo and optional amount/network/resource context.
   * @returns A JSON string with the PROCEED / CAUTION / ABORT verdict,
   * risk score, itemized reasons, and per-leg detail — or an error
   * message string.
   */
  @CreateAction({
    name: "pre_trade_guard",
    description: `
This tool will screen a payTo address BEFORE you pay it.
It calls StallRow's Pre-Trade Guard, a live x402 service, and pays $0.005 USDC on Base automatically
from the agent wallet. It returns PROCEED / CAUTION / ABORT with a risk score and itemized reasons,
from the payTo's catalog history (first seen, payTo rotations), an OFAC sanctions exact-match check,
and the wallet's Base age and activity.

Inputs:
- pay_to: The payTo address you are about to pay (0x...)
- amount: Optional amount you are about to pay, in the asset's smallest units (e.g. 20000 for $0.02 USDC)
- network: Optional network id (default eip155:8453, Base)
- resource: Optional resource URL of the listing you are about to pay

Use this before paying a payTo you have never paid before.
`,
    schema: PreTradeGuardSchema,
  })
  async preTradeGuard(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PreTradeGuardSchema>,
  ): Promise<string> {
    try {
      const signer = walletProvider.toSigner();
      const result = await fetchPreTradeGuard(signer, args, this.options);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error screening payTo: ${error}`;
    }
  }

  /**
   * Get the full counterparty report on a seller.
   *
   * @param walletProvider - The agent's EVM wallet provider (pays $1.00).
   * @param args - The seller's payTo and optional leg inputs.
   * @returns A JSON string with the multi-leg counterparty report — or
   * an error message string.
   */
  @CreateAction({
    name: "counterparty_report",
    description: `
This tool will build a full counterparty report on an x402 seller before a larger commitment.
It calls StallRow, a live x402 service, and pays $1.00 USDC on Base automatically from the agent wallet.
It combines the pre-trade screen, the bad-payTo feed history, and — when given — a Token Verdict leg
on the seller's token and a LockSmith audit leg on the seller's service URL.

Inputs:
- pay_to: The seller's payTo address (0x...)
- token_address: Optional token contract for the Token Verdict leg
- chain: Chain for the Token Verdict leg (default "base")
- service_url: Optional service endpoint URL for the LockSmith audit leg

Use this before committing meaningful funds to an unfamiliar seller.
`,
    schema: CounterpartyReportSchema,
  })
  async counterpartyReport(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CounterpartyReportSchema>,
  ): Promise<string> {
    try {
      const signer = walletProvider.toSigner();
      const result = await fetchCounterpartyReport(signer, args, this.options);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error building counterparty report: ${error}`;
    }
  }

  /**
   * Verify a Base payment receipt.
   *
   * @param walletProvider - The agent's EVM wallet provider (pays $0.002).
   * @param args - The Base transaction hash to verify.
   * @returns A JSON string with the receipt verification (payer, payTo,
   * amount read from the chain) — or an error message string.
   */
  @CreateAction({
    name: "receipt_verify",
    description: `
This tool will verify that a Base transaction really paid the claimed payTo and amount.
It calls StallRow's Receipt Verifier, a live x402 service, and pays $0.002 USDC on Base automatically
from the agent wallet. It reads the transaction on Base and reports the payer, payTo, and amount
actually transferred.

Inputs:
- tx_hash: The Base transaction hash to verify (0x + 64 hex characters)

Use this when a counterparty claims a payment was made and you need chain proof.
`,
    schema: ReceiptVerifySchema,
  })
  async receiptVerify(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ReceiptVerifySchema>,
  ): Promise<string> {
    try {
      const signer = walletProvider.toSigner();
      const result = await fetchReceiptVerify(signer, args, this.options);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error verifying receipt: ${error}`;
    }
  }

  /**
   * Payments settle in USDC on Base, so the wallet must be an EVM
   * wallet on Base mainnet.
   *
   * @param network - The network to check support for.
   * @returns True if the network is EVM on Base mainnet, false otherwise.
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      (network.chainId === "8453" || network.networkId === "base-mainnet")
    );
  }
}

/**
 * Factory for the Pre-Trade Stack action provider (AgentKit idiom).
 *
 * @param options - Optional base URL / spend-guard overrides.
 * @returns A new PreTradeStackActionProvider
 */
export const preTradeStackActionProvider = (
  options: PreTradeStackOptions = {},
): PreTradeStackActionProvider => new PreTradeStackActionProvider(options);
