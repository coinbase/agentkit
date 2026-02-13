import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { PolicyCheckAnalyzeSchema, PolicyCheckUrlSchema } from "./schemas";

const POLICYCHECK_A2A_URL = "https://legaleasy.tools/api/a2a";

/**
 * Configuration options for the PolicyCheck action provider.
 */
export interface PolicyCheckConfig {
  /**
   * Override the default PolicyCheck API URL.
   */
  apiUrl?: string;
}

/**
 * PolicyCheckActionProvider enables AI agents to verify e-commerce seller policies
 * before making purchases. It analyzes return policies, shipping terms, warranty
 * coverage, and terms of service to assess buyer protection and risk levels.
 *
 * This is a walletless action provider — no wallet is required.
 */
export class PolicyCheckActionProvider extends ActionProvider {
  private readonly apiUrl: string;

  /**
   * Constructs a new PolicyCheckActionProvider.
   *
   * @param config - Optional configuration.
   */
  constructor(config?: PolicyCheckConfig) {
    super("policycheck", []);
    this.apiUrl = config?.apiUrl || POLICYCHECK_A2A_URL;
  }

  /**
   * Analyze seller policies to assess buyer protection before a purchase.
   *
   * @param args - The input arguments (policyText and/or sellerUrl).
   * @returns A string containing the risk assessment with score, findings, and recommendation.
   */
  @CreateAction({
    name: "policycheck_analyze",
    description: `Analyze an e-commerce seller's policies to assess buyer protection risk BEFORE making a purchase. Returns a risk level (low/medium/high/critical), buyer protection score (0-100), key findings about return policy, shipping, warranty, and terms, and a recommendation on whether to proceed.

Use this action whenever an agent is about to complete a purchase from an online store. Provide either the full policy text or the seller's URL.

Inputs:
- policyText: The full text of the seller's policy to analyze. Provide this OR sellerUrl.
- sellerUrl: The URL of the e-commerce store. The service will find and analyze policies automatically. Provide this OR policyText.

Example risk factors detected:
- No return policy or very short return windows
- Binding arbitration clauses that waive right to class action
- Liability caps that limit seller responsibility
- Missing warranty information
- Restocking fees or buyer-pays-return-shipping policies

Important: If the buyer protection score is below 50, recommend the user reconsider the purchase.`,
    schema: PolicyCheckAnalyzeSchema,
  })
  async analyze(args: z.infer<typeof PolicyCheckAnalyzeSchema>): Promise<string> {
    try {
      // Build A2A message parts based on input type
      const parts: Array<Record<string, unknown>> = [];

      if (args.sellerUrl) {
        parts.push({
          kind: "data",
          data: { seller_url: args.sellerUrl, skill: "quick-risk-check" },
          mimeType: "application/json",
        });
        parts.push({
          kind: "text",
          text: `Quick risk check on ${args.sellerUrl}`,
        });
      } else if (args.policyText) {
        parts.push({
          kind: "text",
          text: args.policyText,
        });
      }

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "message/send",
          params: {
            message: {
              role: "user",
              parts,
            },
          },
          id: Date.now().toString(),
        }),
      });

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `PolicyCheck API returned HTTP ${response.status}`,
        });
      }

      const data = await response.json();

      if (data.error) {
        return JSON.stringify({
          success: false,
          error: data.error.message || "PolicyCheck analysis failed",
        });
      }

      // Extract analysis from A2A response artifacts
      const result = data.result;
      const artifacts = result?.artifacts || [];
      let analysisData: Record<string, unknown> | null = null;
      let summaryText = "";

      for (const artifact of artifacts) {
        for (const part of artifact.parts || []) {
          if (part.kind === "data" && part.data) {
            analysisData = part.data;
          } else if (part.kind === "text" && part.text) {
            summaryText = part.text;
          }
        }
      }

      if (analysisData) {
        return JSON.stringify({
          success: true,
          riskLevel: analysisData.riskLevel,
          buyerProtectionScore: analysisData.buyerProtectionScore,
          keyFindings: analysisData.keyFindings,
          recommendation: analysisData.recommendation,
          summary: summaryText || undefined,
          analyzedUrl: args.sellerUrl || "direct text analysis",
        });
      }

      // Fallback: return text summary if no structured data
      if (summaryText) {
        return JSON.stringify({
          success: true,
          summary: summaryText,
          analyzedUrl: args.sellerUrl || "direct text analysis",
        });
      }

      return JSON.stringify({
        success: false,
        error: "No analysis data returned from PolicyCheck",
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `PolicyCheck request failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Quick URL-based seller check.
   *
   * @param args - The seller URL to check.
   * @returns A string containing the risk assessment.
   */
  @CreateAction({
    name: "policycheck_check_url",
    description: `Quick check of an e-commerce seller's URL to assess buyer protection before purchasing. Provide the store URL and the service will find and analyze the seller's policies automatically. Returns risk level, buyer protection score, and key findings.

Use this as a fast pre-purchase verification step when you have a seller's URL.

Inputs:
- sellerUrl: The URL of the e-commerce store to check (e.g., 'https://example-store.com').`,
    schema: PolicyCheckUrlSchema,
  })
  async checkUrl(args: z.infer<typeof PolicyCheckUrlSchema>): Promise<string> {
    return this.analyze({ sellerUrl: args.sellerUrl });
  }

  /**
   * Checks if this provider supports the given network.
   * PolicyCheck is walletless and works on all networks.
   *
   * @returns Always true.
   */
  supportsNetwork = () => true;
}

/**
 * Factory function to create a PolicyCheckActionProvider instance.
 *
 * @param config - Optional configuration.
 * @returns A new PolicyCheckActionProvider instance.
 */
export const policycheckActionProvider = (config?: PolicyCheckConfig) =>
  new PolicyCheckActionProvider(config);
