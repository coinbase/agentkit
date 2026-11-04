import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { ComputeActionRefSchema, VerifyAnchorSchema } from "./schemas";
import { ANCHOR_REGISTRY_ADDRESS, ANCHORED_TOPIC0, RPC_ENDPOINTS } from "./constants";
import { computeActionRef } from "./utils";

/**
 * ActionRefVerifyActionProvider — read-only, no wallet, no transactions.
 *
 * Derives `action_ref` (action-ref-v1: SHA-256 of RFC 8785 JCS over
 * {agent_id, action_type, scope, timestamp}) for a declared action, and
 * checks whether it has been anchored against the permissionless
 * AnchorRegistry contract (`anchor(bytes32)`, same CREATE2 address on Base,
 * Arbitrum One, and Ink).
 *
 * This does not verify that the declared action actually happened as
 * described, or evaluate whether it was safe or advisable — it only
 * confirms that a specific content-addressed reference for it exists,
 * independently, on a public chain. See
 * https://github.com/giskard09/coinbase-x402-action-ref-anchor for a full
 * worked example.
 */
export class ActionRefVerifyActionProvider extends ActionProvider {
  /**
   * Constructor for the ActionRefVerifyActionProvider class.
   */
  constructor() {
    super("action-ref-verify", []);
  }

  /**
   * Computes an action_ref from four declared fields, per action-ref-v1.
   *
   * @param args - The four preimage fields
   * @returns A JSON string with the derived action_ref
   */
  @CreateAction({
    name: "compute_action_ref",
    description: `Computes action_ref — a deterministic, content-addressed identifier for a
declared agent action (action-ref-v1 spec: SHA-256 of RFC 8785 JCS over
{agent_id, action_type, scope, timestamp}).

This does not record, sign, or dispatch anything. It only derives a
reference any third party can independently recompute from the same four
declared fields, so it can later be checked against an on-chain anchor with
verify_action_ref_anchor.`,
    schema: ComputeActionRefSchema,
  })
  computeActionRefAction(args: z.infer<typeof ComputeActionRefSchema>): string {
    const actionRef = computeActionRef(args.agentId, args.actionType, args.scope, args.timestamp);
    return JSON.stringify(
      {
        actionRef,
        anchorRefBytes32: `0x${actionRef}`,
        anchorRegistry: ANCHOR_REGISTRY_ADDRESS,
        note: "Anchor this ref with a permissionless anchor(bytes32) call, then use verify_action_ref_anchor to confirm it independently.",
      },
      null,
      2,
    );
  }

  /**
   * Checks whether a given action_ref has been anchored on-chain.
   *
   * @param args - The action_ref and target chain
   * @returns A JSON string with the anchor status
   */
  @CreateAction({
    name: "verify_action_ref_anchor",
    description: `Checks whether a given action_ref has been anchored on-chain via
AnchorRegistry.anchor(bytes32) (Base, Arbitrum One, or Ink — same address on
all three). Queries the public RPC directly for the Anchored event; does
not trust any off-chain report of anchor status.

Returns anchored:true with the tx hash, block, and the address that
anchored it if found; anchored:false otherwise. Absence of an anchor does
not mean the underlying action didn't happen — it means nobody chose to
anchor a reference to it, which is a separate, opt-in step.`,
    schema: VerifyAnchorSchema,
  })
  async verifyActionRefAnchor(args: z.infer<typeof VerifyAnchorSchema>): Promise<string> {
    const ref = args.actionRef.startsWith("0x") ? args.actionRef : `0x${args.actionRef}`;
    const rpcUrl = RPC_ENDPOINTS[args.chain];

    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getLogs",
          params: [
            {
              address: ANCHOR_REGISTRY_ADDRESS,
              fromBlock: "earliest",
              toBlock: "latest",
              topics: [ANCHORED_TOPIC0, ref],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`RPC HTTP error: ${response.status}`);
      }

      const body = await response.json();
      if (body.error) {
        throw new Error(`RPC error: ${JSON.stringify(body.error)}`);
      }

      const logs = body.result as Array<{
        transactionHash: string;
        blockNumber: string;
        topics: string[];
        data: string;
      }>;

      if (!logs || logs.length === 0) {
        return JSON.stringify(
          {
            anchored: false,
            actionRef: ref,
            chain: args.chain,
            note: "No Anchored event found for this ref on this chain. Absence does not mean the action didn't happen — anchoring is a separate, opt-in step.",
          },
          null,
          2,
        );
      }

      const log = logs[0];
      const anchoredBy = `0x${log.topics[2].slice(-40)}`;
      const blockTimestamp = parseInt(log.data, 16);

      return JSON.stringify(
        {
          anchored: true,
          actionRef: ref,
          chain: args.chain,
          txHash: log.transactionHash,
          block: parseInt(log.blockNumber, 16),
          anchoredBy,
          blockTimestamp,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return JSON.stringify(
        {
          error: true,
          message: "Failed to query AnchorRegistry",
          details: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      );
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Read-only and RPC-agnostic — supports any network, since the checked
   * chain is chosen explicitly per call via the `chain` argument, not
   * derived from the agent's own wallet network.
   *
   * @returns True on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the ActionRefVerifyActionProvider.
 *
 * @returns A new ActionRefVerifyActionProvider instance
 */
export const actionRefVerifyActionProvider = () => new ActionRefVerifyActionProvider();
