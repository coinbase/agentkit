import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { EmptySchema, RecordReceiptsSchema, VerifyReceiptSchema } from "./schemas";
import { SUPPORTED_NETWORKS, X402RECEIPTS_ENDPOINT } from "./constants";

/** Optional configuration. */
export interface X402ReceiptsConfig {
  /** Override the service endpoint (default https://app.x402receipts.com). */
  endpoint?: string;
}

/**
 * X402ReceiptsActionProvider lets an agent keep an accounting-grade record of its own x402
 * spending: every purchase is recorded on x402receipts as a receipt, reconciled there against
 * the on-chain payment and anchored with verifiable evidence. Recording costs USD 1 per wallet per
 * calendar month, paid by the agent's wallet over x402; the paying wallet becomes the account.
 */
export class X402ReceiptsActionProvider extends ActionProvider<WalletProvider> {
  private readonly endpoint: string;

  /**
   * Creates the provider.
   *
   * @param config - Optional configuration
   */
  constructor(config: X402ReceiptsConfig = {}) {
    super("x402receipts", []);
    this.endpoint = (config.endpoint ?? process.env.X402RECEIPTS_ENDPOINT ?? X402RECEIPTS_ENDPOINT).replace(/\/$/, "");
  }

  /**
   * Describes the service and its price without paying anything.
   *
   * @returns JSON string with endpoint, price and payment options
   */
  @CreateAction({
    name: "get_x402receipts_info",
    description:
      "Describe x402receipts (accounting and reconciliation for autonomous x402 spending): the recording endpoint, its price (USD 1 per wallet per calendar month in USDC on Base or Solana, unlimited receipts) and where the docs are. Pays nothing.",
    schema: EmptySchema,
  })
  async getInfo(): Promise<string> {
    const res = await fetch(`${this.endpoint}/api/v1/receipts`);
    const header = res.headers.get("payment-required");
    const challenge = header ? JSON.parse(Buffer.from(header, "base64").toString("utf8")) : null;
    return JSON.stringify(
      {
        endpoint: `${this.endpoint}/api/v1/receipts`,
        pricePerWalletPerMonthUsd: 1,
        accepts: challenge?.accepts ?? [],
        docs: `${this.endpoint}/llms.txt`,
        openapi: `${this.endpoint}/openapi.json`,
        verify: `${this.endpoint}/verify/{receiptId}`,
      },
      null,
      2,
    );
  }

  /**
   * Records purchases as receipts; the wallet's first upload of the month pays USD 1 over x402, later ones are free.
   *
   * @param walletProvider - The wallet that pays for the recording
   * @param args - The receipts to record
   * @returns JSON string with the service response and the settlement
   */
  @CreateAction({
    name: "record_x402_receipts",
    description:
      "Record one or more x402 purchases this agent made as receipts on x402receipts, so they are reconciled against the on-chain payments and available to finance as an auditable statement. Costs USD 1 per wallet per calendar month, paid by this wallet over x402 with the first upload of the month; later uploads are free. Call it after paid requests, with the resource, amount, payee, transaction reference and delivery status of each purchase.",
    schema: RecordReceiptsSchema,
  })
  async recordReceipts(walletProvider: WalletProvider, args: z.infer<typeof RecordReceiptsSchema>): Promise<string> {
    const client = await this.createX402Client(walletProvider);
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const res = await fetchWithPayment(`${this.endpoint}/api/v1/receipts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ receipts: args.receipts }),
    });
    const body = await res.json().catch(() => null);
    const header = res.headers.get("payment-response");
    const settlement = header ? JSON.parse(Buffer.from(header, "base64").toString("utf8")) : null;
    return JSON.stringify(
      {
        status: res.status,
        result: body,
        settlement: settlement ? { success: settlement.success, transaction: settlement.transaction, network: settlement.network, payer: settlement.payer } : null,
      },
      null,
      2,
    );
  }

  /**
   * Fetches the public verification material for a receipt.
   *
   * @param _walletProvider - Unused
   * @param args - The receipt id
   * @returns JSON string: receipt core, hash, Merkle path and the Hedera ledger entry
   */
  @CreateAction({
    name: "verify_x402_receipt",
    description:
      "Fetch the public verification material for one x402receipts receipt: its canonical fields and hash, the Merkle path to the batch root and the public ledger entry holding it. Pays nothing.",
    schema: VerifyReceiptSchema,
  })
  async verifyReceipt(_walletProvider: WalletProvider, args: z.infer<typeof VerifyReceiptSchema>): Promise<string> {
    const res = await fetch(`${this.endpoint}/api/v1/receipts/${encodeURIComponent(args.id)}/verify`);
    return await res.text();
  }

  /**
   * Checks if the provider supports the given network.
   *
   * @param network - The network to check
   * @returns True when the wallet can pay on Base or Solana
   */
  supportsNetwork = (network: Network) => (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId!);

  /**
   * Creates an x402 client for the wallet provider (same wiring as the x402 action provider).
   *
   * @param walletProvider - The wallet provider
   * @returns Configured x402Client
   */
  private async createX402Client(walletProvider: WalletProvider): Promise<x402Client> {
    const client = new x402Client();
    if (walletProvider instanceof EvmWalletProvider) {
      const account = walletProvider.toSigner();
      const signer = {
        ...account,
        readContract: (a: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }) =>
          walletProvider.readContract({ address: a.address, abi: a.abi as never, functionName: a.functionName as never, args: a.args as never }),
      };
      registerExactEvmScheme(client, { signer });
    } else if (walletProvider instanceof SvmWalletProvider) {
      const signer = await walletProvider.toSigner();
      registerExactSvmScheme(client, { signer });
    }
    return client;
  }
}

export const x402receiptsActionProvider = (config?: X402ReceiptsConfig) => new X402ReceiptsActionProvider(config);
