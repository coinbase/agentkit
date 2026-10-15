import { z } from "zod";
// EvmWalletProvider must be a VALUE import: @CreateAction reads the parameter
// type from decorator metadata to decide whether to pass the wallet.
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { KeeperHubClient, deriveIdempotencyKey } from "./keeperHubClient";
import { TransferSchema, GetExecutionStatusSchema } from "./schemas";
import { NETWORK_ID_TO_CHAIN_ID, SUPPORTED_CHAIN_IDS } from "./constants";

export interface KeeperHubActionProviderConfig {
  /** Organisation API key, prefixed `kh_`. Default: process.env.KEEPERHUB_API_KEY */
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /**
   * Extra attempts for get_execution_status, and for a transfer answered with
   * 409 "already being processed" (same key, so it cannot execute twice). Default 3.
   */
  statusRetries?: number;
  retryDelayMs?: number;
}

/**
 * Runs onchain actions through KeeperHub instead of signing them locally.
 *
 * Three things set it apart from AgentKit's ordinary wallet path:
 *
 * 1. SIMULATION AS A GATE. Every write is simulated first and aborted on
 *    `wouldRevert`. The simulate flag is written by code, not by the model, and
 *    cannot be switched off through input.
 *
 * 2. IDEMPOTENCY DERIVED FROM THE WORK. The key is computed from `taskId` plus
 *    the fields that determine the onchain effect. Retrying the same work yields
 *    the same key, so it is replayed instead of executed twice.
 *
 * 3. AN OUTCOME YOU CAN ASK FOR AGAIN. Every execution returns an `executionId`.
 *    After any failure, `get_execution_status` answers "what actually happened"
 *    with receipts re-read from chain. The local wallet path has no equivalent:
 *    a failed action returns only error text, with no identifier to ask about again.
 */
export class KeeperHubActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly #client: KeeperHubClient;
  readonly #inProgressRetries: number;
  readonly #retryDelayMs: number;

  /**
   * Creates the provider.
   *
   * @param config - API key (default: KEEPERHUB_API_KEY), base URL, timeout and retry settings
   */
  constructor(config: KeeperHubActionProviderConfig = {}) {
    super("keeperhub", []);
    const apiKey = config.apiKey ?? process.env.KEEPERHUB_API_KEY ?? "";
    this.#client = new KeeperHubClient({
      apiKey,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      statusRetries: config.statusRetries,
      retryDelayMs: config.retryDelayMs,
    });
    this.#inProgressRetries = config.statusRetries ?? 3;
    this.#retryDelayMs = config.retryDelayMs ?? 1_000;
  }

  /**
   * Simulates, then executes a transfer once through KeeperHub.
   *
   * @param walletProvider - Used only to read the current network
   * @param args - Recipient, amount, optional token and the taskId of the work
   * @returns A message with the executionId, or why nothing was sent
   */
  @CreateAction({
    name: "transfer",
    description: `
Send tokens through KeeperHub rather than through the local wallet.

The order is always: simulate, abort if it would revert, then execute once with
an idempotency key derived from taskId.

Inputs:
- recipientAddress: the 0x… recipient address
- amount: whole units, for example "1.5", NOT wei
- tokenAddress: the ERC-20 contract address; omit for the native token
- taskId: a stable identifier for this work, for example an invoice number

Important:
- Use the SAME taskId when retrying the same work. That is what prevents paying
  twice.
- Use a DIFFERENT taskId for payments that really are different.

taskId is the DURABLE handle, not executionId. executionId arrives inside the
response, and the response is exactly what gets lost when something goes wrong.
If the response is lost, call this action again with the same taskId: the same
key is derived and the same executionId comes back without executing again.

Keep both if you can. If you can keep only one, keep taskId.

Limit: recovery through taskId lasts 24 hours. After that the same key will
EXECUTE AGAIN, not replay. For work that can outlive a day, put a time bucket in
the taskId.
`,
    schema: TransferSchema,
  })
  async transfer(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TransferSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const chainId = network.chainId
      ? Number(network.chainId)
      : NETWORK_ID_TO_CHAIN_ID[network.networkId ?? ""];

    if (!chainId) {
      return `Error: cannot determine chainId from network ${JSON.stringify(network)}.`;
    }
    if (!(SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId)) {
      // Refused here, not at the server. KeeperHub answers 503 for unsupported
      // chains, which looks like a transient outage and invites endless retries.
      return `Error: KeeperHub does not support chainId ${chainId}. Supported: ${SUPPORTED_CHAIN_IDS.join(", ")}.`;
    }

    const body: Record<string, unknown> = {
      chainId,
      recipientAddress: args.recipientAddress,
      amount: args.amount,
      ...(args.tokenAddress ? { tokenAddress: args.tokenAddress } : {}),
    };

    const sim = await this.#client.simulateTransfer(body);
    if (!sim.success || sim.wouldRevert) {
      const why = sim.revertReason ?? sim.error ?? "no reason given";
      // Kept distinct because the consequences differ: bad input must not be
      // retried as-is, while a chain-state problem may be retried later.
      const kind =
        sim.failureKind === "validation" ? "Input rejected" : "Simulation predicts a revert";
      return `Aborted before broadcast. ${kind}: ${why}. No transaction was sent and no gas was spent.`;
    }

    const idempotencyKey = deriveIdempotencyKey({
      taskId: args.taskId,
      chainId,
      recipientAddress: args.recipientAddress,
      amount: args.amount,
      tokenAddress: args.tokenAddress,
    });

    // A 409 other than idempotency_conflict means the same key is still being
    // processed ("Retry the same key shortly; do not rotate it"). This cost the
    // unresolved trial in the 0.9.1 run: we gave up and had no executionId.
    // Retrying the SAME key is safe: it cannot execute twice.
    let exec = await this.#client.executeTransfer(body, idempotencyKey);
    for (
      let i = 0;
      i < this.#inProgressRetries &&
      exec.httpStatus === 409 &&
      exec.code !== "idempotency_conflict";
      i++
    ) {
      await new Promise(r => setTimeout(r, this.#retryDelayMs * 2 ** i));
      exec = await this.#client.executeTransfer(body, idempotencyKey);
    }

    if (exec.code === "idempotency_conflict") {
      return `Error: taskId "${args.taskId}" was already used for work with different details. Use a new taskId for different work, and the same taskId only to retry the same work.`;
    }
    if (exec.httpStatus >= 400 || !exec.executionId) {
      return `Error during execution (HTTP ${exec.httpStatus}): ${exec.error ?? "unknown"}. If an executionId is available, ask for its status before resending.`;
    }

    return [
      `Transfer handed to KeeperHub.`,
      `executionId: ${exec.executionId}`,
      `status: ${exec.status ?? "unknown"}`,
      exec.transactionHash ? `transactionHash: ${exec.transactionHash}` : null,
      exec.transactionLink ? `explorer: ${exec.transactionLink}` : null,
      `taskId: ${args.taskId}`,
      `Keep both. If anything fails after this point, call get_execution_status with the executionId, or call transfer again with the same taskId to get the executionId back. Do not use a new taskId.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Reports the outcome of an execution with receipts re-read from chain.
   *
   * @param _walletProvider - Unused
   * @param args - The executionId to ask about
   * @returns A message with the verified outcome, or that it is not yet known
   */
  @CreateAction({
    name: "get_execution_status",
    description: `
Ask what ACTUALLY happened to an execution, by executionId.

Use this whenever a transfer ends in an error, a timeout, or a lost response.
The receipts returned are re-read from chain, not self-reported, so they tell
apart three different states:

- succeeded : the transaction was mined and succeeded
- failed    : the transaction was mined but reverted
- pending   : not final yet; do NOT resend, the transaction may still land

Resending without asking this first is the most common way an agent pays twice.

If the executionId is lost, do not give up: call transfer again with the same
taskId to get it back (valid for 24 hours).
`,
    schema: GetExecutionStatusSchema,
  })
  async getExecutionStatus(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetExecutionStatusSchema>,
  ): Promise<string> {
    const st = await this.#client.getStatus(args.executionId);
    if (st.httpStatus === 0) {
      // No answer after every retry. That says nothing about the transfer.
      return [
        `executionId: ${args.executionId}`,
        `KeeperHub did not answer after ${st.attempts} attempts (${st.error}).`,
        `The outcome is NOT YET KNOWN, which is not the same as failed. Do not resend. Ask again later.`,
      ].join("\n");
    }
    if (st.httpStatus >= 400) {
      return `Error: cannot read status for ${args.executionId} (HTTP ${st.httpStatus}).`;
    }

    const verified = (st.receipts ?? []).filter(r => r.verified === true);
    if (verified.length === 0) {
      return [
        `executionId: ${st.executionId}`,
        `status: ${st.status}`,
        `No receipt has been verified onchain yet. The outcome is NOT YET KNOWN, which is not the same as failed.`,
        `Do not resend. Ask again shortly.`,
      ].join("\n");
    }

    const lines = verified.map(
      r =>
        `  hash ${r.hash} | ${r.receiptStatus ?? "?"} | block ${r.blockNumber ?? "?"} | gasUsed ${r.gasUsed ?? "?"} | verified ${r.verifiedAt ?? "?"}`,
    );
    const anyFailed = verified.some(r => r.receiptStatus && r.receiptStatus !== "success");

    return [
      `executionId: ${st.executionId}`,
      `status: ${st.status}`,
      `Verified onchain result (${verified.length} receipt${verified.length === 1 ? "" : "s"}):`,
      ...lines,
      anyFailed
        ? `Conclusion: the transaction was mined but REVERTED. No funds moved.`
        : `Conclusion: the transaction SUCCEEDED. Do not resend this work.`,
      st.transactionLink ? `explorer: ${st.transactionLink}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  supportsNetwork = (network: Network): boolean => {
    if (network.protocolFamily !== "evm") return false;
    const chainId = network.chainId
      ? Number(network.chainId)
      : NETWORK_ID_TO_CHAIN_ID[network.networkId ?? ""];
    return Boolean(chainId) && (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
  };
}

export const keeperHubActionProvider = (config: KeeperHubActionProviderConfig = {}) =>
  new KeeperHubActionProvider(config);
