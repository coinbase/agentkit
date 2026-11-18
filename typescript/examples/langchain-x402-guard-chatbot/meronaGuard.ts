import { customActionProvider } from "@coinbase/agentkit";
import { Guard } from "merona-guard";
import { z } from "zod";

/**
 * Map an x402 network id to a chain merona indexes. x402 uses CAIP-2
 * (`eip155:8453`, `solana:...`); merona covers base / polygon / solana. Anything
 * else is passed through — merona then returns an UNCERTAIN the model can act on.
 */
function meronaChain(network: string): string {
  const n = network.toLowerCase();
  if (n === "eip155:8453" || n === "base") return "base";
  if (n === "eip155:137" || n === "polygon") return "polygon";
  if (n.startsWith("solana")) return "solana";
  return n;
}

// Free, no key. Verdicts are cached for their TTL and fail soft: if merona is
// unreachable the result is an UNCERTAIN, never a thrown error into the loop.
const guard = new Guard();

/**
 * A self-contained, opt-in action provider that checks an x402 seller wallet
 * with merona BEFORE the agent pays it. It slots between x402ActionProvider's
 * two existing actions:
 *
 *   make_http_request  ->  check_x402_seller  ->  retry_http_request_with_x402
 *
 * `make_http_request` returns the 402 payment requirements (including the seller
 * `payTo` and `network`); this action checks that seller; the agent only calls
 * `retry_http_request_with_x402` if the verdict is not a recorded FAIL.
 *
 * merona (https://merona.io) is a free, keyless, independent x402 settlement
 * index. Verdicts are PASS / FAIL / UNCERTAIN and recomputable from public
 * on-chain data. The returned reason is recorded-fact only — a model reasoning
 * over it reads "a paid probe recorded a settled payment with no content
 * returned", never a slur about the seller.
 */
export const meronaGuardActionProvider = () =>
  customActionProvider({
    name: "check_x402_seller",
    description:
      "Check an x402 seller wallet with merona BEFORE paying it. Returns a recorded-fact " +
      "PASS / FAIL / UNCERTAIN verdict. Call this after make_http_request returns the 402 " +
      "payment requirements, using their payTo and network, and BEFORE calling " +
      "retry_http_request_with_x402. Do not pay on FAIL; on UNCERTAIN, ask the user first.",
    schema: z.object({
      payTo: z.string().describe("The seller wallet address from the 402 payment requirements"),
      network: z
        .string()
        .describe("The network from the 402 requirements, e.g. 'base' or a CAIP-2 id like 'eip155:8453'"),
    }),
    invoke: async (args: { payTo: string; network: string }) => {
      const r = await guard.check(args.payTo, meronaChain(args.network));
      return r.explain();
    },
  });
