import { agenticFinanceGraphActionProvider } from "./agenticFinanceGraphActionProvider";
import { CheckAgentSchema, CheckPayeeSchema } from "./schemas";
import { Network } from "../../network";
import { ActionProvider } from "../actionProvider";

const BASE = "https://agenticfinancegraph.com";
const WALLET = "0x024beeed33d76cce272c0db022134cda921f4aa6";
const PAYEE = "0x0e84ddedaae6a779c462c22a59f301ec31b6b808";

const RANKED_AGENT = {
  id: "act_8453_57657",
  token_id: "57657",
  slug: "8004-base-57657",
  url: `${BASE}/agent/8004-base-57657`,
  liveness: 9,
  registered_at: "2026-06-29T23:06:05.000Z",
  chain: "eip155:8453",
  wallet: `eip155:8453:${WALLET}`,
  usdc_float: 100,
  stables_float: 100,
  delegated_7702: "0x7702cb554e6bfb442cb743a7df23154544a7176c",
  pay: {
    events: 793,
    usd: 78564.897832,
    counterparties: 33,
    events_30d: 238,
    usd_30d: 20650.2,
    first: "2026-06-30T07:09:21.000Z",
    last: "2026-10-10T15:13:50.177Z",
  },
  open_incidents: 0,
  bind_method_label: "holds the registration (ERC-721 ownerOf)",
  binding_confidence: "onchain",
  bind_evidence: "ERC-721 ownerOf(57657)",
};

const STATEMENT = {
  token_id: "57657",
  slug: "8004-base-57657",
  url: `${BASE}/agent/8004-base-57657`,
  definition: `${BASE}/def/agent.statement.v1`,
  roots_and_key: `${BASE}/api/statements`,
  check_before_you_pay: "Before paying an agent: fetch its statement...",
  chain_ok: true,
  stale: false,
  age_hours: 6.04,
  latest: {
    window_start: "2026-10-11T00:00:00.000Z",
    window_end: "2026-10-11T03:00:00.000Z",
    statement: {
      agentId: "57657",
      chainId: "8453",
      wallet: WALLET,
      windowStart: "1791676800",
      windowEnd: "1791687600",
      outCount: "3",
      outSum: "303000000",
      spendSum: "202000000",
      routeSum: "101000000",
      uncheckedSum: "0",
      leftControl: "202000000",
      inCount: "1",
      inSum: "1500000",
      flags: [],
      prevHash: "0x36c4",
    },
    hash: "0x4860",
    prev_hash: "0x36c4",
    leaf: "0xaf4f",
    leaf_index: 3121,
    proof: ["0xe5be", "0x9e8f"],
    root: "0x525f",
    root_signature: "HGV5mAwz",
    key_id: "afg-stmt-ed25519-8cda0c3066b3a73c",
    published_at: "2026-10-11T06:07:27.784Z",
  },
};

const COUNTERPARTY = {
  address: PAYEE,
  chain: "eip155:8453",
  resolved_from: null,
  as_of: "2026-10-11T09:02:40.251Z",
  first_seen: "2026-02-15T08:07:51.000Z",
  last_seen: "2026-09-26T13:10:55.000Z",
  n_payments: 1402,
  distinct_payers: 180,
  distinct_l7_payers: 180,
  routing_hops_excluded: { payments: 0 },
  pre_registration_excluded: { payments: 128 },
  receipt_not_read_yet: { payments: 0 },
  x402_seller: { resources: 15, calls_30d: 9312 },
};

const figure = (value: number, unit: string, definitionId: string) => ({
  value,
  unit,
  as_of: "2026-10-11T09:52:13.418Z",
  stale: false,
  definition_id: definitionId,
});

/**
 * Builds a fetch response with the given status and JSON body.
 *
 * @param status - The HTTP status
 * @param body - The JSON body
 * @returns A minimal fetch Response
 */
function respond(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) };
}

describe("AgenticFinanceGraphActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const requestedPaths = () => fetchMock.mock.calls.map(call => String(call[0]).replace(BASE, ""));

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.AGENTIC_FINANCE_GRAPH_API_KEY;
  });

  describe("configuration", () => {
    it("calls the public API without credentials by default", async () => {
      fetchMock.mockResolvedValue(respond(200, { as_of: "t", ranked: false, agent: null }));

      await agenticFinanceGraphActionProvider().checkAgent({ agent: "1" });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE}/api/agents?q=1`);
      expect(init.headers).toEqual({ accept: "application/json" });
      expect(init.signal).toBeDefined();
    });

    it("uses a custom base URL without a trailing slash", async () => {
      fetchMock.mockResolvedValue(respond(200, { as_of: "t", ranked: false, agent: null }));

      await agenticFinanceGraphActionProvider({ baseUrl: "https://example.test/" }).checkAgent({
        agent: "1",
      });

      expect(fetchMock.mock.calls[0][0]).toBe("https://example.test/api/agents?q=1");
    });

    it("sends an API key from the config or the environment as a bearer token", async () => {
      fetchMock.mockResolvedValue(respond(200, { as_of: "t", ranked: false, agent: null }));

      await agenticFinanceGraphActionProvider({ apiKey: "config-key" }).checkAgent({ agent: "1" });
      process.env.AGENTIC_FINANCE_GRAPH_API_KEY = "env-key";
      await agenticFinanceGraphActionProvider().checkAgent({ agent: "1" });

      expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer config-key");
      expect(fetchMock.mock.calls[1][1].headers.authorization).toBe("Bearer env-key");
    });

    it("supports every network, since it never uses the wallet", () => {
      // AgentKit calls supportsNetwork through the base class, with the wallet's network.
      const provider: ActionProvider = agenticFinanceGraphActionProvider();
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as Network),
      ).toBe(true);
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" } as Network),
      ).toBe(true);
    });
  });

  describe("checkAgent", () => {
    it("returns the level, wallet, payments and recent detections of a ranked agent", async () => {
      fetchMock
        .mockResolvedValueOnce(
          respond(200, {
            as_of: "2026-10-11T08:25:45.362Z",
            ranked: true,
            note: null,
            agent: RANKED_AGENT,
          }),
        )
        .mockResolvedValueOnce(
          respond(200, {
            as_of: "t",
            detections: [
              {
                kind: "retry_storm",
                severity: "notable",
                at: "2026-10-09T10:00:00.000Z",
                live: true,
                headline: "Agent 57657 paid the same counterparty 12 times in 4 minutes",
              },
            ],
          }),
        );

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkAgent({ agent: "57657" }),
      );

      expect(requestedPaths()).toEqual([
        "/api/agents?q=57657",
        "/api/detections?actor=act_8453_57657&limit=5",
      ]);
      expect(result.ranked).toBe(true);
      expect(result.measured_at).toBe("2026-10-11T08:25:45.362Z");
      expect(result.liveness).toEqual({
        level: "L9",
        meaning: "L8, and it paid three or more distinct counterparties in the last 30 days.",
      });
      expect(result.wallet.address).toBe(WALLET);
      expect(result.wallet.bound_by).toBe("holds the registration (ERC-721 ownerOf)");
      expect(result.payments).toMatchObject({
        count: 793,
        total_usd: 78564.9,
        usd_30d: 20650.2,
        distinct_counterparties: 33,
      });
      expect(result.recent_detections).toEqual([
        {
          kind: "retry_storm",
          severity: "notable",
          at: "2026-10-09T10:00:00.000Z",
          live_incident: true,
          summary: "Agent 57657 paid the same counterparty 12 times in 4 minutes",
        },
      ]);
    });

    it("reports an agent that has never been observed paying as unranked, without fetching detections", async () => {
      fetchMock.mockResolvedValueOnce(
        respond(200, {
          as_of: "t",
          ranked: false,
          note: "No registration matching this query...",
          agent: null,
        }),
      );

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkAgent({ agent: "1" }),
      );

      expect(result.ranked).toBe(false);
      expect(result.liveness).toBeNull();
      expect(result.summary).toContain("has been observed paying");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("still returns the check when detections cannot be fetched", async () => {
      fetchMock
        .mockResolvedValueOnce(respond(200, { as_of: "t", ranked: true, agent: RANKED_AGENT }))
        .mockRejectedValueOnce(new Error("socket hang up"));

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkAgent({ agent: "57657" }),
      );

      expect(result.ranked).toBe(true);
      expect(result.recent_detections).toBeNull();
    });

    it("strips control and zero-width characters from text before it reaches the model", async () => {
      const tampered = { ...RANKED_AGENT, bind_method_label: "holds‮ the​ registration\u0007" };
      fetchMock
        .mockResolvedValueOnce(respond(200, { as_of: "t", ranked: true, agent: tampered }))
        .mockResolvedValueOnce(respond(200, { as_of: "t", detections: [] }));

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkAgent({ agent: "57657" }),
      );

      expect(result.wallet.bound_by).toBe("holds the registration");
    });

    it("returns an error message on an HTTP error", async () => {
      fetchMock.mockResolvedValueOnce(respond(500, null));

      const result = await agenticFinanceGraphActionProvider().checkAgent({ agent: "57657" });

      expect(result).toContain("Error checking agent");
      expect(result).toContain("500");
    });

    it("returns an error message on a network error", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await agenticFinanceGraphActionProvider().checkAgent({ agent: "57657" });

      expect(result).toBe("Error checking agent: Network error");
    });
  });

  describe("getAgentStatement", () => {
    it("converts the statement to USD and passes the check-before-you-pay rule", async () => {
      fetchMock.mockResolvedValueOnce(respond(200, STATEMENT));

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().getAgentStatement({ agent: "8004-base-57657" }),
      );

      expect(requestedPaths()).toEqual(["/api/statement/8004-base-57657"]);
      expect(result.found).toBe(true);
      expect(result.statement).toMatchObject({
        out_usd: "303",
        counted_spend_usd: "202",
        routing_hops_usd: "101",
        left_control_usd: "202",
        in_usd: "1.5",
        flags: [],
      });
      expect(result.check_before_you_pay).toMatchObject({
        passes: true,
        stale: false,
        chain_ok: true,
        open_flags: 0,
      });
      expect(result.proof).toMatchObject({ hash: "0x4860", root: "0x525f", leaf_index: 3121 });
    });

    it.each([
      ["stale", { ...STATEMENT, stale: true }],
      ["chain broken", { ...STATEMENT, chain_ok: false }],
      [
        "open flag",
        {
          ...STATEMENT,
          latest: {
            ...STATEMENT.latest,
            statement: { ...STATEMENT.latest.statement, flags: ["retry_storm"] },
          },
        },
      ],
    ])("fails the check when the statement is %s", async (_, body) => {
      fetchMock.mockResolvedValueOnce(respond(200, body));

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().getAgentStatement({ agent: "57657" }),
      );

      expect(result.check_before_you_pay.passes).toBe(false);
    });

    it("reports found: false for an agent without a statement", async () => {
      fetchMock.mockResolvedValueOnce(respond(404, { ok: false, error: "no statement" }));

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().getAgentStatement({ agent: "1" }),
      );

      expect(result.found).toBe(false);
      expect(result.summary).toContain("L7 or above");
    });

    it("returns an error message on an HTTP error", async () => {
      fetchMock.mockResolvedValueOnce(respond(503, null));

      const result = await agenticFinanceGraphActionProvider().getAgentStatement({
        agent: "57657",
      });

      expect(result).toContain("Error fetching agent statement");
      expect(result).toContain("503");
    });
  });

  describe("checkPayee", () => {
    it("returns who paid an address, and whether it is a ranked agent's wallet", async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url.includes("/api/counterparty")
          ? respond(200, COUNTERPARTY)
          : respond(200, { as_of: "t", ranked: true, agent: { ...RANKED_AGENT, liveness: 8 } }),
      );

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkPayee({ payee: PAYEE }),
      );

      expect(requestedPaths().sort()).toEqual([
        `/api/agents?q=${PAYEE}`,
        `/api/counterparty?address=${PAYEE}`,
      ]);
      expect(result.paid_by_registered_agents).toEqual({
        counted_payments: 1402,
        distinct_agents: 180,
        distinct_ranked_agents: 180,
        first_paid_at: "2026-02-15T08:07:51.000Z",
        last_paid_at: "2026-09-26T13:10:55.000Z",
      });
      expect(result.not_counted.pre_registration_payments).toBe(128);
      expect(result.x402_seller).toEqual({ resources: 15, calls_30d: 9312 });
      expect(result.is_ranked_agent_wallet).toMatchObject({ token_id: "57657", liveness: "L8" });
      expect(result.summary).toBe(
        "180 registered agents (180 of them ranked) made 1402 counted payments to this destination, the latest at 2026-09-26T13:10:55.000Z.",
      );
    });

    it("says so when no registered agent has paid the address", async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url.includes("/api/counterparty")
          ? respond(200, {
              ...COUNTERPARTY,
              n_payments: 0,
              distinct_payers: 0,
              distinct_l7_payers: 0,
              first_seen: null,
              last_seen: null,
              x402_seller: null,
            })
          : respond(200, { as_of: "t", ranked: false, agent: null }),
      );

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkPayee({ payee: PAYEE }),
      );

      expect(result.paid_by_registered_agents.counted_payments).toBe(0);
      expect(result.summary).toBe(
        "No registered agent has made a counted payment to this destination yet.",
      );
      expect(result.is_ranked_agent_wallet).toBeNull();
    });

    it("resolves an x402 resource URL through the Bazaar listing", async () => {
      fetchMock.mockResolvedValueOnce(
        respond(200, { ...COUNTERPARTY, resolved_from: "https://api.example.com/data" }),
      );

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkPayee({
          payee: "https://api.example.com/data",
        }),
      );

      expect(requestedPaths()).toEqual([
        `/api/counterparty?endpoint=${encodeURIComponent("https://api.example.com/data")}`,
      ]);
      expect(result.address).toBe(PAYEE);
      expect(result.resolved_from_url).toBe("https://api.example.com/data");
    });

    it("reports found: false for a URL that is not listed in the x402 Bazaar", async () => {
      fetchMock.mockResolvedValueOnce(respond(404, { ok: false, error: "no Base payTo listed" }));

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkPayee({
          payee: "https://unlisted.example.com",
        }),
      );

      expect(result.found).toBe(false);
    });

    it("passes the API's reason through when it rejects the payee", async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url.includes("/api/counterparty")
          ? respond(400, { ok: false, error: "address must be a 0x address on Base" })
          : respond(200, { as_of: "t", ranked: false, agent: null }),
      );

      const result = await agenticFinanceGraphActionProvider().checkPayee({ payee: PAYEE });

      expect(result).toBe("Error checking payee: address must be a 0x address on Base");
    });

    it("still returns the payee check when the owner lookup fails", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/counterparty")) return respond(200, COUNTERPARTY);
        throw new Error("timeout");
      });

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().checkPayee({ payee: PAYEE }),
      );

      expect(result.found).toBe(true);
      expect(result.is_ranked_agent_wallet).toBeNull();
    });
  });

  describe("getAgentEconomyOverview", () => {
    it("returns the headline figures with their measurement time and definition", async () => {
      fetchMock.mockResolvedValueOnce(
        respond(200, {
          as_of: "2026-10-11T10:25:38.935Z",
          measured: {
            actors_l7_plus: figure(7742, "actors", "rank.l7plus.v1"),
            registrations_minted_total: figure(99508, "registrations", "reg.minted.base.v1"),
            pass_through_pay_usd_excluded: figure(
              82791783.53,
              "USD",
              "pay.excluded.passthrough.v1",
            ),
            observed_pay_usd_left_control: figure(
              13464245.979730003,
              "USD",
              "pay.usd.leftcontrol.v1",
            ),
            probe_l5_rate: figure(0.1, "ratio", "probe.l5.v1"),
          },
        }),
      );

      const result = JSON.parse(
        await agenticFinanceGraphActionProvider().getAgentEconomyOverview({}),
      );

      expect(requestedPaths()).toEqual(["/api/state"]);
      expect(Object.keys(result.figures)).toEqual([
        "registrations_minted_total",
        "actors_l7_plus",
        "observed_pay_usd_left_control",
        "pass_through_pay_usd_excluded",
      ]);
      expect(result.figures.actors_l7_plus).toEqual({
        value: 7742,
        unit: "actors",
        measured_at: "2026-10-11T09:52:13.418Z",
        stale: false,
        definition: `${BASE}/def/rank.l7plus.v1`,
      });
      expect(result.figures.observed_pay_usd_left_control.value).toBe(13464245.98);
    });

    it("returns an error message on an HTTP error", async () => {
      fetchMock.mockResolvedValueOnce(respond(502, null));

      const result = await agenticFinanceGraphActionProvider().getAgentEconomyOverview({});

      expect(result).toContain("Error fetching agent economy overview");
      expect(result).toContain("502");
    });
  });

  describe("schemas", () => {
    it.each(["57657", "8004-base-57657", WALLET, `  ${WALLET}  `])(
      "accepts the agent reference %p",
      agent => {
        expect(CheckAgentSchema.safeParse({ agent }).success).toBe(true);
      },
    );

    it.each(["", "hello", "0x1234", "57657; drop", "8004-eth-1"])(
      "rejects the agent reference %p",
      agent => {
        expect(CheckAgentSchema.safeParse({ agent }).success).toBe(false);
      },
    );

    it.each([PAYEE, "https://api.example.com/x402/data"])("accepts the payee %p", payee => {
      expect(CheckPayeeSchema.safeParse({ payee }).success).toBe(true);
    });

    it.each(["http://api.example.com", "pay alice", "0xabc"])("rejects the payee %p", payee => {
      expect(CheckPayeeSchema.safeParse({ payee }).success).toBe(false);
    });
  });
});
