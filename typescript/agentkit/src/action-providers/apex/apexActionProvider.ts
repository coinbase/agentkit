import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { DeliveryScoreSchema, TxCheckSchema } from "./schemas";

const TX_CHECK = "https://apexfaucet.xyz/api/x402/tx-check";
const DELIVERY_SCORE = "https://apexfaucet.xyz/api/x402/delivery-score";

async function readPublic(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const text = await response.text();
  let body: unknown = text.slice(0, 8000);
  try {
    body = JSON.parse(text);
  } catch {
    // keep the clipped text
  }
  if (response.status === 402) {
    return JSON.stringify({
      paid: false,
      http: 402,
      note: "Unpaid. Pay the returned x402 terms with your own wallet, then retry. Nothing was signed here.",
      terms: body,
    });
  }
  return JSON.stringify({ http: response.status, body });
}

/**
 * ApexActionProvider calls the public APEX x402 routes.
 * It does not hold a key and it does not pay.
 */
export class ApexActionProvider extends ActionProvider {
  constructor() {
    super("apex", []);
  }

  @CreateAction({
    name: "tx_check",
    description: `Check one unsigned Base or Solana transaction and return SAFE or RISKY.
Base flags a simulation revert, an unlimited approval, an approval-for-all, a hidden token move, and one exit check.
Solana flags a simulation revert, a token drain, a delegate approval, and a rug mint.
Nothing is signed or broadcast. Price is 0.001 USDC. A free sample is at https://apexfaucet.xyz/tx-check.
On HTTP 402, pay the terms with your own wallet. Do not send a private key.`,
    schema: TxCheckSchema,
  })
  async txCheck(args: z.infer<typeof TxCheckSchema>): Promise<string> {
    const params = new URLSearchParams();
    const chain = args.chain || "base";
    if (chain === "solana") {
      params.set("chain", "solana");
      const signer = args.signer || args.from;
      const tx = args.tx || args.raw;
      if (!signer || !tx) {
        return JSON.stringify({
          success: false,
          error: "Solana needs signer (or from) and tx (or raw). Do not pass a private key.",
        });
      }
      params.set("signer", signer);
      params.set("tx", tx);
    } else {
      if (!args.from) {
        return JSON.stringify({ success: false, error: "Base needs from, plus to and data, or raw." });
      }
      params.set("from", args.from);
      if (args.raw) params.set("raw", args.raw);
      else {
        if (!args.to) return JSON.stringify({ success: false, error: "Base needs to and data, or raw." });
        params.set("to", args.to);
        params.set("data", args.data || "0x");
        if (args.value) params.set("value", args.value);
      }
    }
    return readPublic(`${TX_CHECK}?${params.toString()}`);
  }

  @CreateAction({
    name: "delivery_score",
    description: `Score one https x402 URL from 0 to 100.
Five parts of 0 to 20: watchtower 7-day uptime for that exact URL, a valid unpaid 402, the USDC price, probe speed, and test buys already recorded.
This action does not pay the URL. A URL never bought scores 0 on test buys.
Price is 0.003 USDC. A free sample is at https://apexfaucet.xyz/delivery-score?url=https://apexfaucet.xyz/api/x402/page-markdown.
On HTTP 402, pay the terms with your own wallet.`,
    schema: DeliveryScoreSchema,
  })
  async deliveryScore(args: z.infer<typeof DeliveryScoreSchema>): Promise<string> {
    if (!args.url.startsWith("https://")) {
      return JSON.stringify({ success: false, error: "url must start with https://" });
    }
    const params = new URLSearchParams({ url: args.url });
    return readPublic(`${DELIVERY_SCORE}?${params.toString()}`);
  }

  supportsNetwork = () => true;
}

export const apexActionProvider = () => new ApexActionProvider();
