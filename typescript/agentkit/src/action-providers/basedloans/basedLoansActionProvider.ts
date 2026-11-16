import { z } from "zod";
import { getAddress, isAddress, type Address } from "viem";
import {
  BasedLoansError,
  createBasedLoans,
  explainError,
  type BasedLoans,
  type BasedLoansOptions,
  type TransactionPlan,
} from "@basedloans/sdk";

import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  BuybackSchema,
  EmptySchema,
  LendSchema,
  LimitsSchema,
  ListMarketsSchema,
  LoanIdsSchema,
  QuoteSchema,
  RequestTokenSchema,
  TokenSchema,
  WithdrawSchema,
} from "./schemas";

export const SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * Serializes SDK results, converting bigints to strings.
 *
 * @param value - The value to serialize
 * @returns Pretty-printed JSON
 */
const toJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v), 2);

/**
 * BasedLoansActionProvider lets an agent borrow USDC against Base tokens with no liquidations,
 * buy collateral back, and lend USDC against tokens it chooses on Based Loans.
 * Reads come straight from Base; write actions are signed by the agent's own wallet.
 */
export class BasedLoansActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly client: BasedLoans;

  /**
   * Constructor for the BasedLoansActionProvider class.
   *
   * @param options - Optional SDK settings, such as a custom Base RPC URL
   */
  constructor(options: BasedLoansOptions = {}) {
    super("basedloans", []);
    this.client = createBasedLoans(options);
  }

  /**
   * Gets live protocol parameters.
   *
   * @param _args - No input
   * @returns Loan fee, terms, buyback costs and size limits as JSON
   */
  @CreateAction({
    name: "get_protocol_info",
    description: `
Returns Based Loans' live parameters: the loan fee, the three loan terms with their durations and
buyback costs, minimum loan and deposit sizes, and per-token limit bounds.`,
    schema: EmptySchema,
  })
  async getProtocolInfo(_args: z.infer<typeof EmptySchema>): Promise<string> {
    return this.safely(async () => toJson(await this.client.getProtocolParams()));
  }

  /**
   * Lists tokens accepted as collateral.
   *
   * @param args - Optional filter for tokens with USDC available
   * @returns Markets with price, max loan-to-value and available USDC as JSON
   */
  @CreateAction({
    name: "list_markets",
    description: `
Lists the tokens Based Loans accepts as collateral, with each token's price, maximum loan-to-value
and the USDC currently available to borrow against it.`,
    schema: ListMarketsSchema,
  })
  async listMarkets(args: z.infer<typeof ListMarketsSchema>): Promise<string> {
    return this.safely(async () =>
      toJson(await this.client.listMarkets({ onlyWithFunds: args.onlyWithFunds })),
    );
  }

  /**
   * Gets a token's risk data.
   *
   * @param args - The token to check
   * @returns Risk flags with plain-language explanations as JSON
   */
  @CreateAction({
    name: "get_risk_report",
    description: `
Returns risk data for a token on Based Loans: its price sources and whether they agree, pool
history, how much trading would move its pool price 2x and 10x, USDC available against it, and a
plain-language explanation of each flag. Check this before lending against a token.`,
    schema: TokenSchema,
  })
  async getRiskReport(args: z.infer<typeof TokenSchema>): Promise<string> {
    return this.safely(async () =>
      toJson(await this.client.getRiskReport(this.resolveToken(args.token))),
    );
  }

  /**
   * Quotes a loan without sending anything.
   *
   * @param args - Token, collateral amount, optional loan amount and term
   * @returns USDC received, buyback cost and due date as JSON
   */
  @CreateAction({
    name: "quote_borrow",
    description: `
Quotes a Based Loans loan without sending anything: the USDC received after the fee, the fixed
buyback cost and the due date for borrowing against a token. There are no liquidations: price moves
during the loan never sell the collateral. If the borrower does not buy it back by the due date,
they keep the USDC and the lenders keep the collateral.`,
    schema: QuoteSchema,
  })
  async quoteBorrow(args: z.infer<typeof QuoteSchema>): Promise<string> {
    return this.safely(async () =>
      toJson(
        await this.client.quoteBorrow({
          asset: this.resolveToken(args.token),
          collateralAmount: args.collateralAmount,
          loanAmountUsdc: args.loanAmountUsdc,
          term: args.term,
        }),
      ),
    );
  }

  /**
   * Lists the wallet's loans.
   *
   * @param wallet - The agent's wallet
   * @param _args - No input
   * @returns Loans with status, buyback remaining and due date as JSON
   */
  @CreateAction({
    name: "get_my_loans",
    description:
      "Lists the loans this wallet has borrowed on Based Loans, with status, buyback amount remaining and due date.",
    schema: EmptySchema,
  })
  async getMyLoans(wallet: EvmWalletProvider, _args: z.infer<typeof EmptySchema>): Promise<string> {
    return this.safely(async () =>
      toJson(await this.client.getBorrowerLoans(getAddress(wallet.getAddress()))),
    );
  }

  /**
   * Gets the wallet's lending position.
   *
   * @param wallet - The agent's wallet
   * @param _args - No input
   * @returns Deposit, active loans, limits and claimables as JSON
   */
  @CreateAction({
    name: "get_my_lending",
    description: `
Returns this wallet's Based Loans lending position: amount deposited, USDC in active loans, USDC
available to withdraw, per-token limits, and any repaid USDC or collateral ready to claim.`,
    schema: EmptySchema,
  })
  async getMyLending(
    wallet: EvmWalletProvider,
    _args: z.infer<typeof EmptySchema>,
  ): Promise<string> {
    return this.safely(async () =>
      toJson(await this.client.getLenderPosition(getAddress(wallet.getAddress()))),
    );
  }

  /**
   * Checks whether a token is accepted, returning a listing request link if not.
   *
   * @param args - The token contract address
   * @returns Listing status and, if unsupported, a request link as JSON
   */
  @CreateAction({
    name: "request_token_listing",
    description: `
Checks whether a token is accepted as Based Loans collateral. If it is not, returns a link a person
can open to submit a listing request. Nothing is submitted automatically.`,
    schema: RequestTokenSchema,
  })
  async requestTokenListing(args: z.infer<typeof RequestTokenSchema>): Promise<string> {
    return this.safely(async () =>
      toJson(await this.client.requestTokenListing(getAddress(args.token))),
    );
  }

  /**
   * Opens a loan: approves the collateral if needed, then borrows.
   *
   * @param wallet - The agent's wallet, which signs each transaction
   * @param args - Token, collateral amount, optional loan amount and term
   * @returns A summary with transaction hashes, or an error message
   */
  @CreateAction({
    name: "borrow",
    description: `
Opens a Based Loans loan: deposits a token as collateral and sends USDC to this wallet right away.
The wallet can buy the collateral back for the fixed buyback cost before the due date; otherwise it
keeps the USDC and the lenders keep the collateral. There are no liquidations.
Run quote_borrow first and confirm the amounts, buyback cost and due date with the user.
Approves the collateral token first only if needed.`,
    schema: QuoteSchema,
  })
  async borrow(wallet: EvmWalletProvider, args: z.infer<typeof QuoteSchema>): Promise<string> {
    return this.safely(async () =>
      this.execute(
        wallet,
        await this.client.buildBorrow({
          asset: this.resolveToken(args.token),
          collateralAmount: args.collateralAmount,
          loanAmountUsdc: args.loanAmountUsdc,
          term: args.term,
          borrower: getAddress(wallet.getAddress()),
        }),
      ),
    );
  }

  /**
   * Pays USDC on a loan to get collateral back.
   *
   * @param wallet - The agent's wallet, which signs each transaction
   * @param args - Loan ID and optional partial payment
   * @returns A summary with transaction hashes, or an error message
   */
  @CreateAction({
    name: "buyback",
    description: `
Pays USDC on a Based Loans loan to get collateral back before the due date. Omit paymentUsdc to pay
everything left and get all the collateral back; a partial payment returns a matching share.`,
    schema: BuybackSchema,
  })
  async buyback(wallet: EvmWalletProvider, args: z.infer<typeof BuybackSchema>): Promise<string> {
    return this.safely(async () =>
      this.execute(
        wallet,
        await this.client.buildBuyback({
          loanId: args.loanId,
          paymentUsdc: args.paymentUsdc,
          borrower: getAddress(wallet.getAddress()),
        }),
      ),
    );
  }

  /**
   * Deposits USDC to lend, optionally setting per-token limits.
   *
   * @param wallet - The agent's wallet, which signs each transaction
   * @param args - Amount and optional per-token limits
   * @returns A summary with transaction hashes, or an error message
   */
  @CreateAction({
    name: "lend",
    description: `
Deposits USDC to lend on Based Loans, optionally setting per-token lending limits in the same step.
Lenders only fund loans against tokens they set a limit for, so a first deposit needs at least one.
Run get_risk_report on each token first.`,
    schema: LendSchema,
  })
  async lend(wallet: EvmWalletProvider, args: z.infer<typeof LendSchema>): Promise<string> {
    return this.safely(async () =>
      this.execute(
        wallet,
        await this.client.buildDeposit({
          amountUsdc: args.amountUsdc,
          lender: getAddress(wallet.getAddress()),
          limits: args.limits?.map(l => ({
            asset: this.resolveToken(l.token),
            limitUsdc: l.limitUsdc,
          })),
        }),
      ),
    );
  }

  /**
   * Sets per-token lending limits.
   *
   * @param wallet - The agent's wallet, which signs the transaction
   * @param args - Tokens and limits
   * @returns A summary with the transaction hash, or an error message
   */
  @CreateAction({
    name: "set_lending_limits",
    description:
      "Adds, changes or removes per-token lending limits on Based Loans. A limit of 0 removes the token.",
    schema: LimitsSchema,
  })
  async setLendingLimits(
    wallet: EvmWalletProvider,
    args: z.infer<typeof LimitsSchema>,
  ): Promise<string> {
    return this.safely(async () =>
      this.execute(
        wallet,
        await this.client.buildSetLimits({
          limits: args.limits.map(l => ({
            asset: this.resolveToken(l.token),
            limitUsdc: l.limitUsdc,
          })),
          lender: getAddress(wallet.getAddress()),
        }),
      ),
    );
  }

  /**
   * Withdraws USDC that is not in active loans.
   *
   * @param wallet - The agent's wallet, which signs the transaction
   * @param args - Amount (or "max") and whether to receive mUSDC
   * @returns A summary with the transaction hash, or an error message
   */
  @CreateAction({
    name: "withdraw",
    description:
      'Withdraws USDC from Based Loans that is not in active loans. Use "max" to withdraw everything available.',
    schema: WithdrawSchema,
  })
  async withdraw(wallet: EvmWalletProvider, args: z.infer<typeof WithdrawSchema>): Promise<string> {
    return this.safely(async () =>
      this.execute(
        wallet,
        await this.client.buildWithdraw({
          amountUsdc: args.amountUsdc,
          lender: getAddress(wallet.getAddress()),
          asMusdc: args.asMusdc,
        }),
      ),
    );
  }

  /**
   * Claims repaid USDC from funded loans.
   *
   * @param wallet - The agent's wallet, which signs the transaction
   * @param args - Loan IDs and whether to withdraw or re-lend
   * @returns A summary with the transaction hash, or an error message
   */
  @CreateAction({
    name: "claim_proceeds",
    description: `
Claims repaid USDC from Based Loans loans this wallet funded. Use mode "redeploy" to put it straight
back into lending instead of sending it to the wallet.`,
    schema: LoanIdsSchema,
  })
  async claimProceeds(
    wallet: EvmWalletProvider,
    args: z.infer<typeof LoanIdsSchema>,
  ): Promise<string> {
    return this.safely(async () =>
      this.execute(
        wallet,
        await this.client.buildClaimProceeds({ loanIds: args.loanIds, mode: args.mode }),
      ),
    );
  }

  /**
   * Claims collateral from funded loans that passed their due date without a buyback.
   *
   * @param wallet - The agent's wallet, which signs the transaction
   * @param args - Loan IDs
   * @returns A summary with the transaction hash, or an error message
   */
  @CreateAction({
    name: "claim_collateral",
    description:
      "Claims this wallet's share of collateral from Based Loans loans it funded that passed their due date without a buyback.",
    schema: LoanIdsSchema,
  })
  async claimCollateral(
    wallet: EvmWalletProvider,
    args: z.infer<typeof LoanIdsSchema>,
  ): Promise<string> {
    return this.safely(async () =>
      this.execute(wallet, await this.client.buildClaimCollateral({ loanIds: args.loanIds })),
    );
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True if the network is Base mainnet
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId ?? "");

  /**
   * Resolves a token address or symbol to a checksummed address of an accepted token.
   *
   * @param ref - Token contract address or symbol
   * @returns The token address
   */
  private resolveToken(ref: string): Address {
    if (isAddress(ref)) return getAddress(ref);
    const matches = [...this.client.ctx.assets.values()].filter(
      a => a.symbol.toLowerCase() === ref.trim().toLowerCase(),
    );
    if (matches.length === 1) return getAddress(matches[0].address);
    throw new BasedLoansError(
      matches.length > 1
        ? `More than one token is called ${ref}; pass its contract address.`
        : `Unknown token "${ref}". Pass its contract address, or use request_token_listing.`,
      "UNKNOWN_TOKEN",
    );
  }

  /**
   * Sends each step of a transaction plan in order, stopping at the first failure.
   *
   * @param wallet - The agent's wallet
   * @param plan - The ordered transactions built by the SDK
   * @returns A summary with transaction hashes and any warnings
   */
  private async execute(wallet: EvmWalletProvider, plan: TransactionPlan): Promise<string> {
    const hashes: string[] = [];
    for (const step of plan.steps) {
      const hash = await wallet.sendTransaction({
        to: step.to,
        data: step.data,
        value: BigInt(step.value),
      });
      const receipt = await wallet.waitForTransactionReceipt(hash);
      if (receipt?.status && receipt.status !== "success") {
        return `Error: step "${step.description}" failed (tx ${hash}). Completed before it: ${hashes.join(", ") || "none"}.`;
      }
      hashes.push(hash);
    }
    return [
      plan.summary,
      ...plan.warnings.map(w => `Note: ${w}`),
      `Transactions: ${hashes.join(", ")}`,
    ].join("\n");
  }

  /**
   * Runs an action and turns any error into a readable message.
   *
   * @param fn - The action body
   * @returns The action result, or an error message
   */
  private async safely(fn: () => Promise<string>): Promise<string> {
    try {
      return await fn();
    } catch (error) {
      return `Error: ${error instanceof BasedLoansError ? error.message : explainError(error).message}`;
    }
  }
}

/**
 * Creates a Based Loans action provider.
 *
 * @param options - Optional SDK settings, such as a custom Base RPC URL
 * @returns A new BasedLoansActionProvider
 */
export const basedLoansActionProvider = (options: BasedLoansOptions = {}) =>
  new BasedLoansActionProvider(options);
