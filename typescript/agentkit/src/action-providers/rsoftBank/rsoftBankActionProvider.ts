import { randomBytes } from "crypto";
import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  CHAIN_ID,
  DEFAULT_BASE_URL,
  DEFAULT_TRUST_URL,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  LOAN_REQUEST_TYPES,
  SIGNATURE_TTL_SECONDS,
  VERIFYING_CONTRACT,
} from "./constants";
import {
  ConfirmRepaymentSchema,
  RequestLoanSchema,
  TrustScoreSchema,
  WalletArgSchema,
} from "./schemas";

/**
 * Configuration for {@link RsoftBankActionProvider}.
 */
export interface RsoftBankActionProviderConfig {
  /**
   * Bank API key — required for request_loan (money POSTs are fail-closed).
   * Read actions work without it.
   */
  apiKey?: string;
  /** Override the bank API base URL (default: production). */
  baseUrl?: string;
  /** Override the RSoft Trust API base URL (default: production). */
  trustApiUrl?: string;
}

/**
 * RsoftBankActionProvider gives an agent the full RSoft Agentic Bank credit
 * cycle on Base mainnet: check rates and credit history, vet counterparties
 * with AgentTrust-8004 trust scores, request real USDC loans — signing the
 * bank's EIP-712 LoanRequest struct natively with the agent's own wallet
 * provider — and confirm repayments. The bank never sees a private key: the
 * wallet signs, the provider transports.
 */
export class RsoftBankActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly trustUrl: string;
  private readonly apiKey?: string;

  /**
   * Constructor for the RsoftBankActionProvider class.
   *
   * @param config - Optional configuration (API key and URL overrides).
   */
  constructor(config: RsoftBankActionProviderConfig = {}) {
    super("rsoft-bank", []);
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.trustUrl = (config.trustApiUrl ?? DEFAULT_TRUST_URL).replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  /**
   * Gets RSoft Bank's current USDC lending rates and terms by risk tier.
   *
   * @param _walletProvider - The wallet provider (unused).
   * @returns A JSON string with the bank's rate table.
   */
  @CreateAction({
    name: "get_interest_rates",
    description:
      "Get RSoft Bank's current USDC lending rates and terms on Base mainnet, by risk tier (AAA to D). Use before requesting a loan.",
    schema: z.object({}),
  })
  async getInterestRates(_walletProvider: EvmWalletProvider): Promise<string> {
    return this.httpGet("/interest-rates");
  }

  /**
   * Gets the credit score, loan history and outstanding debt of an agent.
   *
   * @param walletProvider - The wallet provider (used for the default wallet).
   * @param args - Optional wallet address override.
   * @returns A JSON string with the agent's credit profile.
   */
  @CreateAction({
    name: "get_creditworthiness",
    description:
      "Credit score, loan history and outstanding debt of an agent at RSoft Bank. Defaults to the agent's own wallet. Use to know what the credit ladder will allow before borrowing.",
    schema: WalletArgSchema,
  })
  async getCreditworthiness(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WalletArgSchema>,
  ): Promise<string> {
    const wallet = args.wallet ?? walletProvider.getAddress();
    return this.httpGet(`/agents/${wallet}/creditworthiness`);
  }

  /**
   * Gets the AgentTrust-8004 on-chain trust score of any agent wallet.
   *
   * @param _walletProvider - The wallet provider (unused).
   * @param args - The wallet address to score.
   * @returns A JSON string with the trust score and anomaly flag.
   */
  @CreateAction({
    name: "get_trust_score",
    description:
      "On-chain trust score (0-100) of ANY agent wallet, from AgentTrust-8004 (model trained on the real ERC-8004 Base mainnet census). Includes an anomaly flag for incoherent profiles like reputation farming. Use to vet a counterparty before trading, lending or collaborating.",
    schema: TrustScoreSchema,
  })
  async getTrustScore(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof TrustScoreSchema>,
  ): Promise<string> {
    const res = await fetch(`${this.trustUrl}/score/${args.wallet}`);
    const text = await res.text();
    if (!res.ok) return `Trust API error ${res.status}: ${text.slice(0, 400)}`;
    return text;
  }

  /**
   * Requests a USDC loan, signing the bank's EIP-712 LoanRequest struct with
   * the agent's own wallet.
   *
   * @param walletProvider - The wallet provider that signs the request.
   * @param args - The loan amount in USDC.
   * @returns A JSON string with the loan request outcome.
   */
  @CreateAction({
    name: "request_loan",
    description:
      "Request a real USDC loan from RSoft Bank on Base mainnet. Signs the bank's EIP-712 LoanRequest struct with the agent's own wallet (the bank never originates unsigned loans) and submits it. On approval the bank disburses USDC to this wallet. Requires the provider to be configured with a bank API key.",
    schema: RequestLoanSchema,
  })
  async requestLoan(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RequestLoanSchema>,
  ): Promise<string> {
    if (!this.apiKey) {
      return (
        "RSoft Bank API key not configured. Loan origination is fail-closed: " +
        "construct rsoftBankActionProvider({ apiKey }) with a key issued by the bank."
      );
    }
    const agentWallet = walletProvider.getAddress();
    const nonce = "agentkit-" + randomBytes(8).toString("hex");
    const deadline = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS;

    const signature = await walletProvider.signTypedData({
      domain: {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId: CHAIN_ID,
        verifyingContract: VERIFYING_CONTRACT,
      },
      types: LOAN_REQUEST_TYPES,
      primaryType: "LoanRequest",
      message: {
        agentWallet,
        loanAmountUsdc6: BigInt(Math.round(args.amount * 1e6)),
        nonce,
        deadline: BigInt(deadline),
      },
    });

    return this.httpPost("/loan/request", {
      agent_wallet: agentWallet,
      loan_amount: args.amount,
      nonce,
      deadline,
      signature,
    });
  }

  /**
   * Gets what the agent owes, the treasury address to pay, and the request id.
   *
   * @param walletProvider - The wallet provider (used for the default wallet).
   * @param args - Optional wallet address override.
   * @returns A JSON string with the repayment details.
   */
  @CreateAction({
    name: "get_repayment_info",
    description:
      "What the agent owes RSoft Bank (principal + interest), the treasury address to pay, the USDC contract and the request_id needed to confirm. Use before repaying.",
    schema: WalletArgSchema,
  })
  async getRepaymentInfo(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WalletArgSchema>,
  ): Promise<string> {
    const wallet = args.wallet ?? walletProvider.getAddress();
    return this.httpGet(`/loan/repay-info/${wallet}`);
  }

  /**
   * Reports an on-chain USDC repayment so the bank verifies it on Base and
   * marks the loan repaid.
   *
   * @param _walletProvider - The wallet provider (unused).
   * @param args - The loan request id and the transfer tx hash.
   * @returns A JSON string with the confirmation outcome.
   */
  @CreateAction({
    name: "confirm_repayment",
    description:
      "After transferring the exact USDC amount on-chain to the bank treasury (use the erc20 transfer action with the details from get_repayment_info), report the tx hash so the bank verifies it on Base and marks the loan repaid — which raises the agent's credit ladder.",
    schema: ConfirmRepaymentSchema,
  })
  async confirmRepayment(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof ConfirmRepaymentSchema>,
  ): Promise<string> {
    return this.httpPost("/loan/repay", {
      request_id: args.requestId,
      tx_hash: args.txHash,
    });
  }

  /**
   * Checks if the provider supports the given network. The bank lends on Base
   * mainnet only.
   *
   * @param network - The network to check.
   * @returns True for Base mainnet, false otherwise.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    (network.chainId === String(CHAIN_ID) || network.networkId === "base-mainnet");

  /**
   * Performs a GET request against the bank API.
   *
   * @param path - The API path.
   * @returns The response body, or a formatted error string.
   */
  private async httpGet(path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${path}`);
    return this.render(res);
  }

  /**
   * Performs a POST request against the bank API.
   *
   * @param path - The API path.
   * @param body - The JSON body to send.
   * @returns The response body, or a formatted error string.
   */
  private async httpPost(path: string, body: unknown): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return this.render(res);
  }

  /**
   * Renders a fetch response as a string, prefixing errors with the status.
   *
   * @param res - The fetch response.
   * @returns The response text, or a formatted error string.
   */
  private async render(res: Response): Promise<string> {
    const text = await res.text();
    if (!res.ok) return `Bank API error ${res.status}: ${text.slice(0, 400)}`;
    return text;
  }
}

/**
 * Factory for {@link RsoftBankActionProvider}.
 *
 * @param config - Optional configuration (API key and URL overrides).
 * @returns A new RsoftBankActionProvider instance.
 */
export const rsoftBankActionProvider = (config: RsoftBankActionProviderConfig = {}) =>
  new RsoftBankActionProvider(config);
