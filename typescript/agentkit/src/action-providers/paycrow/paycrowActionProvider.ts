import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  TrustGateSchema,
  SafePaySchema,
  EscrowCreateSchema,
  RateServiceSchema,
} from "./schemas";

const PAYCROW_API_BASE = "https://paycrow-app.fly.dev";

/**
 * PayCrowActionProvider provides actions for trust-informed escrow payments via PayCrow.
 *
 * PayCrow is a trust layer for agent-to-agent payments. It allows agents to check
 * trust scores before paying, create USDC escrows with timelocks, and rate completed
 * services to build on-chain reputation.
 *
 * API: https://paycrow-app.fly.dev
 * npm: paycrow
 * GitHub: https://github.com/michu5696/paycrow
 */
export class PayCrowActionProvider extends ActionProvider {
  /**
   * Constructs a new PayCrowActionProvider.
   */
  constructor() {
    super("paycrow", []);
  }

  /**
   * Check an agent's trust score before paying.
   *
   * @param args - The arguments for the action.
   * @returns The trust gate decision as stringified JSON.
   */
  @CreateAction({
    name: "trust_gate",
    description: `Check an agent or seller's trust score before making a payment using PayCrow.

This tool queries the PayCrow trust API to evaluate whether it is safe to pay a given address.
It returns a decision (proceed, caution, or block), a recommended timelock duration, and a
maximum recommended payment amount based on the address's on-chain reputation.

Inputs:
- address: The wallet address to check (e.g. "0x1234...")
- intendedAmount (optional): The amount in USDC you intend to pay, used for threshold evaluation

Use this action BEFORE making any payment to an unfamiliar agent or seller.
If the decision is "block", do NOT proceed with payment.
If the decision is "caution", warn the user and suggest a shorter timelock or smaller amount.
`,
    schema: TrustGateSchema,
  })
  async trustGate(args: z.infer<typeof TrustGateSchema>): Promise<string> {
    try {
      const params = new URLSearchParams({ address: args.address });
      if (args.intendedAmount !== undefined) {
        params.set("amount", args.intendedAmount.toString());
      }

      const response = await fetch(`${PAYCROW_API_BASE}/api/trust?${params.toString()}`);

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `Trust API returned HTTP ${response.status}`,
        });
      }

      const data = await response.json();

      return JSON.stringify({
        success: true,
        address: args.address,
        ...data,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to check trust score: ${error}`,
      });
    }
  }

  /**
   * Make a trust-informed escrow payment via PayCrow.
   *
   * @param args - The arguments for the action.
   * @returns The escrow result as stringified JSON.
   */
  @CreateAction({
    name: "safe_pay",
    description: `Make a trust-informed escrow payment via PayCrow.

This tool combines trust checking and escrow creation into a single action. It first checks
the seller's trust score, then creates an escrow with an appropriate timelock based on the
trust level. The escrow protects the buyer by holding funds until the service is delivered.

Inputs:
- url: The service URL being paid for (e.g. "https://api.example.com/service")
- sellerAddress: The wallet address of the seller (e.g. "0x1234...")
- amountUsdc: The amount in USDC to pay (e.g. 5.0)

The result includes the escrow status (released or disputed) and transaction details.
If the seller's trust score is too low, the payment will be blocked automatically.
`,
    schema: SafePaySchema,
  })
  async safePay(args: z.infer<typeof SafePaySchema>): Promise<string> {
    try {
      const response = await fetch(`${PAYCROW_API_BASE}/api/safe-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: args.url,
          seller: args.sellerAddress,
          amount_usdc: args.amountUsdc,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          success: false,
          error: `Safe pay API returned HTTP ${response.status}: ${errorText}`,
        });
      }

      const data = await response.json();

      return JSON.stringify({
        success: true,
        ...data,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to execute safe pay: ${error}`,
      });
    }
  }

  /**
   * Create a USDC escrow via PayCrow.
   *
   * @param args - The arguments for the action.
   * @returns The escrow creation result as stringified JSON.
   */
  @CreateAction({
    name: "escrow_create",
    description: `Create a USDC escrow via PayCrow.

This tool creates a new escrow that holds USDC funds until the service is delivered or the
timelock expires. The escrow protects both buyer and seller in agent-to-agent transactions.

Inputs:
- seller: The wallet address of the seller (e.g. "0x1234...")
- amountUsdc: The amount in USDC to escrow (e.g. 10.0)
- timelockMinutes: How long to lock funds before auto-release (default: 60 minutes)
- serviceUrl: The URL of the service being purchased (e.g. "https://api.example.com/data")

Returns an escrowId and txHash that can be used to track or rate the escrow later.
Use the trust_gate action first to determine an appropriate timelock duration.
`,
    schema: EscrowCreateSchema,
  })
  async escrowCreate(args: z.infer<typeof EscrowCreateSchema>): Promise<string> {
    try {
      const response = await fetch(`${PAYCROW_API_BASE}/api/escrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller: args.seller,
          amount_usdc: args.amountUsdc,
          timelock_minutes: args.timelockMinutes,
          service_url: args.serviceUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          success: false,
          error: `Escrow API returned HTTP ${response.status}: ${errorText}`,
        });
      }

      const data = await response.json();

      return JSON.stringify({
        success: true,
        ...data,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to create escrow: ${error}`,
      });
    }
  }

  /**
   * Rate a completed escrow service via PayCrow.
   *
   * @param args - The arguments for the action.
   * @returns The rating confirmation as stringified JSON.
   */
  @CreateAction({
    name: "rate_service",
    description: `Rate a completed escrow service via PayCrow.

This tool submits a rating (1-5 stars) for a completed escrow. Ratings contribute to the
seller's on-chain trust score, which affects future trust_gate decisions for that seller.

Inputs:
- escrowId: The ID of the completed escrow to rate (returned by escrow_create or safe_pay)
- stars: A rating from 1 (poor) to 5 (excellent)

Always rate completed escrows to help build the trust network. Higher ratings improve
the seller's trust score, leading to higher recommended payment limits and shorter timelocks.
`,
    schema: RateServiceSchema,
  })
  async rateService(args: z.infer<typeof RateServiceSchema>): Promise<string> {
    try {
      const response = await fetch(`${PAYCROW_API_BASE}/api/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escrow_id: args.escrowId,
          stars: args.stars,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          success: false,
          error: `Rating API returned HTTP ${response.status}: ${errorText}`,
        });
      }

      const data = await response.json();

      return JSON.stringify({
        success: true,
        ...data,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to rate service: ${error}`,
      });
    }
  }

  /**
   * Checks if the PayCrow action provider supports the given network.
   * PayCrow is network-agnostic (trust API works across all networks).
   *
   * @returns True, as PayCrow supports all networks.
   */
  supportsNetwork = () => true;
}

/**
 * Factory function to create a new PayCrowActionProvider instance.
 *
 * @returns A new PayCrowActionProvider instance.
 */
export const paycrowActionProvider = () => new PayCrowActionProvider();
