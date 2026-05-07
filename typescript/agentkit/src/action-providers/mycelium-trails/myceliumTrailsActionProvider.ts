import { createHash } from "crypto";
import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { VerifyTrailSchema, ComputeActionRefSchema, GetTrailsSchema } from "./schemas";

const MYCELIUM_API_BASE = "https://argentum.rgiskard.xyz";

interface TrailVerifyResult {
  verified: boolean;
  trail_id: string | null;
  tx_hash: string | null;
  timestamp: string | null;
  service: string | null;
  operation: string | null;
}

/**
 * MyceliumTrailsActionProvider — post-execution accountability for AI agents.
 *
 * Each Mycelium Trail is an on-chain record (Arbitrum One + Base mainnet) of a completed
 * agent action, anchored via payment_hash as a cross-surface key.
 *
 * All actions are read-only. No API key required.
 *
 * External integration: aeoess/agent-passport-system uses Mycelium TrailRecords as the
 * on-chain persistence layer for APS receipts (PR #24, dual-chain anchored).
 */
export class MyceliumTrailsActionProvider extends ActionProvider {
  constructor() {
    super("mycelium-trails", []);
  }

  @CreateAction({
    name: "verify_trail",
    description: `Verifies whether an agent has a confirmed Mycelium Trail for a given action.

A Mycelium Trail is an on-chain record (Arbitrum One + Base mainnet) of a completed agent action,
anchored by payment_hash as a cross-surface key linking payments, executions, and proofs.

Use this after an agent claims to have executed an action to verify it actually happened.
Pair with compute_action_ref to generate the canonical reference before verifying.

Returns:
- verified: true if the trail exists and is confirmed
- tx_hash: on-chain transaction hash (if anchored)
- timestamp: ISO 8601 timestamp of when the trail was recorded
- trail_id: internal trail identifier
- service: which Mycelium service recorded the trail (e.g. giskard-oasis)
- operation: the operation type (e.g. enter_oasis, agent_trail)
`,
    schema: VerifyTrailSchema,
  })
  async verifyTrail(
    _walletProvider: unknown,
    args: z.infer<typeof VerifyTrailSchema>,
  ): Promise<string> {
    try {
      const url = `${MYCELIUM_API_BASE}/trails/verify?agent_id=${encodeURIComponent(args.agent_id)}&action_ref=${encodeURIComponent(args.action_ref)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (resp.status === 404) {
        return JSON.stringify({
          verified: false,
          trail_id: null,
          tx_hash: null,
          timestamp: null,
          service: null,
          operation: null,
        });
      }
      if (!resp.ok) {
        return JSON.stringify({ error: `API error: ${resp.status}`, verified: false });
      }

      const data = (await resp.json()) as TrailVerifyResult;
      return JSON.stringify(data);
    } catch (err) {
      return JSON.stringify({ error: String(err), verified: false });
    }
  }

  @CreateAction({
    name: "compute_action_ref",
    description: `Computes the canonical Mycelium action_ref for a given action.

The action_ref is SHA-256(agent_id:action_type:scope:timestamp) — a deterministic
content-addressed reference used to link external records to Mycelium Trails.

Use this before verify_trail when you have the inputs but not the hash.
The same algorithm is used by the Mycelium Python SDK (argentum/trails.py).
`,
    schema: ComputeActionRefSchema,
  })
  async computeActionRef(
    _walletProvider: unknown,
    args: z.infer<typeof ComputeActionRefSchema>,
  ): Promise<string> {
    const payload = `${args.agent_id}:${args.action_type}:${args.scope}:${args.timestamp}`;
    const hash = createHash("sha256").update(payload, "utf8").digest("hex");
    return JSON.stringify({ action_ref: hash, payload });
  }

  @CreateAction({
    name: "get_trails",
    description: `Lists recent Mycelium Trails for a given agent.

Returns the agent's verified action history — on-chain records of completed
interactions in the Mycelium ecosystem (payments, swaps, knowledge queries).

Use this to assess an agent's track record before trusting its claims.

Each trail includes: service, operation, timestamp, karma_at_time, success,
and bridge_tx_hash if a cross-chain swap was part of the action.
`,
    schema: GetTrailsSchema,
  })
  async getTrails(
    _walletProvider: unknown,
    args: z.infer<typeof GetTrailsSchema>,
  ): Promise<string> {
    try {
      const limit = args.limit ?? 10;
      const url = `${MYCELIUM_API_BASE}/trails/agents/${encodeURIComponent(args.agent_id)}?limit=${limit}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!resp.ok) {
        return JSON.stringify({ error: `API error: ${resp.status}`, trails: [] });
      }
      const data = await resp.json();
      return JSON.stringify(data);
    } catch (err) {
      return JSON.stringify({ error: String(err), trails: [] });
    }
  }

  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

export const myceliumTrailsActionProvider = () => new MyceliumTrailsActionProvider();
