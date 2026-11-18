import { PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import {
  DEFAULT_SAID_API_URL,
  MIN_REGISTER_AND_VERIFY_LAMPORTS,
  MIN_VERIFY_ONLY_LAMPORTS,
} from "./constants";
import {
  CheckAgentMessagesSchema,
  FindAgentsSchema,
  GetAgentReputationSchema,
  RegisterSaidIdentitySchema,
  SendAgentMessageSchema,
} from "./schemas";
import {
  buildGetVerifiedInstruction,
  buildRegisterAgentInstruction,
  deriveAgentIdentityPda,
  parseIsVerified,
} from "./utils";

/**
 * Configuration options for the SAID action provider.
 */
export interface SaidActionProviderConfig {
  /**
   * Base URL of the SAID Protocol API. Defaults to https://api.saidprotocol.com.
   */
  apiUrl?: string;
}

interface TrustResponse {
  wallet: string;
  tier: string;
  compositeScore: number;
  registered: boolean;
  verified: boolean;
  scored: boolean;
}

interface AgentListItem {
  name: string | null;
  description: string | null;
  wallet: string;
  isVerified: boolean;
  skills: string[];
  serviceTypes: string[];
  a2aEndpoint: string | null;
  mcpEndpoint: string | null;
  x402Wallet: string | null;
  reputation?: { tier: string; compositeScore: number; scored: boolean };
}

interface InboxResponse {
  messages: Array<{
    taskId: string;
    message: string;
    status: string;
    createdAt: string;
    from: { wallet: string; name: string; verified: boolean; reputation: number };
  }>;
  count: number;
}

/**
 * SaidActionProvider provides agent identity and reputation actions backed by the
 * SAID Protocol (https://saidprotocol.com) on Solana.
 *
 * SAID gives every agent wallet an on-chain identity and a reputation score derived
 * from observable behavior: x402 payments received, anchored work receipts, peer
 * feedback and attestations. Agents use it to check a counterparty's track record
 * before paying it, to discover reputable agents to hire, and to establish their own
 * verifiable identity.
 */
export class SaidActionProvider extends ActionProvider<SvmWalletProvider> {
  private readonly apiUrl: string;

  /**
   * Creates a new SaidActionProvider.
   *
   * @param config - Optional configuration (API base URL override)
   */
  constructor(config: SaidActionProviderConfig = {}) {
    super("said", []);
    this.apiUrl = (config.apiUrl ?? DEFAULT_SAID_API_URL).replace(/\/$/, "");
  }

  /**
   * Looks up the SAID reputation of any Solana wallet.
   *
   * @param walletProvider - The wallet provider (unused; this is a read-only lookup)
   * @param args - The wallet address to look up
   * @returns A human-readable reputation summary
   */
  @CreateAction({
    name: "get_agent_reputation",
    description: `
Looks up the SAID Protocol reputation of any Solana wallet address.
Use this BEFORE paying an unknown agent or service (e.g. via x402) to check its track record.
Returns the wallet's reputation tier, composite score (0-1), and whether it is a registered,
on-chain verified SAID agent.
A wallet with no SAID track record is not necessarily malicious — it is an UNKNOWN counterparty,
so apply the caution you would apply to a stranger.
`,
    schema: GetAgentReputationSchema,
  })
  async getAgentReputation(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof GetAgentReputationSchema>,
  ): Promise<string> {
    let wallet: PublicKey;
    try {
      wallet = new PublicKey(args.wallet);
    } catch {
      return `Error: ${args.wallet} is not a valid Solana address.`;
    }

    let trust: TrustResponse;
    try {
      trust = await this.fetchJson<TrustResponse>(`/api/trust/${wallet.toBase58()}`);
    } catch (error) {
      return `Error fetching SAID reputation: ${error}`;
    }

    if (!trust.scored && !trust.registered) {
      return (
        `${wallet.toBase58()} has no SAID identity or track record. ` +
        `Treat it as an unknown counterparty: it has not registered an on-chain identity ` +
        `and SAID has observed no payment, delivery or feedback history for it.`
      );
    }

    const lines = [
      `SAID reputation for ${wallet.toBase58()}:`,
      `- Tier: ${trust.tier} (composite score ${trust.compositeScore})`,
      `- Registered SAID agent: ${trust.registered ? "yes" : "no"}`,
      `- On-chain verified: ${trust.verified ? "yes" : "no"}`,
    ];
    if (!trust.scored) {
      lines.push(
        `- Note: registered but not yet scored — SAID has no behavioral history for this wallet yet.`,
      );
    }
    return lines.join("\n");
  }

  /**
   * Discovers SAID-registered agents, ranked by reputation.
   *
   * @param walletProvider - The wallet provider (unused; this is a read-only lookup)
   * @param args - Search filters (free-text query, skill, verified-only, limit)
   * @returns A ranked list of matching agents with their endpoints
   */
  @CreateAction({
    name: "find_agents",
    description: `
Discovers SAID-registered agents, ranked by reputation score.
Use this to find reputable agents to hire, pay (e.g. via x402) or communicate with.
Results include each agent's wallet, reputation tier, declared skills, and service
endpoints (A2A endpoint, MCP endpoint, x402 payment wallet) when the agent has published them.
`,
    schema: FindAgentsSchema,
  })
  async findAgents(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof FindAgentsSchema>,
  ): Promise<string> {
    const params = new URLSearchParams();
    if (args.query) params.set("search", args.query);
    if (args.skill) params.set("skill", args.skill);
    if (args.verifiedOnly !== false) params.set("verified", "true");
    params.set("limit", String(args.limit ?? 5));

    let agents: AgentListItem[];
    try {
      const response = await this.fetchJson<{ agents: AgentListItem[] }>(
        `/api/agents?${params.toString()}`,
      );
      agents = response.agents;
    } catch (error) {
      return `Error searching SAID agents: ${error}`;
    }

    if (!agents.length) {
      return "No SAID agents matched the search.";
    }

    const entries = agents.map((agent, i) => {
      const lines = [
        `${i + 1}. ${agent.name ?? "(unnamed)"} — ${agent.wallet}`,
        `   Reputation: ${agent.reputation?.scored ? `${agent.reputation.tier} (${agent.reputation.compositeScore})` : "not yet scored"}${agent.isVerified ? ", on-chain verified" : ""}`,
      ];
      if (agent.description) {
        lines.push(`   ${agent.description.slice(0, 160)}`);
      }
      if (agent.skills?.length) {
        lines.push(`   Skills: ${agent.skills.join(", ")}`);
      }
      const endpoints = [
        agent.a2aEndpoint ? `A2A: ${agent.a2aEndpoint}` : null,
        agent.mcpEndpoint ? `MCP: ${agent.mcpEndpoint}` : null,
        agent.x402Wallet ? `x402 wallet: ${agent.x402Wallet}` : null,
      ].filter(Boolean);
      if (endpoints.length) {
        lines.push(`   Endpoints: ${endpoints.join(" | ")}`);
      }
      return lines.join("\n");
    });

    return `Found ${agents.length} SAID agent(s), ranked by reputation:\n${entries.join("\n")}`;
  }

  /**
   * Registers and verifies the agent's own SAID identity on Solana. The agent's
   * wallet signs the transaction and pays for it (PDA rent + 0.01 SOL verification fee).
   *
   * @param walletProvider - The wallet provider used to sign and pay
   * @param args - The metadata URI describing this agent
   * @returns A message with the transaction signature, or an error message
   */
  @CreateAction({
    name: "register_said_identity",
    description: `
Registers THIS wallet as a SAID agent on Solana mainnet and verifies it on-chain.
This establishes a portable, verifiable identity: other agents can then look up this wallet's
reputation, which accrues automatically from observable behavior (x402 payments received,
anchored work receipts, peer feedback).
Costs are paid by this wallet: ~0.0035 SOL identity account rent plus a one-time 0.01 SOL
verification fee to the SAID treasury. The wallet must hold at least 0.015 SOL.
Requires a metadata URI describing the agent (an A2A agent card URL works well).
`,
    schema: RegisterSaidIdentitySchema,
  })
  async registerSaidIdentity(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof RegisterSaidIdentitySchema>,
  ): Promise<string> {
    try {
      const owner = walletProvider.getPublicKey();
      const connection = walletProvider.getConnection();
      const agentPda = deriveAgentIdentityPda(owner);

      // The on-chain account is the source of truth for the verified flag; the
      // indexer API can lag a fresh registration, and re-running get_verified on
      // an already-verified identity would pay the 0.01 SOL fee again.
      const existing = await connection.getAccountInfo(agentPda);
      if (existing && parseIsVerified(existing.data)) {
        return `This wallet already has a verified SAID identity (PDA ${agentPda.toBase58()}). Nothing to do.`;
      }

      const required = existing ? MIN_VERIFY_ONLY_LAMPORTS : MIN_REGISTER_AND_VERIFY_LAMPORTS;
      const balance = await connection.getBalance(owner);
      if (balance < required) {
        return (
          `Error: insufficient balance to ${existing ? "verify" : "register and verify"} a SAID identity. ` +
          `Need at least ${required / 1e9} SOL (verification fee + ${existing ? "fees" : "account rent + fees"}), ` +
          `wallet holds ${balance / 1e9} SOL.`
        );
      }

      const instructions = existing
        ? [buildGetVerifiedInstruction(owner, owner)]
        : [
            buildRegisterAgentInstruction(owner, args.metadataUri),
            buildGetVerifiedInstruction(owner, owner),
          ];

      const { blockhash } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: owner,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();
      const transaction = new VersionedTransaction(message);

      const signature = await walletProvider.signAndSendTransaction(transaction);
      try {
        await walletProvider.waitForSignatureResult(signature);
      } catch (waitError) {
        // Confirmation polling can time out (e.g. blockhash expiry on a slow RPC)
        // even though the transaction landed. Check the signature status before
        // reporting failure so a landed transaction is never reported as an error.
        const landed = await this.signatureLanded(connection, signature);
        if (!landed) {
          throw waitError;
        }
      }

      return (
        `Successfully ${existing ? "verified" : "registered and verified"} this wallet's SAID identity.\n` +
        `- Agent identity PDA: ${agentPda.toBase58()}\n` +
        `- Transaction: ${signature}\n` +
        `Reputation now accrues automatically from this wallet's behavior (x402 payments received, ` +
        `work receipts, peer feedback). Other agents can check it via get_agent_reputation.`
      );
    } catch (error) {
      return `Error registering SAID identity: ${error}`;
    }
  }

  /**
   * Sends an agent-to-agent message to another SAID agent through the SAID relay.
   * The relay requires the sender (this wallet) to be a registered SAID agent and
   * delivers to the recipient's SAID mailbox, so the recipient does not need to run
   * its own A2A endpoint.
   *
   * @param walletProvider - The wallet provider; its public key is the sender
   * @param args - Recipient wallet, message text, and optional structured context
   * @returns A message with the relay task id, or an error message
   */
  @CreateAction({
    name: "send_agent_message",
    description: `
Sends an agent-to-agent (A2A) message to another SAID-registered agent through the SAID relay.
THIS wallet must be a registered SAID agent (use register_said_identity first) — the relay
records the sender's verification and reputation alongside the message.
The recipient does not need to run its own server: every SAID agent has a relay mailbox.
Use find_agents to discover recipients and get_agent_reputation to vet them before messaging.
Returns a task id the recipient can act on and report results against.
`,
    schema: SendAgentMessageSchema,
  })
  async sendAgentMessage(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof SendAgentMessageSchema>,
  ): Promise<string> {
    let toWallet: PublicKey;
    try {
      toWallet = new PublicKey(args.toWallet);
    } catch {
      return `Error: ${args.toWallet} is not a valid Solana address.`;
    }

    const from = walletProvider.getPublicKey().toBase58();

    // Sign the message so the relay can prove this wallet is the real sender;
    // without it the recipient sees the message as an unauthenticated, no-trust
    // message. Some wallet providers cannot sign arbitrary messages — in that
    // case we still send, just unauthenticated.
    let signature: string | undefined;
    let timestamp: number | undefined;
    try {
      timestamp = Date.now();
      const payload = `SAID-A2A:${from}:${toWallet.toBase58()}:${timestamp}:${args.message}`;
      const sigBytes = await walletProvider.signMessage(new TextEncoder().encode(payload));
      signature = bs58.encode(sigBytes);
    } catch {
      signature = undefined;
      timestamp = undefined;
    }

    try {
      const response = await fetch(`${this.apiUrl}/a2a/${toWallet.toBase58()}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          message: args.message,
          context: args.context,
          signature,
          timestamp,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        taskId?: string;
        status?: string;
        error?: string;
      };
      if (!response.ok) {
        if (response.status === 403) {
          return `Cannot send: this wallet (${from}) is not registered on SAID. Register it first with register_said_identity.`;
        }
        if (response.status === 404) {
          return `Cannot send: ${toWallet.toBase58()} is not a registered SAID agent.`;
        }
        return `Error sending message: ${body.error ?? `SAID relay returned ${response.status}`}`;
      }
      return (
        `Message sent to ${toWallet.toBase58()} via the SAID relay${signature ? "" : " (unauthenticated — this wallet could not sign)"}.\n` +
        `- Task id: ${body.taskId}\n` +
        `- Status: ${body.status}\n` +
        `The recipient can read it from its SAID inbox and report results against this task id.`
      );
    } catch (error) {
      return `Error sending message: ${error}`;
    }
  }

  /**
   * Reads incoming A2A messages addressed to this wallet from its SAID mailbox.
   *
   * @param walletProvider - The wallet provider; its public key is the inbox owner
   * @param args - Optional status filter and result limit
   * @returns A human-readable list of incoming messages with sender reputation
   */
  @CreateAction({
    name: "check_agent_messages",
    description: `
Reads incoming agent-to-agent (A2A) messages addressed to THIS wallet from its SAID mailbox.
Each message includes the sender's wallet, name, SAID verification status and reputation score,
so this agent can decide whether to act on a request based on who sent it.
`,
    schema: CheckAgentMessagesSchema,
  })
  async checkAgentMessages(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof CheckAgentMessagesSchema>,
  ): Promise<string> {
    const self = walletProvider.getPublicKey().toBase58();
    const params = new URLSearchParams();
    params.set("limit", String(args.limit ?? 20));
    if (args.status) params.set("status", args.status);

    let inbox: InboxResponse;
    try {
      inbox = await this.fetchJson<InboxResponse>(`/a2a/${self}/inbox?${params.toString()}`);
    } catch (error) {
      return `Error reading inbox: ${error}`;
    }

    if (!inbox.messages.length) {
      return "No incoming agent messages.";
    }

    const entries = inbox.messages.map((m, i) => {
      const rep = m.from.verified
        ? `verified, reputation ${m.from.reputation}`
        : "unverified sender";
      return (
        `${i + 1}. from ${m.from.name} (${m.from.wallet}) — ${rep}\n` +
        `   [${m.status}] task ${m.taskId}: ${m.message}`
      );
    });

    return `${inbox.count} incoming message(s):\n${entries.join("\n")}`;
  }

  /**
   * Checks if the action provider supports the given network.
   * Registration is a Solana mainnet transaction; reputation data covers mainnet agents.
   *
   * @param network - The network to check support for
   * @returns True if the network is Solana mainnet
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "svm" && network.networkId === "solana-mainnet";
  }

  /**
   * Checks whether a signature landed successfully, retrying briefly to allow
   * for RPC propagation.
   *
   * @param connection - The Solana connection
   * @param signature - The transaction signature to check
   * @returns True if the transaction is confirmed or finalized without error
   */
  private async signatureLanded(
    connection: ReturnType<SvmWalletProvider["getConnection"]>,
    signature: string,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const status = value[0];
      if (
        status &&
        status.err === null &&
        (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")
      ) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false;
  }

  /**
   * Fetches and parses JSON from the SAID API.
   *
   * @param path - API path beginning with a slash
   * @returns The parsed JSON response
   */
  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`);
    if (!response.ok) {
      throw new Error(`SAID API returned ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  }
}

/**
 * Factory function to create a new SaidActionProvider instance.
 *
 * @param config - Optional configuration (API base URL override)
 * @returns A new SaidActionProvider instance
 */
export const saidActionProvider = (config: SaidActionProviderConfig = {}) =>
  new SaidActionProvider(config);
