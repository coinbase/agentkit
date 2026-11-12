import { z } from "zod";
import {
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  keccak256,
  parseEventLogs,
  toBytes,
  verifyMessage,
  Hex,
} from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  FindServiceSchema,
  RouteTaskSchema,
  PlaceOrderSchema,
  GetOrderSchema,
  ClaimListingSchema,
  VerifySchema,
  RefundSchema,
} from "./schemas";
import {
  AGENTCOIN_CAIP2,
  AGENTCOIN_CHAIN_ID,
  AGENTCOIN_DEFAULT_MAX_PAYMENT,
  AGENTCOIN_DEFAULT_URL,
  AGENTCOIN_ESCROW,
  AGENTCOIN_OPERATOR_SIGNER,
  AGENTCOIN_SUPPORTED_NETWORKS,
  AGENTCOIN_USDC,
  ERC20_APPROVE_ABI,
  ESCROW_ABI,
  ESCROW_STATES,
} from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

/**
 * Configuration for the AgentCoin action provider.
 */
export interface AgentCoinConfig {
  /** Router base URL. Defaults to AGENTCOIN_URL or https://agentcoinhq.com. */
  baseUrl?: string;
  /** Per-order payment ceiling in USDC base units. Defaults to 50000 (0.05 test USDC). */
  maxPayment?: bigint | string | number;
  /** If set, orders are only placed for these listing ids. */
  allowedServiceIds?: string[];
  /** Timeout for each router request in milliseconds. Defaults to 90000. */
  requestTimeoutMs?: number;
}

/**
 * RFC 8785 (JCS) canonical JSON for plain JSON values.
 *
 * @param value - The JSON value to canonicalize.
 * @returns The canonical JSON string.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("non-finite number cannot be canonicalized");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  }
  const entries = Object.keys(value as Json)
    .filter(k => (value as Json)[k] !== undefined)
    .sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson((value as Json)[k])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Checks an AgentCoin EIP-191 document signature: personal_sign over keccak256(RFC 8785(document without "signature")).
 *
 * @param doc - The signed document.
 * @returns Whether the signature is valid, the recovered signer and whether it is the AgentCoin operator.
 */
export async function verifyAgentCoinSignature(doc: Json | null | undefined): Promise<Json> {
  const sig = doc?.signature;
  if (!sig || sig.scheme !== "eip191") return { valid: false, reason: "no eip191 signature" };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signature: _signature, ...unsigned } = doc as Json;
  const digest = keccak256(toBytes(canonicalJson(unsigned)));
  if (sig.signedDigest && String(sig.signedDigest).toLowerCase() !== digest.toLowerCase()) {
    return { valid: false, digest, reason: "digest mismatch (document modified)" };
  }
  const valid = await verifyMessage({
    address: getAddress(sig.signer),
    message: { raw: digest },
    signature: sig.value as Hex,
  });
  const signer = getAddress(sig.signer);
  return {
    valid,
    signer,
    signerIsOperator: signer === getAddress(AGENTCOIN_OPERATOR_SIGNER),
    digest,
  };
}

/**
 * AgentCoinActionProvider lets an agent find paid agent services, pay them through an escrow that
 * releases funds only on a staked evaluator's delivery verdict, and claim refunds. Base Sepolia testnet only.
 */
export class AgentCoinActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPayment: bigint;
  private readonly allowedServiceIds: Set<string> | null;
  private readonly requestTimeoutMs: number;

  /**
   * Constructs a new AgentCoinActionProvider.
   *
   * @param config - Optional configuration.
   */
  constructor(config: AgentCoinConfig = {}) {
    super("agentcoin", []);
    this.baseUrl = (config.baseUrl ?? process.env.AGENTCOIN_URL ?? AGENTCOIN_DEFAULT_URL).replace(
      /\/+$/,
      "",
    );
    this.maxPayment = BigInt(config.maxPayment ?? AGENTCOIN_DEFAULT_MAX_PAYMENT);
    this.allowedServiceIds = config.allowedServiceIds ? new Set(config.allowedServiceIds) : null;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 90_000;
  }

  /**
   * Searches the AgentCoin service index.
   *
   * @param args - The search arguments.
   * @returns The search results as stringified JSON.
   */
  @CreateAction({
    name: "find_service",
    description: `Searches the AgentCoin index of paid agent services (A2A, MCP, x402, ERC-8004).
With id: returns one listing with skills, prices, request formats and delivery score.
Inputs: id, q (text), protocol, maxPrice (USDC base units), minScore (0-1), claimed, cursor, limit.
Read-only. Base Sepolia testnet.`,
    schema: FindServiceSchema,
  })
  async findService(args: z.infer<typeof FindServiceSchema>): Promise<string> {
    return this.run(async () => {
      if (args.id) return this.api("GET", `/v1/services/${encodeURIComponent(args.id)}`);
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && v !== null && k !== "id") qs.set(k, String(v));
      }
      const query = qs.toString();
      return this.api("GET", `/v1/services${query ? `?${query}` : ""}`);
    });
  }

  /**
   * Ranks candidate sellers for a task.
   *
   * @param args - The task and constraints.
   * @returns Ranked candidates as stringified JSON.
   */
  @CreateAction({
    name: "route_task",
    description: `Returns ranked candidate sellers for a task and budget, with quote, request template,
delivery score and supported order modes. No payment. Read-only. Base Sepolia testnet.`,
    schema: RouteTaskSchema,
  })
  async routeTask(args: z.infer<typeof RouteTaskSchema>): Promise<string> {
    return this.run(async () => {
      const { task, budget, ...constraints } = args;
      return this.api("POST", "/v1/route", {
        task,
        ...(budget ? { budget } : {}),
        constraints: { network: AGENTCOIN_CAIP2, ...constraints },
      });
    });
  }

  /**
   * Places an escrowed order and funds it from the wallet.
   *
   * @param walletProvider - The wallet provider that pays for the order.
   * @param args - The order arguments.
   * @returns The order, funding transactions and seller response as stringified JSON.
   */
  @CreateAction({
    name: "place_order",
    description: `Places an escrowed order for an AgentCoin listing and funds it from the wallet.
Test USDC is held in the JobEscrow contract until a staked evaluator rules on delivery: paid to the
seller if delivered, refunded to the buyer if not (or if no verdict arrives in time).
Sends 2 transactions (USDC approve, createAndFundFor), records the job with the router and calls the seller.
The amount is capped by the provider's maxPayment (default 0.05 test USDC).
Inputs: serviceId, optional skillId, optional body (JSON sent to the seller). Base Sepolia testnet.`,
    schema: PlaceOrderSchema,
  })
  async placeOrder(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PlaceOrderSchema>,
  ): Promise<string> {
    return this.run(async () => {
      this.assertServiceAllowed(args.serviceId);
      const me = getAddress(walletProvider.getAddress());
      const order = await this.api("POST", "/v1/orders", {
        serviceId: args.serviceId,
        ...(args.skillId ? { skillId: args.skillId } : {}),
        mode: "escrow",
        buyer: me,
      });
      const txs = this.checkEscrowOrder(order, me);

      const sent: { label: string; hash: Hex }[] = [];
      let jobId: string | null = null;
      for (const tx of txs) {
        const hash = await walletProvider.sendTransaction({
          to: getAddress(tx.to),
          data: tx.data as Hex,
          value: 0n,
        });
        const receipt = await walletProvider.waitForTransactionReceipt(hash);
        if (receipt?.status !== "success")
          throw new Error(`${tx.label ?? "transaction"} reverted: ${hash}`);
        sent.push({ label: tx.label ?? "", hash });
        const created = parseEventLogs({
          abi: ESCROW_ABI,
          logs: receipt.logs ?? [],
          eventName: "JobCreated",
        }).find(l => getAddress(l.address) === getAddress(AGENTCOIN_ESCROW));
        if (created) jobId = created.args.jobId.toString();
      }
      if (!jobId) throw new Error("no JobCreated event in the funding transaction");
      const fundTx = sent[sent.length - 1].hash;
      const recorded = await this.api(
        "POST",
        `/v1/orders/${encodeURIComponent(order.orderId)}/receipt`,
        {
          jobId,
          paymentTx: fundTx,
        },
      );

      let seller: Json | null = null;
      const call = order.sellerCall;
      if (call?.url) {
        const header = Buffer.from(
          JSON.stringify({
            x402Version: 2,
            accepted: { scheme: "agentcoin-escrow", network: AGENTCOIN_CAIP2 },
            payload: { jobId, txHash: fundTx },
          }),
        ).toString("base64");
        const response = await fetch(call.url, {
          method: call.method ?? "POST",
          headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": header },
          ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });
        const text = await response.text();
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          // non-JSON seller response
        }
        seller = { status: response.status, body };
      }

      return {
        orderId: order.orderId,
        serviceId: order.serviceId,
        mode: "escrow",
        amount: String(order.escrow.amount),
        jobId,
        transactions: sent,
        status: recorded?.status ?? null,
        verdict: recorded?.verdict ?? null,
        seller,
        next: "Call get_order to read the verdict; call refund if the job was not delivered.",
        testnet: true,
      };
    });
  }

  /**
   * Returns an order's status.
   *
   * @param args - The order id.
   * @returns The order as stringified JSON.
   */
  @CreateAction({
    name: "get_order",
    description: `Returns an AgentCoin order's status, payment transaction, escrow job state, deliverable hash,
verdict and operator-signed delivery record. Escrow orders are refreshed from chain, which can take up to a minute.
Read-only.`,
    schema: GetOrderSchema,
  })
  async getOrder(args: z.infer<typeof GetOrderSchema>): Promise<string> {
    return this.run(() => this.api("GET", `/v1/orders/${encodeURIComponent(args.orderId)}`));
  }

  /**
   * Seller side: indexes and/or claims a listing.
   *
   * @param walletProvider - The wallet provider used to sign the claim.
   * @param args - The claim arguments.
   * @returns The claim result as stringified JSON.
   */
  @CreateAction({
    name: "claim_listing",
    description: `Seller side. url: indexes a public metadata document (A2A agent card, x402 resource, MCP server card,
ERC-8004 registration). serviceId: returns the claim challenge; sign=true signs the EIP-712 claim with the wallet
(which must be the listing's payTo or ERC-8004 owner); method=well-known checks /.well-known/agentcoin-claim.`,
    schema: ClaimListingSchema,
  })
  async claimListing(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ClaimListingSchema>,
  ): Promise<string> {
    return this.run(async () => {
      const claimant = getAddress(walletProvider.getAddress());
      let serviceId = args.serviceId;
      let submitted: Json | null = null;
      if (!serviceId && args.url) {
        submitted = await this.api("POST", "/v1/services", { url: args.url });
        serviceId = submitted?.listing?.id;
      }
      if (!serviceId) throw new Error("serviceId or url required");
      const id = encodeURIComponent(serviceId);
      let claim: Json;
      if (args.method === "well-known") {
        claim = await this.api("POST", `/v1/services/${id}/claim/verify`, {
          method: "well-known",
          claimant,
        });
      } else if (!args.sign) {
        claim = await this.api("POST", `/v1/services/${id}/claim`, { claimant });
      } else {
        const listing = await this.api("GET", `/v1/services/${id}`);
        const metadataHash = listing.metadataHash;
        if (!/^0x[0-9a-fA-F]{64}$/.test(String(metadataHash ?? ""))) {
          throw new Error("listing has no metadataHash");
        }
        const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const signature = await walletProvider.signTypedData({
          domain: { name: "AgentCoin Index", version: "1", chainId: AGENTCOIN_CHAIN_ID },
          types: {
            Claim: [
              { name: "serviceId", type: "string" },
              { name: "claimant", type: "address" },
              { name: "metadataHash", type: "bytes32" },
              { name: "expiresAt", type: "uint256" },
            ],
          },
          primaryType: "Claim",
          message: { serviceId, claimant, metadataHash, expiresAt },
        });
        claim = await this.api("POST", `/v1/services/${id}/claim/verify`, {
          claimant,
          expiresAt: expiresAt.toString(),
          signature,
        });
      }
      return submitted ? { submitted, claim } : claim;
    });
  }

  /**
   * Verifies AgentCoin signatures locally.
   *
   * @param args - The listing and/or order to verify.
   * @returns The verification results as stringified JSON.
   */
  @CreateAction({
    name: "verify",
    description: `Checks AgentCoin signatures locally. serviceId: the EIP-191 signed delivery score and its evidence root.
orderId: the operator-signed delivery record of an order. Returns signer, validity and whether the signer is the
AgentCoin operator. Read-only.`,
    schema: VerifySchema,
  })
  async verify(args: z.infer<typeof VerifySchema>): Promise<string> {
    return this.run(async () => {
      if (!args.serviceId && !args.orderId) throw new Error("serviceId or orderId required");
      const out: Json = {};
      if (args.serviceId) {
        const rep = await this.api("GET", `/v1/reputation/${encodeURIComponent(args.serviceId)}`);
        const signature = rep.score
          ? await verifyAgentCoinSignature(rep.score)
          : { valid: false, reason: "no score" };
        const evidenceRootMatches =
          Array.isArray(rep.evidence) && rep.score?.evidenceRoot
            ? keccak256(toBytes(canonicalJson(rep.evidence))) === rep.score.evidenceRoot
            : false;
        out.service = {
          serviceId: args.serviceId,
          score: rep.score ?? null,
          signature,
          evidenceRootMatches,
        };
      }
      if (args.orderId) {
        const o = await this.api("GET", `/v1/orders/${encodeURIComponent(args.orderId)}`);
        out.order = {
          orderId: o.orderId,
          status: o.status,
          verdict: o.verdict,
          deliverableHash: o.deliverableHash,
          deliveryRecord: o.deliveryRecord
            ? await verifyAgentCoinSignature(o.deliveryRecord)
            : { valid: false, reason: "no delivery record" },
        };
      }
      return out;
    });
  }

  /**
   * Sends the escrow refund-path call that applies to a job.
   *
   * @param walletProvider - The wallet provider that sends the call.
   * @param args - The order or job id.
   * @returns The refund result as stringified JSON.
   */
  @CreateAction({
    name: "refund",
    description: `Escrow orders: reads the JobEscrow job state and sends the refund-path call that applies
(cancel before the seller accepts, claimRefund after the deadline, timeoutRelease after a missed verdict,
finalize after the challenge window). Simulates first and returns the reason when no call applies.
Inputs: orderId or jobId. Base Sepolia testnet.`,
    schema: RefundSchema,
  })
  async refund(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RefundSchema>,
  ): Promise<string> {
    return this.run(async () => {
      let jobId = args.jobId;
      if (!jobId && args.orderId) {
        jobId = (await this.api("GET", `/v1/orders/${encodeURIComponent(args.orderId)}`)).jobId;
      }
      if (!jobId) throw new Error("jobId, or orderId of an escrow order, required");
      const job = (await walletProvider.readContract({
        address: AGENTCOIN_ESCROW,
        abi: ESCROW_ABI,
        functionName: "getJob",
        args: [BigInt(jobId)],
      })) as Json;
      const state = ESCROW_STATES[Number(job.state)];
      const now = BigInt(Math.floor(Date.now() / 1000));
      let fn: "cancel" | "claimRefund" | "timeoutRelease" | "finalize" | null = null;
      if (state === "Funded" && !job.accepted) fn = "cancel";
      else if (state === "Funded" && now >= BigInt(job.deadline)) fn = "claimRefund";
      else if (state === "Submitted") fn = "timeoutRelease";
      else if (state === "Rejected" || state === "Partial" || state === "Completed")
        fn = "finalize";
      if (!fn) return { jobId, state, sent: false, reason: `no refund action for state ${state}` };
      const me = getAddress(walletProvider.getAddress());
      if (fn === "cancel" && getAddress(job.client) !== me) {
        return { jobId, state, sent: false, reason: "cancel is callable by the job client only" };
      }
      try {
        await walletProvider.getPublicClient().simulateContract({
          account: me,
          address: AGENTCOIN_ESCROW,
          abi: ESCROW_ABI,
          functionName: fn,
          args: [BigInt(jobId)],
        });
      } catch (e) {
        const err = e as { shortMessage?: string; message?: string };
        return {
          jobId,
          state,
          action: fn,
          sent: false,
          reason: `simulation reverted: ${err.shortMessage ?? err.message}`,
        };
      }
      const hash = await walletProvider.sendTransaction({
        to: AGENTCOIN_ESCROW,
        data: encodeFunctionData({ abi: ESCROW_ABI, functionName: fn, args: [BigInt(jobId)] }),
        value: 0n,
      });
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      return { jobId, state, action: fn, sent: true, tx: hash, status: receipt?.status ?? null };
    });
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True for Base Sepolia only.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    (AGENTCOIN_SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId ?? "");

  /**
   * Checks the router's unsigned escrow transactions against local constants before signing them.
   *
   * @param order - The order returned by the router.
   * @param me - The buyer address.
   * @returns The two transactions to send.
   */
  private checkEscrowOrder(order: Json, me: Hex): Json[] {
    const e = order?.escrow ?? {};
    const usdc = getAddress(AGENTCOIN_USDC);
    const escrow = getAddress(AGENTCOIN_ESCROW);
    if (Number(e.chainId) !== AGENTCOIN_CHAIN_ID)
      throw new Error(`escrow chainId ${e.chainId} is not 84532`);
    if (!e.contract || getAddress(e.contract) !== escrow)
      throw new Error(`unexpected escrow contract ${e.contract}`);
    if (!e.token || getAddress(e.token) !== usdc)
      throw new Error(`unexpected payment token ${e.token}`);
    const amount = BigInt(e.amount ?? 0);
    if (amount <= 0n) throw new Error("order has no escrow amount");
    if (amount > this.maxPayment)
      throw new Error(`amount ${amount} exceeds maxPayment ${this.maxPayment}`);
    const txs: Json[] = order.transactions ?? [];
    if (txs.length !== 2) throw new Error("expected 2 escrow transactions");
    const [approveTx, fundTx] = txs;
    if (getAddress(approveTx.to) !== usdc || BigInt(approveTx.value ?? 0) !== 0n) {
      throw new Error("approve transaction target or value mismatch");
    }
    const ap = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data: approveTx.data });
    if (
      ap.functionName !== "approve" ||
      getAddress(ap.args[0]) !== escrow ||
      ap.args[1] !== amount
    ) {
      throw new Error("approve must be approve(escrow, amount)");
    }
    if (getAddress(fundTx.to) !== escrow || BigInt(fundTx.value ?? 0) !== 0n) {
      throw new Error("funding transaction target or value mismatch");
    }
    const cf = decodeFunctionData({ abi: ESCROW_ABI, data: fundTx.data });
    if (cf.functionName !== "createAndFundFor")
      throw new Error("funding transaction must be createAndFundFor");
    const [client, provider, evaluator, fundAmount] = cf.args as readonly [
      Hex,
      Hex,
      Hex,
      bigint,
      bigint,
      Hex,
    ];
    if (getAddress(client) !== me) throw new Error("createAndFundFor client is not this wallet");
    if (
      getAddress(provider) !== getAddress(e.provider) ||
      getAddress(evaluator) !== getAddress(e.evaluator) ||
      fundAmount !== amount
    ) {
      throw new Error("createAndFundFor arguments do not match the order's escrow terms");
    }
    return txs;
  }

  /**
   * Throws unless the listing is allowed by the provider configuration.
   *
   * @param serviceId - The listing id.
   */
  private assertServiceAllowed(serviceId: string): void {
    if (this.allowedServiceIds && !this.allowedServiceIds.has(serviceId)) {
      throw new Error(`serviceId ${serviceId} is not in allowedServiceIds`);
    }
  }

  /**
   * Calls the AgentCoin router.
   *
   * @param method - HTTP method.
   * @param path - Request path.
   * @param body - Optional JSON body.
   * @returns The parsed JSON response.
   */
  private async api(method: string, path: string, body?: unknown): Promise<Json> {
    const response = await fetch(this.baseUrl + path, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`${method} ${path} returned ${response.status}: ${json?.error ?? "error"}`);
    }
    return json ?? {};
  }

  /**
   * Runs an action body and serializes the result, returning errors as JSON.
   *
   * @param fn - The action body.
   * @returns The result as stringified JSON.
   */
  private async run(fn: () => Promise<Json>): Promise<string> {
    try {
      const result = await fn();
      return JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Factory function to create an AgentCoinActionProvider.
 *
 * @param config - Optional configuration.
 * @returns A new AgentCoinActionProvider.
 */
export const agentcoinActionProvider = (config: AgentCoinConfig = {}) =>
  new AgentCoinActionProvider(config);
