import { z } from "zod";
import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import { toHex } from "viem";
import { EZPATH_API, USDC_BASE, TIER_ATOMIC } from "./constants.js";
import { GetSwapQuoteSchema } from "./schemas.js";

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
  ],
} as const;

/**
 * EzPathActionProvider gives AgentKit agents access to EZ-Path — a pay-per-request
 * DEX meta-router on Base mainnet that races 0x, ParaSwap, Aerodrome, and Uniswap V3
 * to return the highest buyAmount for any ERC-20 swap.
 *
 * Payment is handled automatically via X402 / EIP-3009 USDC authorization.
 * The agent's wallet signs a TransferWithAuthorization; no pre-approval or
 * allowance is required.
 */
export class EzPathActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("ezpath", []);
  }

  @CreateAction({
    name: "get_swap_quote",
    description:
      "Fetch the best available DEX swap quote on Base mainnet via EZ-Path. " +
      "Races 0x, ParaSwap, Aerodrome, and Uniswap V3 and returns the highest buyAmount. " +
      "Payment is settled automatically — the agent's USDC balance is debited per request " +
      "($0.03 basic / $0.10 resilient / $0.50 institutional). " +
      "Use this before executing a swap to guarantee optimal execution.",
    schema: GetSwapQuoteSchema,
  })
  async getSwapQuote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetSwapQuoteSchema>,
  ): Promise<string> {
    const url = new URL(EZPATH_API);
    url.searchParams.set("sellToken",  args.sellToken);
    url.searchParams.set("buyToken",   args.buyToken);
    url.searchParams.set("sellAmount", args.sellAmount);
    if (args.slippagePercentage !== undefined) {
      url.searchParams.set("slippagePercentage", String(args.slippagePercentage));
    }

    // ── Step 1: probe — discover live toll address and confirm tier pricing
    let probe: Response;
    try {
      probe = await fetch(url.toString());
    } catch (err) {
      return `EZ-Path unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (probe.status === 429) {
      return `Rate limited by EZ-Path. Retry after ${probe.headers.get("Retry-After") ?? "60"} seconds.`;
    }
    if (probe.status !== 402) {
      return `Unexpected response from EZ-Path during negotiation: HTTP ${probe.status}`;
    }

    const probeBody   = await probe.json() as { tiers?: Record<string, { min_atomic: string }> };
    const tollAddress = probe.headers.get("X-402-Address");
    if (!tollAddress) return "EZ-Path 402 response missing X-402-Address header.";

    const tierConfig  = probeBody.tiers?.[args.tier];
    const valueAtomic = tierConfig ? BigInt(tierConfig.min_atomic) : TIER_ATOMIC[args.tier];

    // ── Step 2: sign EIP-3009 TransferWithAuthorization using the agent's wallet
    const from        = await walletProvider.getAddress();
    const validAfter  = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);
    const nonce       = toHex(crypto.getRandomValues(new Uint8Array(32)));

    let signature: string;
    try {
      signature = await walletProvider.signTypedData({
        domain: {
          name:             "USD Coin",
          version:          "2",
          chainId:          8453,
          verifyingContract: USDC_BASE,
        },
        types:       EIP3009_TYPES,
        primaryType: "TransferWithAuthorization",
        message: {
          from,
          to:          tollAddress,
          value:       valueAtomic,
          validAfter,
          validBefore,
          nonce:       nonce as `0x${string}`,
        },
      });
    } catch (err) {
      return `EIP-3009 signing failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    const paymentPayload = btoa(
      JSON.stringify({
        x402Version: 1,
        scheme:      "exact",
        network:     "base",
        payload: {
          signature,
          authorization: {
            from,
            to:          tollAddress,
            value:       valueAtomic.toString(),
            validAfter:  validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      }),
    );

    // ── Step 3: retry with payment header
    let res: Response;
    try {
      res = await fetch(url.toString(), { headers: { "X-Payment": paymentPayload } });
    } catch (err) {
      return `EZ-Path request failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (res.status === 429) {
      return `Rate limited by EZ-Path. Retry after ${res.headers.get("Retry-After") ?? "60"} seconds.`;
    }
    if (res.status === 402) {
      return "Payment rejected — authorization value may be below the selected tier minimum.";
    }
    if (res.status === 401) {
      const body = await res.json() as { reason?: string };
      return `EZ-Path rejected payment signature: ${body.reason ?? "unknown reason"}`;
    }
    if (!res.ok) {
      const body = await res.json() as { detail?: string };
      return `EZ-Path error ${res.status}: ${body.detail ?? "unknown error"}`;
    }

    const data = await res.json() as {
      buyAmount:        string;
      price:            string;
      sources:          Array<{ name: string; proportion: string }>;
      tier:             string;
      routing_metadata: {
        execution_mode:  string;
        winner:          string;
        race_comparison?: {
          lane_1_aggregator_out: string;
          lane_2_aerodrome_out:  string;
        };
      };
    };

    const settlementTx = res.headers.get("X-Settlement-Tx");
    const meta         = data.routing_metadata;
    const sources      = data.sources
      .map(s => `${s.name} (${(parseFloat(s.proportion) * 100).toFixed(0)}%)`)
      .join(", ");
    const raceInfo = meta.race_comparison
      ? ` | lane_1=${meta.race_comparison.lane_1_aggregator_out} lane_2=${meta.race_comparison.lane_2_aerodrome_out}`
      : "";

    return [
      "EZ-Path quote received.",
      `tier=${data.tier} | winner=${meta.winner} | mode=${meta.execution_mode}${raceInfo}`,
      `price=${data.price} buyToken per sellToken`,
      `buyAmount=${data.buyAmount}`,
      `sources=${sources}`,
      settlementTx ? `settlement_tx=${settlementTx}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  supportsNetwork(network: Network): boolean {
    return network.chainId === "8453";
  }
}

export const ezpathActionProvider = () => new EzPathActionProvider();
