import { ActionProvider } from "@coinbase/agentkit";
import { z } from "zod";

export const ParseDocumentSchema = z.object({
  documentUrl: z
    .string()
    .url()
    .describe("Public URL or file link of document (PDF, DOCX, XLSX, PPTX, Image) to parse."),
});

export const RunFullPipelineSchema = z.object({
  rawText: z
    .string()
    .optional()
    .describe("Raw legal contract text to translate."),
  documentUrl: z
    .string()
    .url()
    .optional()
    .describe("Public URL of legal document to execute complete 7-node Veritas pipeline."),
  sourceLanguage: z
    .string()
    .default("en")
    .describe("ISO source language code (default 'en')."),
  targetLanguage: z
    .string()
    .default("fr")
    .describe("ISO target language code (e.g. 'fr', 'es', 'de', 'ar', 'zh')."),
});

export class OptumeActionProvider extends ActionProvider {
  private baseUrl: string;

  constructor(baseUrl: string = "https://api.optranslations.com") {
    super("optume", []);

    const parsed = new URL(baseUrl);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw new Error(`Invalid baseUrl protocol '${parsed.protocol}'. Must be HTTPS.`);
    }
    if (
      parsed.protocol === "http:" &&
      !["localhost", "127.0.0.1", "testserver"].includes(parsed.hostname)
    ) {
      throw new Error("Insecure HTTP baseUrl allowed only for local testing.");
    }

    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public supportsNetwork(network: { networkId?: string; chainId?: string } | string): boolean {
    let netStr = typeof network === "string" ? network : network.networkId || network.chainId || "";
    netStr = netStr.toLowerCase().trim();

    const supportedBases = new Set([
      "base",
      "8453",
      "84532",
      "eip155:8453",
      "eip155:84532",
      "base-mainnet",
      "base-sepolia",
    ]);

    return supportedBases.has(netStr);
  }

  private validateRedirect(
    response: Response,
    currentUrl: string
  ): { redirectUrl?: string; error?: string } {
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) {
        return { error: `Redirect response missing Location header (HTTP ${response.status}).` };
      }

      const origParsed = new URL(currentUrl);
      const newParsed = new URL(location, currentUrl);

      if (
        origParsed.host.toLowerCase() !== newParsed.host.toLowerCase() ||
        origParsed.protocol.toLowerCase() !== newParsed.protocol.toLowerCase()
      ) {
        return {
          error: `Redirect rejected: cross-origin redirect to ${newParsed.host} is forbidden.`,
        };
      }

      if (origParsed.protocol === "https:" && newParsed.protocol !== "https:") {
        return {
          error: "Redirect rejected: protocol downgrade from HTTPS to HTTP is forbidden.",
        };
      }

      return { redirectUrl: newParsed.toString() };
    }
    return {};
  }

  private buildChallengeResponse(response: Response, body: unknown): Record<string, unknown> {
    return {
      statusCode: response.status,
      x402Challenge: {
        priceUsdc: response.headers.get("X-402-Price-USDC") || null,
        payTo: response.headers.get("X-402-Pay-To") || null,
        network: response.headers.get("X-402-Network") || "eip155:8453",
      },
      response: body,
    };
  }

  /**
   * Return catalog of active x402 actions exposed to Coinbase AgentKit.
   */
  public getActions() {
    return [
      {
        name: "parse_document",
        description:
          "High-speed spatial document parsing for PDF, DOCX, XLSX, PPTX, and OCR Images ($0.010 USDC on Base L2).",
        schema: ParseDocumentSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = ParseDocumentSchema.parse(args);
          return JSON.stringify(await this.executeFileUploadRequest("/api/v1/parser/analyze", parsed.documentUrl, proof));
        },
      },
      {
        name: "veritas_legal_translation",
        description:
          "Turnkey legal-grade document translation engine combining all 7 Veritas pipeline nodes ($0.0005/word, min $0.05 USDC on Base L2).",
        schema: RunFullPipelineSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = RunFullPipelineSchema.parse(args);
          let rawText = parsed.rawText || "";
          if (!rawText && parsed.documentUrl) {
            const resp = await fetch(parsed.documentUrl);
            if (!resp.ok) {
              return JSON.stringify({ error: `Failed to download document from URL: ${resp.statusText}` });
            }
            rawText = await resp.text();
          }
          const body = {
            raw_text: rawText,
            source_language: parsed.sourceLanguage || "en",
            target_language: parsed.targetLanguage || "fr",
          };
          return JSON.stringify(await this.executeX402Request("/api/v1/veritas/run-full", body, proof));
        },
      },
      {
        name: "run_full_veritas_pipeline",
        description:
          "Complete end-to-end legal translation pipeline across all 7 Veritas nodes ($0.0005/word, min $0.05 USDC on Base L2).",
        schema: RunFullPipelineSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = RunFullPipelineSchema.parse(args);
          let rawText = parsed.rawText || "";
          if (!rawText && parsed.documentUrl) {
            const resp = await fetch(parsed.documentUrl);
            if (!resp.ok) {
              return JSON.stringify({ error: `Failed to download document from URL: ${resp.statusText}` });
            }
            rawText = await resp.text();
          }
          const body = {
            raw_text: rawText,
            source_language: parsed.sourceLanguage || "en",
            target_language: parsed.targetLanguage || "fr",
          };
          return JSON.stringify(await this.executeX402Request("/api/v1/veritas/run-full", body, proof));
        },
      },
    ];
  }

  public async executeFileUploadRequest(
    endpointPath: string,
    documentUrl: string,
    x402PaymentProof?: string
  ): Promise<unknown> {
    const docResp = await fetch(documentUrl);
    if (!docResp.ok) {
      return { error: `Failed to download document from URL: ${docResp.statusText}` };
    }
    const blob = await docResp.blob();

    let fileName = "document.pdf";
    try {
      fileName = new URL(documentUrl).pathname.split("/").pop() || "document.pdf";
    } catch {
      fileName = documentUrl.split("/").pop() || "document.pdf";
    }

    const formData = new FormData();
    formData.append("file", blob, fileName);

    let targetUrl = `${this.baseUrl}${endpointPath}`;
    const headers: Record<string, string> = {};
    if (x402PaymentProof) {
      headers["X-402-Payment-Proof"] = x402PaymentProof;
    }

    try {
      let redirectsFollowed = 0;
      const maxRedirects = 5;

      while (redirectsFollowed <= maxRedirects) {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: formData,
          redirect: "manual",
        });

        const redirectCheck = this.validateRedirect(response, targetUrl);
        if (redirectCheck.error) {
          return { error: redirectCheck.error };
        }
        if (redirectCheck.redirectUrl) {
          targetUrl = redirectCheck.redirectUrl;
          redirectsFollowed += 1;
          continue;
        }

        const body = await response.json();
        if (!response.ok) {
          return this.buildChallengeResponse(response, body);
        }
        return body;
      }
      return { error: "Too many redirects followed." };
    } catch (error) {
      return { error: String(error) };
    }
  }

  public async executeX402Request(
    endpointPath: string,
    payload: Record<string, unknown>,
    x402PaymentProof?: string
  ): Promise<unknown> {
    let targetUrl = `${this.baseUrl}${endpointPath}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (x402PaymentProof) {
      headers["X-402-Payment-Proof"] = x402PaymentProof;
    }

    try {
      let redirectsFollowed = 0;
      const maxRedirects = 5;

      while (redirectsFollowed <= maxRedirects) {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          redirect: "manual",
        });

        const redirectCheck = this.validateRedirect(response, targetUrl);
        if (redirectCheck.error) {
          return { error: redirectCheck.error };
        }
        if (redirectCheck.redirectUrl) {
          targetUrl = redirectCheck.redirectUrl;
          redirectsFollowed += 1;
          continue;
        }

        const body = await response.json();
        if (!response.ok) {
          return this.buildChallengeResponse(response, body);
        }
        return body;
      }
      return { error: "Too many redirects followed." };
    } catch (error) {
      return { error: String(error) };
    }
  }
}

export function optumeActionProvider(baseUrl: string = "https://api.optranslations.com"): OptumeActionProvider {
  return new OptumeActionProvider(baseUrl);
}
