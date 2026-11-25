import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  CheckAgentSchema,
  CheckPayeeSchema,
  GetAgentEconomyOverviewSchema,
  GetAgentStatementSchema,
} from "./schemas";
import {
  AGENTIC_FINANCE_GRAPH_API_URL,
  BASE_MAINNET,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_AGENT_DETECTIONS,
  OVERVIEW_FIGURES,
} from "./constants";
import {
  AgentLookupResponse,
  AgenticFinanceGraphActionProviderConfig,
  CounterpartyResponse,
  DetectionsResponse,
  StateResponse,
  StatementResponse,
} from "./types";
import {
  cleanAddress,
  cleanNumber,
  cleanText,
  formatUsdcBaseUnits,
  getJson,
  RequestOptions,
  roundUsd,
  summarizeAgent,
  summarizeDetection,
} from "./utils";

/**
 * AgenticFinanceGraphActionProvider gives agents read-only access to Agentic Finance Graph, an
 * independent ledger of money held and spent by ERC-8004 agents on Base. It lets an agent check
 * another agent, or a payment destination, before it pays: from observed, receipt-checked
 * payments rather than self-declared metadata.
 *
 * No wallet, key or account is needed, and nothing in this provider can move funds.
 */
export class AgenticFinanceGraphActionProvider extends ActionProvider {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  /**
   * Constructor for the AgenticFinanceGraphActionProvider class.
   *
   * @param config - Optional configuration (API base URL, API key for the full tier, timeout)
   */
  constructor(config: AgenticFinanceGraphActionProviderConfig = {}) {
    super("agentic_finance_graph", []);

    this.baseUrl = (config.baseUrl ?? AGENTIC_FINANCE_GRAPH_API_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? process.env.AGENTIC_FINANCE_GRAPH_API_KEY;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  /**
   * Checks an ERC-8004 agent on Base: its liveness level, bound wallet, counted payments,
   * open incidents and most recent detections.
   *
   * @param args - The agent to check
   * @returns A JSON string with the agent check, or an error message
   */
  @CreateAction({
    name: "check_agent",
    description: `This tool checks an ERC-8004 agent on Base against Agentic Finance Graph, an independent ledger that reads the payment receipts of every wallet bound to a Base agent registration.
Use it before trusting, hiring or paying another agent, or when asked what an agent has actually done with money.

It takes the following input:
- agent: the agent's ERC-8004 token id on Base (e.g. "57657"), its slug ("8004-base-57657"), or the wallet address bound to it (0x...)

It returns:
- whether the agent is ranked, and its liveness level: L7 = observed paying a different address after registration, L8 = L7 and still funded, L9 = L8 and three or more counterparties in 30 days
- its bound wallet, how the binding was established, its stablecoin balance and any EIP-7702 delegate
- its counted payments: count and USD total, the last 30 days, distinct counterparties, first and last payment
- open incidents and its most recent detections

Important notes:
- Most registered agents have never been observed paying anyone. For them this returns ranked: false, which describes their history and is not proof of fraud
- A detection is an observed pattern with a time, not a verdict
- Use get_agent_statement for the agent's latest signed statement before paying it
- Every result carries the time it was measured; quote it with any figure`,
    schema: CheckAgentSchema,
  })
  async checkAgent(args: z.infer<typeof CheckAgentSchema>): Promise<string> {
    try {
      const lookup = await getJson<AgentLookupResponse>(
        this.baseUrl,
        `/api/agents?q=${encodeURIComponent(args.agent)}`,
        this.requestOptions(),
      );
      if (lookup.status !== 200 || !lookup.body) {
        throw new Error(`HTTP error! status: ${lookup.status}`);
      }

      const measuredAt = cleanText(lookup.body.as_of, 40);
      const agent = lookup.body.agent;
      if (!lookup.body.ranked || !agent) {
        return JSON.stringify(
          {
            query: args.agent,
            chain: BASE_MAINNET,
            measured_at: measuredAt,
            ranked: false,
            liveness: null,
            summary:
              "No ERC-8004 registration matching this query has been observed paying a counterparty on Base, so the ledger has no payment history for it. A registration on its own is a name, not evidence that the agent is live.",
            source: this.baseUrl,
          },
          null,
          2,
        );
      }

      const detections = await this.recentDetections(agent.id);

      return JSON.stringify(
        {
          query: args.agent,
          measured_at: measuredAt,
          ranked: true,
          ...summarizeAgent(agent),
          recent_detections: detections,
          definition: `${this.baseUrl}/def/rank.l7plus.v1`,
          next_step:
            "Before paying this agent, call get_agent_statement for its latest signed statement.",
          source: this.baseUrl,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error checking agent: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Fetches an agent's latest signed 3-hour statement and evaluates the ledger's published
   * check-before-you-pay rule.
   *
   * @param args - The agent whose statement to fetch
   * @returns A JSON string with the statement and the check result, or an error message
   */
  @CreateAction({
    name: "get_agent_statement",
    description: `This tool fetches the latest signed statement of a ranked ERC-8004 agent on Base from Agentic Finance Graph, and evaluates it with the ledger's published check-before-you-pay rule.
Use it immediately before paying another agent.

It takes the following input:
- agent: the agent's ERC-8004 token id on Base (e.g. "57657"), its slug ("8004-base-57657"), or the wallet address bound to it (0x...)

It returns:
- the 3-hour window the statement covers
- payments out, split into counted spend and routing hops, what left the agent's control, income in, and open flags (amounts in USD)
- a check result: passes, plus the reasons it may not (stale, chain_ok, flags)
- the statement hash, the hash it chains to, its Merkle proof and the Ed25519-signed root, so the statement can be verified without trusting the ledger

Important notes:
- Statements exist only for agents at L7 or above; for any other agent this returns found: false
- passes is false when the newest window closed more than nine hours ago (stale), the hash chain is broken (chain_ok: false), or any flag is open
- A failed check means the agent's record cannot be relied on right now, not that the agent is malicious`,
    schema: GetAgentStatementSchema,
  })
  async getAgentStatement(args: z.infer<typeof GetAgentStatementSchema>): Promise<string> {
    try {
      const result = await getJson<StatementResponse>(
        this.baseUrl,
        `/api/statement/${encodeURIComponent(args.agent)}`,
        this.requestOptions(),
      );

      if (result.status === 404) {
        return JSON.stringify(
          {
            query: args.agent,
            found: false,
            summary:
              "No statement exists for this agent. Statements are written only for agents at L7 or above, meaning a bound wallet was observed paying a different address. Use check_agent to see the agent's history.",
            source: this.baseUrl,
          },
          null,
          2,
        );
      }
      if (result.status !== 200 || !result.body?.latest) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      const body = result.body;
      const latest = body.latest;
      const statement = latest.statement;
      const flags = Array.isArray(statement.flags)
        ? statement.flags.map(flag => cleanText(flag, 60)).filter(Boolean)
        : [];
      const stale = body.stale === true;
      const chainOk = body.chain_ok === true;

      return JSON.stringify(
        {
          query: args.agent,
          found: true,
          token_id: cleanText(body.token_id, 20),
          chain: BASE_MAINNET,
          wallet: cleanAddress(statement.wallet),
          window: {
            start: cleanText(latest.window_start, 40),
            end: cleanText(latest.window_end, 40),
            age_hours: cleanNumber(body.age_hours),
          },
          statement: {
            payments_out: cleanText(statement.outCount, 20),
            out_usd: formatUsdcBaseUnits(statement.outSum),
            counted_spend_usd: formatUsdcBaseUnits(statement.spendSum),
            routing_hops_usd: formatUsdcBaseUnits(statement.routeSum),
            receipt_not_read_yet_usd: formatUsdcBaseUnits(statement.uncheckedSum),
            left_control_usd: formatUsdcBaseUnits(statement.leftControl),
            payments_in: cleanText(statement.inCount, 20),
            in_usd: formatUsdcBaseUnits(statement.inSum),
            flags,
          },
          check_before_you_pay: {
            passes: !stale && chainOk && flags.length === 0,
            stale,
            chain_ok: chainOk,
            open_flags: flags.length,
            rule: "Refuse if stale is true (the newest window closed more than nine hours ago), if chain_ok is false, or if any flag is open.",
          },
          proof: {
            hash: cleanText(latest.hash, 80),
            prev_hash: cleanText(latest.prev_hash, 80),
            leaf: cleanText(latest.leaf, 80),
            leaf_index: cleanNumber(latest.leaf_index),
            merkle_proof: Array.isArray(latest.proof)
              ? latest.proof.map(node => cleanText(node, 80))
              : [],
            root: cleanText(latest.root, 80),
            root_signature: cleanText(latest.root_signature, 120),
            key_id: cleanText(latest.key_id, 80),
            published_at: cleanText(latest.published_at, 40),
            verify:
              "keccak256(canonical statement) must equal hash; leaf = keccak256(uint256(agentId) || hash); folding the proof with sorted-pair keccak256 must reach root; the root's Ed25519 signature must verify against the key published at the roots_and_key URL.",
            roots_and_key: `${this.baseUrl}/api/statements`,
          },
          definition: `${this.baseUrl}/def/agent.statement.v1`,
          source: this.baseUrl,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error fetching agent statement: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks a payment destination on Base: how many registered and ranked agents have paid it,
   * whether it is a listed x402 seller, and whether it is itself a ranked agent's wallet.
   *
   * @param args - The payee address or x402 resource URL
   * @returns A JSON string with the payee check, or an error message
   */
  @CreateAction({
    name: "check_payee",
    description: `This tool checks a payment destination on Base before the agent sends money to it, using Agentic Finance Graph's record of counted agent payments.
Use it before paying an x402 endpoint or any address the agent has not paid before.

It takes the following input:
- payee: a 0x address on Base (for example the payTo of an x402 payment request), or the https:// URL of an x402 resource listed in the x402 Bazaar

It returns:
- how many counted payments registered agents have made to it, from how many distinct agents, and how many of those agents are ranked (L7 or above)
- when it was first and last paid
- payments left out of the count: routing hops, history from before the paying agent was registered, and receipts not read yet
- whether it is a listed x402 seller, with its resource count and calls in the last 30 days
- whether the address is itself the bound wallet of a ranked agent

Important notes:
- Counts only: the list of payers is not returned
- An address no registered agent has paid is new to the ledger. That is worth knowing before a large payment, but it is not proof that the address is unsafe`,
    schema: CheckPayeeSchema,
  })
  async checkPayee(args: z.infer<typeof CheckPayeeSchema>): Promise<string> {
    try {
      const isAddress = args.payee.startsWith("0x");
      const query = isAddress
        ? `address=${encodeURIComponent(args.payee)}`
        : `endpoint=${encodeURIComponent(args.payee)}`;

      const [payee, owner] = await Promise.all([
        getJson<CounterpartyResponse & { error?: string }>(
          this.baseUrl,
          `/api/counterparty?${query}`,
          this.requestOptions(),
        ),
        isAddress
          ? getJson<AgentLookupResponse>(
              this.baseUrl,
              `/api/agents?q=${encodeURIComponent(args.payee)}`,
              this.requestOptions(),
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (!isAddress && payee.status === 404) {
        return JSON.stringify(
          {
            payee: args.payee,
            found: false,
            summary:
              "This URL is not an x402 resource with a Base payTo listed in the x402 Bazaar, so the ledger cannot map it to an address. Check the payTo address from the payment request instead.",
            source: this.baseUrl,
          },
          null,
          2,
        );
      }
      if (payee.status === 400) {
        const reason = cleanText(payee.body?.error) ?? "invalid payee";
        return `Error checking payee: ${reason}`;
      }
      if (payee.status !== 200 || !payee.body) {
        throw new Error(`HTTP error! status: ${payee.status}`);
      }

      const record = payee.body;
      const counted = cleanNumber(record.n_payments) ?? 0;
      const distinctAgents = cleanNumber(record.distinct_payers) ?? 0;
      const distinctRanked = cleanNumber(record.distinct_l7_payers) ?? 0;
      const lastPaidAt = cleanText(record.last_seen, 40);
      const rankedOwner =
        owner?.status === 200 && owner.body?.ranked && owner.body.agent
          ? {
              token_id: cleanText(owner.body.agent.token_id, 20),
              liveness: `L${cleanNumber(owner.body.agent.liveness)}`,
              profile: cleanText(owner.body.agent.url),
            }
          : null;

      return JSON.stringify(
        {
          payee: args.payee,
          address: cleanAddress(record.address),
          resolved_from_url: cleanText(record.resolved_from),
          chain: BASE_MAINNET,
          measured_at: cleanText(record.as_of, 40),
          found: true,
          paid_by_registered_agents: {
            counted_payments: counted,
            distinct_agents: distinctAgents,
            distinct_ranked_agents: distinctRanked,
            first_paid_at: cleanText(record.first_seen, 40),
            last_paid_at: lastPaidAt,
          },
          not_counted: {
            routing_hop_payments: cleanNumber(record.routing_hops_excluded?.payments) ?? 0,
            pre_registration_payments: cleanNumber(record.pre_registration_excluded?.payments) ?? 0,
            receipt_not_read_yet_payments: cleanNumber(record.receipt_not_read_yet?.payments) ?? 0,
          },
          x402_seller: record.x402_seller
            ? {
                resources: cleanNumber(record.x402_seller.resources),
                calls_30d: cleanNumber(record.x402_seller.calls_30d),
              }
            : null,
          is_ranked_agent_wallet: rankedOwner,
          summary:
            counted > 0
              ? `${distinctAgents} registered agents (${distinctRanked} of them ranked) made ${counted} counted payments to this destination${lastPaidAt ? `, the latest at ${lastPaidAt}` : ""}.`
              : "No registered agent has made a counted payment to this destination yet.",
          definition: `${this.baseUrl}/def/cp.payers.l7.v1`,
          source: this.baseUrl,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error checking payee: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Returns the headline figures of AI-agent money on Base, each with its unit, measurement
   * time and definition id.
   *
   * @param _ - No inputs
   * @returns A JSON string with the headline figures, or an error message
   */
  @CreateAction({
    name: "get_agent_economy_overview",
    description: `This tool returns the headline figures of AI-agent money on Base from Agentic Finance Graph.
Use it to answer questions about the size and health of the agent economy on Base.

It takes no inputs.

It returns, each with its value, unit, measurement time and definition id:
- ERC-8004 registrations on Base, agents seen paying (L7+), still funded (L8+) and paying repeat counterparties (L9)
- counted spending, how much of it went into positions the payer still holds, and how much left its control
- routing hops excluded from spending
- spending on the last day and the 7-day daily average, and the median payment
- detections in the last 7 days, live incidents, and agent wallets targeted by address poisoning in the last 7 days

Important notes:
- Counted spending excludes routing hops and payments from before an agent was registered; the excluded amount is published beside it
- Quote the measurement time with any figure`,
    schema: GetAgentEconomyOverviewSchema,
  })
  async getAgentEconomyOverview(_: z.infer<typeof GetAgentEconomyOverviewSchema>): Promise<string> {
    try {
      const result = await getJson<StateResponse>(
        this.baseUrl,
        "/api/state",
        this.requestOptions(),
      );
      if (result.status !== 200 || !result.body?.measured) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      const figures: Record<string, unknown> = {};
      for (const key of OVERVIEW_FIGURES) {
        const figure = result.body.measured[key];
        const value = cleanNumber(figure?.value);
        if (!figure || value === null) {
          continue;
        }
        const unit = cleanText(figure.unit, 20);
        figures[key] = {
          value: unit === "USD" ? roundUsd(value) : value,
          unit,
          measured_at: cleanText(figure.as_of, 40),
          stale: figure.stale === true,
          definition: `${this.baseUrl}/def/${encodeURIComponent(cleanText(figure.definition_id, 80) ?? "")}`,
        };
      }

      return JSON.stringify(
        {
          chain: BASE_MAINNET,
          measured_at: cleanText(result.body.as_of, 40),
          figures,
          source: this.baseUrl,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error fetching agent economy overview: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the Agentic Finance Graph action provider supports the given network.
   * The provider only reads a public API and never uses the wallet, so it works with any network.
   *
   * @returns True, as these read-only actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }

  /**
   * Fetches the most recent detections for an agent. Detections enrich an agent check, so a
   * failure here is reported in the result instead of failing the whole check.
   *
   * @param agentId - The ledger's id for the agent (e.g. act_8453_57657)
   * @returns The most recent detections, or null if they could not be fetched
   */
  private async recentDetections(agentId: string) {
    try {
      const result = await getJson<DetectionsResponse>(
        this.baseUrl,
        `/api/detections?actor=${encodeURIComponent(agentId)}&limit=${MAX_AGENT_DETECTIONS}`,
        this.requestOptions(),
      );
      if (result.status !== 200 || !Array.isArray(result.body?.detections)) {
        return null;
      }
      return result.body.detections.slice(0, MAX_AGENT_DETECTIONS).map(summarizeDetection);
    } catch {
      return null;
    }
  }

  /**
   * Builds the options shared by every request.
   *
   * @returns The request options
   */
  private requestOptions(): RequestOptions {
    return { apiKey: this.apiKey, timeoutMs: this.timeoutMs };
  }
}

/**
 * Creates a new instance of the Agentic Finance Graph action provider.
 *
 * @param config - Optional configuration (API base URL, API key for the full tier, timeout)
 * @returns A new AgenticFinanceGraphActionProvider instance
 */
export const agenticFinanceGraphActionProvider = (
  config?: AgenticFinanceGraphActionProviderConfig,
) => new AgenticFinanceGraphActionProvider(config);
