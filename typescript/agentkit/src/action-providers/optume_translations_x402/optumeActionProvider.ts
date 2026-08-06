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

export const AnalyzeLegalDocumentSchema = z.object({
  documentUrl: z
    .string()
    .url()
    .describe("Public URL of the legal contract to extract defined terms and generate structured legal glossary."),
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

export const RunFullPipelineSchema = z.object({
  documentUrl: z
    .string()
    .url()
    .describe("Public URL of document to execute complete end-to-end 7-node Veritas legal translation pipeline."),
  sourceLanguage: z.string().default("en").describe("ISO source language code (e.g. 'en')."),
  targetLanguage: z.string().default("fr").describe("ISO target language code (e.g. 'fr', 'es', 'de', 'ar', 'zh')."),
});

export class OptumeActionProvider {
  public name = "optume";
  public baseUrl: string;

  constructor(baseUrl: string = "https://api.optranslations.com") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
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
        invoke: (args: z.infer<typeof ParseDocumentSchema>, proof?: string) =>
          this.executeX402Request("/api/v1/parser/analyze", args, proof),
      },
      {
        name: "extract_veritas_chunks",
        description:
          "Extracts spatial AST layout, table grids, and clause structural hierarchies ($0.025 USDC on Base L2).",
        schema: ExtractVeritasChunksSchema,
        invoke: (args: z.infer<typeof ExtractVeritasChunksSchema>, proof?: string) =>
          this.executeX402Request("/api/v1/parser/veritas-chunks", args, proof),
      },
      {
        name: "analyze_legal_document",
        description:
          "Ingestion, defined legal terms extraction, and structured legal glossary generation ($0.050 USDC on Base L2).",
        schema: AnalyzeLegalDocumentSchema,
        invoke: (args: z.infer<typeof AnalyzeLegalDocumentSchema>, proof?: string) =>
          this.executeX402Request("/api/v1/veritas/analyze", args, proof),
      },
      {
        name: "compile_translation_context",
        description:
          "Filters sub-glossaries and compiles translation directives per clause chunk ($0.020 USDC on Base L2).",
        schema: CompileContextSchema,
        invoke: (args: z.infer<typeof CompileContextSchema>, proof?: string) =>
          this.executeX402Request("/api/v1/veritas/compile-context", args, proof),
      },
      {
        name: "translate_legal_clauses",
        description:
          "Parallel clause translation engine preserving formatting across 50+ languages ($0.150 USDC on Base L2).",
        schema: TranslateClausesSchema,
        invoke: (args: z.infer<typeof TranslateClausesSchema>, proof?: string) =>
          this.executeX402Request("/api/v1/veritas/translate", args, proof),
      },
      {
        name: "audit_legal_qa",
        description:
          "Multi-dimensional audit of legal terminology, numerical accuracy, and omissions ($0.050 USDC on Base L2).",
        schema: EvaluateQASchema,
        invoke: (args: z.infer<typeof EvaluateQASchema>, proof?: string) =>
          this.executeX402Request("/api/v1/veritas/evaluate-qa", args, proof),
      },
      {
        name: "assemble_translated_document",
        description:
          "Re-assembles translated text into layout-preserving original document structures ($0.050 USDC on Base L2).",
        schema: AssembleDocumentSchema,
        invoke: (args: z.infer<typeof AssembleDocumentSchema>, proof?: string) =>
          this.executeX402Request("/api/v1/veritas/assemble-document", args, proof),
      },
      {
        name: "run_full_veritas_pipeline",
        description:
          "Complete end-to-end legal translation pipeline across all 7 Veritas nodes ($0.500 USDC on Base L2).",
        schema: RunFullPipelineSchema,
        invoke: (args: z.infer<typeof RunFullPipelineSchema>, proof?: string) =>
          this.executeX402Request("/api/v1/veritas/run-full", args, proof),
      },
    ];
  }

  private async executeX402Request(
    endpointPath: string,
    payload: Record<string, unknown>,
    x402PaymentProof?: string
  ): Promise<unknown> {
    const url = `${this.baseUrl}${endpointPath}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (x402PaymentProof) {
      headers["X-402-Payment-Proof"] = x402PaymentProof;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const body = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          x402Challenge: {
            priceUsdc: response.headers.get("x-402-price-usdc"),
            payTo: response.headers.get("x-402-pay-to"),
            network: response.headers.get("x-402-network") || "base",
          },
          response: body,
        };
      }

      return body;
    } catch (error) {
      return { error: String(error) };
    }
  }
}

export function optumeActionProvider(baseUrl: string = "https://api.optranslations.com"): OptumeActionProvider {
  return new OptumeActionProvider(baseUrl);
}
