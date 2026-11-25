import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { VerifyTrailSchema, ComputeActionRefSchema, GetTrailsSchema } from "./schemas";
import { computeActionRef, OutOfProfileDomainError } from "./actionRef";

const MYCELIUM_API_BASE = "https://argentum.rgiskard.xyz";

// Shape of GET /trails/verify: { verified: false } or { verified: true, trail: {...} }.
interface TrailVerifyResult {
  verified: boolean;
  trail?: Record<string, unknown>;
}

/**
 * MyceliumTrailsActionProvider — read-only lookups of Mycelium Trails.
 *
 * A Mycelium Trail is a record of an action an agent reported. agent_id is declared by the
 * caller that recorded the trail, and a trail is not proof that the action happened. A trail
 * may be anchored on-chain; when it is, its tx_hash is the anchoring transaction.
 *
 * All actions are read-only. No API key required.
 */
export class MyceliumTrailsActionProvider extends ActionProvider {
  constructor() {
    super("mycelium-trails", []);
  }

  @CreateAction({
    name: "verify_trail",
    description: `Checks whether a Mycelium Trail exists for an agent_id and an action_ref.

A trail is a record of an action an agent reported; agent_id is declared by whoever recorded it.
A match does not prove the action happened.

Pair with compute_action_ref to generate the action_ref before checking.

Returns:
- verified: true if a trail exists for that agent_id and action_ref
- trail (only when verified): the trail record, including trail_id, service, operation,
  action_ref, timestamp (Unix seconds), success and tx_hash (the anchoring transaction, if anchored)
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
        return JSON.stringify({ verified: false });
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
    description: `Computes the Mycelium action_ref (v1) for a given action.

The action_ref is SHA-256 of the RFC 8785 (JCS) serialization of
{agent_id, action_type, scope, timestamp} -- a deterministic content-addressed
reference used to link external records to Mycelium Trails.

The timestamp is a STRING, exactly YYYY-MM-DDTHH:MM:SS.mmmZ (UTC, three fractional
digits). agent_id, action_type and scope must be ASCII and scope must not be empty.
Inputs outside that domain return an error instead of a hash.

Use this before verify_trail when you have the inputs but not the hash.

Example: compute_action_ref("giskard-self", "trail.anchor", "mycelium:baseline", "2026-05-23T00:00:00.000Z")
`,
    schema: ComputeActionRefSchema,
  })
  async computeActionRef(
    _walletProvider: unknown,
    args: z.infer<typeof ComputeActionRefSchema>,
  ): Promise<string> {
    try {
      const action_ref = computeActionRef(
        args.agent_id,
        args.action_type,
        args.scope,
        args.timestamp,
      );
      const canonical = JSON.stringify({
        action_type: args.action_type,
        agent_id: args.agent_id,
        scope: args.scope,
        timestamp: args.timestamp,
      });
      return JSON.stringify({ action_ref, canonical });
    } catch (err) {
      if (err instanceof OutOfProfileDomainError) {
        return JSON.stringify({
          error: "OUT_OF_PROFILE_DOMAIN",
          field: err.field,
          reason: err.reason,
        });
      }
      return JSON.stringify({ error: String(err) });
    }
  }

  @CreateAction({
    name: "get_trails",
    description: `Lists recent Mycelium Trails recorded for a given agent_id.

Each trail is a record of an action the agent reported; it does not prove the action happened.
A trail includes service, operation, timestamp (Unix seconds), success, karma_at_time,
action_ref and tx_hash (the anchoring transaction, if anchored).
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
