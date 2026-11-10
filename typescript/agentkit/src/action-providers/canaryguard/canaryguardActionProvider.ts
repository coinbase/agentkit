import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { CanaryGuardSanitizeSchema } from "./schemas";
import { CANARYGUARD_DEFAULT_URL } from "./constants";

/**
 * CanaryGuardActionProvider provides deterministic prompt-injection firewall
 * and honeypot scrubbing for autonomous agents on Base via x402.
 */
export class CanaryGuardActionProvider extends ActionProvider {
  private serviceUrl: string;
  private paymentHeader?: string;

  constructor(config?: { serviceUrl?: string; paymentHeader?: string }) {
    super("canaryguard", []);
    this.serviceUrl = (config?.serviceUrl || CANARYGUARD_DEFAULT_URL).replace(/\/$/, "");
    this.paymentHeader = config?.paymentHeader || process.env.CANARYGUARD_PAYMENT_HEADER;
  }

  @CreateAction({
    name: "sanitize_text",
    description: `Sanitizes untrusted text, user input, scraped websites, or third-party tool outputs using CanaryGuard 402 on Base mainnet. Detects and scrubs prompt-injection exploits, malicious instructions, concealed Unicode, and wallet-draining commands before context ingestion.
Inputs:
- content: The untrusted text to inspect and scrub (1 to 50,000 characters).
- strict_mode: When true (default), completely blocks detected instruction overrides and wallet transfer attempts.`,
    schema: CanaryGuardSanitizeSchema,
  })
  async sanitize(args: z.infer<typeof CanaryGuardSanitizeSchema>): Promise<string> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.paymentHeader) {
        headers["PAYMENT-SIGNATURE"] = this.paymentHeader;
        headers["X-PAYMENT"] = this.paymentHeader;
      }

      // If no payment header is configured, route to zero-wallet instant evaluation preview
      const endpoint = this.paymentHeader
        ? `${this.serviceUrl}/v1/sanitize`
        : `${this.serviceUrl}/v1/sanitize/preview`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: args.content,
          strict_mode: args.strict_mode ?? true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          error: `CanaryGuard HTTP ${response.status}`,
          details: errorText,
        });
      }

      const result = await response.json();
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: "Failed to execute CanaryGuard sanitization",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  supportsNetwork = (_network: Network) => true;
}

export const canaryguardActionProvider = (config?: { serviceUrl?: string; paymentHeader?: string }) =>
  new CanaryGuardActionProvider(config);
