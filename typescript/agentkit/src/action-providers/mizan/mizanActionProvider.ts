import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { VerifyCredentialSchema, ListDatasetsSchema } from "./schemas";
import { MIZAN_STUDIO_URL, MIZAN_SKILL_URL } from "./constants";
import { MizanRegistry, VerifyResult } from "./types";
import { classifyVerdict, sha256Hex } from "./utils";

const NOTE =
  "A credential is a backtest seal: history made honest, not a forecast. Re-verify offline at https://mizan.market/verify/";

/**
 * MizanActionProvider verifies zero-knowledge track-record credentials (VTR-1) issued by MIZAN.
 * Use it before an agent pays another agent for signals, copies a strategy, or allocates to a listed record.
 * The strategy behind a credential is never disclosed; the proof is a STARK anyone can re-verify offline.
 */
export class MizanActionProvider extends ActionProvider {
  /**
   * Constructor for the MizanActionProvider class.
   */
  constructor() {
    super("mizan", []);
  }

  /**
   * Verifies a MIZAN credential against the public registry and checks the proof bundle's hash.
   *
   * @param args - The credential id or bundle sha256
   * @returns A JSON string with the verdict exactly as issued (PASS, FAIL, NOT_SIGNIFICANT) or UNVERIFIED
   */
  @CreateAction({
    name: "verify_credential",
    description: `This tool verifies a MIZAN zero-knowledge track-record credential (VTR-1 standard).
It takes the following inputs:
- credentialId: the registry id (e.g. 'dsr10-flagship'), or
- sha256: the proof bundle's sha256

What it does:
- Looks the credential up in the public registry
- Downloads the proof bundle and checks its sha256 against the registry anchor
- Returns the verdict exactly as issued: PASS, FAIL or NOT_SIGNIFICANT (UNVERIFIED if missing or tampered)

Use it BEFORE paying another agent for signals, copying a strategy, or allocating to a listed track record.
A FAIL is a result, not a secret. A credential proves history was honest; it is not a forecast.
Docs: ${MIZAN_SKILL_URL}`,
    schema: VerifyCredentialSchema,
  })
  async verifyCredential(args: z.infer<typeof VerifyCredentialSchema>): Promise<string> {
    try {
      const res = await fetch(`${MIZAN_STUDIO_URL}/api/registry`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const reg = (await res.json()) as MizanRegistry;
      const c = (reg.credentials || []).find(
        x => x.id === args.credentialId || (args.sha256 && x.anchor?.sha256 === args.sha256),
      );
      if (!c) {
        const out: VerifyResult = {
          found: false,
          verdict: "UNVERIFIED",
          reason: "no such credential in the public registry",
          note: NOTE,
        };
        return JSON.stringify(out, null, 2);
      }
      const out: VerifyResult = {
        found: true,
        id: c.id,
        alias: c.alias,
        verdict: classifyVerdict(c.verdict),
        verdictRaw: c.verdict,
        era: c.era,
        engineImageId: c.engine_image_id,
        bundle: c.links?.bundle,
        registrySha256: c.anchor?.sha256,
        registryRoot: reg.registry_root,
        hashMatch: null,
        note: NOTE,
      };
      const url = c.links?.bundle || "";
      if (url.startsWith("http")) {
        const b = await fetch(url);
        if (b.ok) {
          const hex = await sha256Hex(await b.arrayBuffer());
          out.hashMatch = hex === c.anchor?.sha256;
          if (out.hashMatch === false) {
            out.verdict = "UNVERIFIED";
            out.reason = "bundle sha256 does not match the registry anchor";
          }
        } else {
          out.reason = `bundle not fetchable: HTTP ${b.status}`;
        }
      }
      return JSON.stringify(out, null, 2);
    } catch (error: unknown) {
      return `Error verifying credential: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Lists the canonical public markets a sealed-path credential can be minted on.
   *
   * @param _ - No inputs
   * @returns A JSON string of datasets (key, label, bars, interval, venue, sha256)
   */
  @CreateAction({
    name: "list_datasets",
    description: `This tool lists the canonical public markets a MIZAN credential can be minted on
(key, label, bars, interval, venue, first/last bar, sha256). Minting itself happens through the sealed path
documented at ${MIZAN_SKILL_URL}: the agent submits one position per bar-move only; the strategy never leaves its machine.`,
    schema: ListDatasetsSchema,
  })
  async listDatasets(_: z.infer<typeof ListDatasetsSchema>): Promise<string> {
    try {
      const res = await fetch(`${MIZAN_STUDIO_URL}/api/blackbox-datasets`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const d = (await res.json()) as {
        datasets: Record<string, unknown>[];
        max_positions: number;
      };
      const keep = ["key", "label", "bars", "interval", "venue", "first", "last", "sha256"];
      const datasets = d.datasets.map(x => Object.fromEntries(keep.map(k => [k, x[k]])));
      return JSON.stringify(
        {
          datasets,
          max_positions: d.max_positions,
          csv: `${MIZAN_STUDIO_URL}/api/catalog/{key}.csv`,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error listing datasets: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the MIZAN action provider supports the given network.
   * MIZAN actions are read-only HTTPS calls, so this always returns true.
   *
   * @returns True, as MIZAN actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Factory function to create a new MizanActionProvider instance.
 *
 * @returns A new MizanActionProvider instance
 */
export const mizanActionProvider = () => new MizanActionProvider();
