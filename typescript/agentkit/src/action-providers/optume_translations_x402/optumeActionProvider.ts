/**
 * Optume Translations x402 Action Provider for Coinbase AgentKit (TypeScript).
 *
 * Enables autonomous AI agents using Coinbase AgentKit to natively parse documents,
 * extract spatial AST structures, generate legal glossaries, perform legal QA audits,
 * and execute multi-language legal translations over x402 micropayments ($0.01 - $0.50 USDC)
 * settled on Base Layer-2.
 */

import { z } from "zod";

export const ParseDocumentSchema = z.object({
  documentUrl: z
    .string()
    .url()
    .describe("Public URL or accessible link of the document (PDF, DOCX, XLSX, PPTX, image) to parse."),
});

export const ExtractVeritasChunksSchema = z.object({
  documentUrl: z
    .string()
    .url()
    .describe("Public URL of document to extract spatial AST layout, table grids, and clause hierarchies."),
});

export const AnalyzeLegalDocumentSchema = z
  .object({
    rawText: z.string().optional().describe("Raw legal contract text to ingest and analyze."),
    documentUrl: z
      .string()
      .url()
      .optional()
      .describe("Public URL of legal contract to analyze."),
    targetLanguage: z.string().default("fr").describe("ISO target language code."),
  })
  .refine((data) => Boolean(data.rawText || data.documentUrl), {
    message: "At least one of rawText or documentUrl must be provided.",
  });

export const CompileContextSchema = z.object({
  documentId: z.string().describe("Unique Document ID from pre-translation analysis."),
  targetLanguage: z
    .string()
    .default("fr")
    .describe("ISO language code for target translation (e.g., 'fr', 'es', 'de', 'ar', 'zh')."),
});

export const TranslateClausesSchema = z.object({
  documentId: z.string().describe("Unique Document ID with compiled context directives."),
  targetLanguage: z.string().default("fr").describe("ISO target language code."),
  concurrencyLimit: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(10)
    .describe("Parallel translation concurrency limit."),
});

export const EvaluateQASchema = z.object({
  documentId: z
    .string()
    .describe("Unique Document ID of translated legal contract to run QA risk and terminology audit."),
});

export const AssembleDocumentSchema = z.object({
  documentId: z
    .string()
    .describe("Unique Document ID to assemble into final spatial-layout-preserved document."),
});

export const RunFullPipelineSchema = z
  .object({
    rawText: z.string().optional().describe("Raw text of contract to translate."),
    documentUrl: z
      .string()
      .url()
      .optional()
      .describe("Public URL of document to execute complete end-to-end 7-node Veritas legal translation pipeline."),
    sourceLanguage: z.string().default("en").describe("ISO source language code (e.g. 'en')."),
    targetLanguage: z.string().default("fr").describe("ISO target language code (e.g. 'fr', 'es', 'de', 'ar', 'zh')."),
  })
  .refine((data) => Boolean(data.rawText || data.documentUrl), {
    message: "At least one of rawText or documentUrl must be provided.",
  });

export interface ActionProvider {
  name: string;
  supportsNetwork(network: Record<string, unknown> | string): boolean;
  getActions(): Array<{
    name: string;
    description: string;
    schema: z.ZodTypeAny;
    invoke: (args: Record<string, unknown>, proof?: string) => Promise<string>;
  }>;
}

export class OptumeActionProvider implements ActionProvider {
  public name = "optume";
  public baseUrl: string;

  constructor(baseUrl: string = "https://api.optranslations.com") {
    const trimmed = baseUrl.replace(/\/$/, "");
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.protocol !== "https:" &&
        !(
          parsed.protocol === "http:" &&
          (parsed.hostname === "localhost" ||
            parsed.hostname === "127.0.0.1" ||
            parsed.hostname === "testserver")
        )
      ) {
        throw new Error("Invalid baseUrl protocol. Must use HTTPS for remote endpoints.");
      }
      this.baseUrl = trimmed;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Check whether target EVM network is supported (Base Mainnet / Sepolia).
   */
  public supportsNetwork(network: Record<string, unknown> | string): boolean {
    let netStr = "";
    if (typeof network === "string") {
      netStr = network.toLowerCase().trim();
    } else if (network && typeof network === "object") {
      const rec = network as Record<string, unknown>;
      netStr = String(rec.networkId || rec.chainId || JSON.stringify(network)).toLowerCase().trim();
    }
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

  private buildChallengeResponse(response: Response, body: unknown): Record<string, unknown> {
    return {
      statusCode: response.status,
      x402Challenge: {
        priceUsdc: response.headers.get("x-402-price-usdc"),
        payTo: response.headers.get("x-402-pay-to"),
        network: response.headers.get("x-402-network") || "eip155:8453",
      },
      response: body,
    };
  }

  private validateRedirect(
    response: Response,
    currentUrl: string
  ): { redirectUrl?: string; error?: string } {
    if (response.status < 300 || response.status >= 400) {
      return {};
    }
    const location = response.headers.get("location");
    if (!location) {
      return {};
    }
    const currentParsed = new URL(currentUrl);
    const targetParsed = new URL(location, currentUrl);

    if (targetParsed.hostname !== currentParsed.hostname) {
      return { error: `Redirect rejected: Cross-origin redirect to ${targetParsed.hostname} is forbidden.` };
    }
    if (currentParsed.protocol === "https:" && targetParsed.protocol !== "https:") {
      return { error: "Redirect rejected: Protocol downgrade from HTTPS to HTTP is forbidden." };
    }
    return { redirectUrl: targetParsed.toString() };
  }

  /**
   * Return catalog of x402 actions exposed to Coinbase AgentKit.
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
        name: "extract_veritas_chunks",
        description:
          "Extracts spatial AST layout, table grids, and clause structural hierarchies ($0.025 USDC on Base L2).",
        schema: ExtractVeritasChunksSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = ExtractVeritasChunksSchema.parse(args);
          return JSON.stringify(await this.executeFileUploadRequest("/api/v1/parser/veritas-chunks", parsed.documentUrl, proof));
        },
      },
      {
        name: "analyze_legal_document",
        description:
          "Ingestion, defined legal terms extraction, and structured legal glossary generation ($0.050 USDC on Base L2).",
        schema: AnalyzeLegalDocumentSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = AnalyzeLegalDocumentSchema.parse(args);
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
            target_language: parsed.targetLanguage || "fr",
          };
          return JSON.stringify(await this.executeX402Request("/api/v1/veritas/analyze", body, proof));
        },
      },
      {
        name: "compile_translation_context",
        description:
          "Filters sub-glossaries and compiles translation directives per clause chunk ($0.020 USDC on Base L2).",
        schema: CompileContextSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = CompileContextSchema.parse(args);
          const path = `/api/v1/veritas/compile-context?document_id=${encodeURIComponent(parsed.documentId)}`;
          return JSON.stringify(await this.executeX402Request(path, {}, proof));
        },
      },
      {
        name: "translate_legal_clauses",
        description:
          "Parallel clause translation engine preserving formatting across 50+ languages ($0.150 USDC on Base L2).",
        schema: TranslateClausesSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = TranslateClausesSchema.parse(args);
          const path = `/api/v1/veritas/translate?document_id=${encodeURIComponent(parsed.documentId)}&concurrency_limit=${parsed.concurrencyLimit || 10}`;
          return JSON.stringify(await this.executeX402Request(path, {}, proof));
        },
      },
      {
        name: "audit_legal_qa",
        description:
          "Multi-dimensional audit of legal terminology, numerical accuracy, and omissions ($0.050 USDC on Base L2).",
        schema: EvaluateQASchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = EvaluateQASchema.parse(args);
          const path = `/api/v1/veritas/evaluate-qa?document_id=${encodeURIComponent(parsed.documentId)}`;
          return JSON.stringify(await this.executeX402Request(path, {}, proof));
        },
      },
      {
        name: "assemble_translated_document",
        description:
          "Re-assembles translated text into layout-preserving original document structures ($0.050 USDC on Base L2).",
        schema: AssembleDocumentSchema,
        invoke: async (args: Record<string, unknown>, proof?: string) => {
          const parsed = AssembleDocumentSchema.parse(args);
          const path = `/api/v1/veritas/assemble-document?document_id=${encodeURIComponent(parsed.documentId)}`;
          return JSON.stringify(await this.executeX402Request(path, {}, proof));
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
