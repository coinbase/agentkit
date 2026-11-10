import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { TruthbearVerifySchema } from "./schemas";

const TRUTHBEAR_BASE_URL = "https://api.truthbear.co";

/**
 * TruthbearActionProvider provides fact-checking against 180+ official
 * government and institutional data sources (USGS, NOAA, SEC EDGAR,
 * EPA, FRED, and others).
 *
 * The free preview endpoint requires no API key, no wallet, and no signup.
 * Each response includes a SHA-256 record_hash for tamper-proof provenance.
 */
export class TruthbearActionProvider extends ActionProvider {
  constructor() {
    super("truthbear", []);
  }

  /**
   * Verifies a fact or data point against official sources.
   *
   * @param args - The verification query
   * @returns A string containing the matched signal, value, source, hash, and freshness
   */
  @CreateAction({
    name: "truthbear_verify",
    description: `This tool verifies facts and data points against 180+ official government and institutional sources (USGS, NOAA, SEC EDGAR, EPA, FRED).
It takes the following input:
- A natural-language query describing the fact to verify (e.g. "US unemployment rate", "California earthquake magnitude")

Important notes:
- This is a free preview endpoint — no API key, wallet, or signup required
- Returns the matched signal name, its current value, the primary source URL, a SHA-256 record_hash, and a freshness timestamp
- Screening-level only — not decision-grade verification
- The record_hash can be independently recomputed for tamper-proof provenance`,
    schema: TruthbearVerifySchema,
  })
  async verify(args: z.infer<typeof TruthbearVerifySchema>): Promise<string> {
    try {
      const params = new URLSearchParams({ q: args.query });
      const url = `${TRUTHBEAR_BASE_URL}/trust/preview?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data || typeof data !== "object") {
        return JSON.stringify(data, null, 2);
      }

      const parts: string[] = [];
      if (data.signal) parts.push(`Signal: ${data.signal}`);
      if (data.value != null) parts.push(`Value: ${data.value}`);
      if (data.source_url) parts.push(`Source: ${data.source_url}`);
      if (data.record_hash) parts.push(`Record Hash: ${data.record_hash}`);
      if (data.freshness) parts.push(`Freshness: ${data.freshness}`);

      return parts.length > 0 ? parts.join("\n") : JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error verifying fact: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Truth Bear is network-agnostic (pure API, no on-chain interaction needed
   * for the free preview). Always returns true.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

export const truthbearActionProvider = () => new TruthbearActionProvider();
