import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { GroundtruthAddressSchema } from "./schemas";

const GROUNDTRUTH_API_URL = "https://api.groundtruths.xyz";

/**
 * Configuration options for the GroundtruthActionProvider.
 */
export interface GroundtruthActionProviderConfig {
  /**
   * GROUNDTRUTH API key, sent as `x-api-key`. Without one, the free per-IP allowance applies.
   */
  apiKey?: string;

  /**
   * Base URL of the GROUNDTRUTH API.
   */
  apiUrl?: string;
}

/**
 * GroundtruthActionProvider looks up the recorded outcomes of memecoin launches on Solana
 * (pump.fun) and Robinhood Chain, and the track record of the wallets that launch them.
 * It returns records, not safety ratings.
 */
export class GroundtruthActionProvider extends ActionProvider {
  private readonly apiKey?: string;
  private readonly apiUrl: string;

  /**
   * Constructor for the GroundtruthActionProvider.
   *
   * @param config - The configuration options for the GroundtruthActionProvider
   */
  constructor(config: GroundtruthActionProviderConfig = {}) {
    super("groundtruth", []);
    this.apiKey = config.apiKey || process.env.GROUNDTRUTH_API_KEY;
    this.apiUrl = (config.apiUrl || GROUNDTRUTH_API_URL).replace(/\/+$/, "");
  }

  /**
   * Gets the launch record of a creator (deployer) wallet.
   *
   * @param args - The address and optional chain
   * @returns The creator record as a JSON string, or an error message
   */
  @CreateAction({
    name: "get_creator_record",
    description: `
This tool returns the GROUNDTRUTH record of a memecoin creator (deployer) wallet on Solana (pump.fun) or
Robinhood Chain: how many coins it launched and how many rugged, died, survived or graduated.
Use it before buying a newly launched token, with the token's creator wallet.
A record is not a safety rating. Never describe a creator as "safe".`,
    schema: GroundtruthAddressSchema,
  })
  async getCreatorRecord(args: z.infer<typeof GroundtruthAddressSchema>): Promise<string> {
    return this.fetchRecord("/v1/flag", "addr", args, "creator record");
  }

  /**
   * Gets the record of one coin by its contract address.
   *
   * @param args - The address and optional chain
   * @returns The coin record as a JSON string, or an error message
   */
  @CreateAction({
    name: "get_coin_record",
    description: `
This tool returns the GROUNDTRUTH record of one memecoin by its contract address (CA) on Solana (pump.fun)
or Robinhood Chain: its recorded outcome (rugged / died / graduated / active) and its creator.
A coin launched minutes ago has no outcome yet. Say "no outcome yet", never "clean".`,
    schema: GroundtruthAddressSchema,
  })
  async getCoinRecord(args: z.infer<typeof GroundtruthAddressSchema>): Promise<string> {
    return this.fetchRecord("/v1/record", "ca", args, "coin record");
  }

  /**
   * Gets the known-bad verdict for a creator wallet, with its statistical basis.
   *
   * @param args - The address and optional chain
   * @returns The verdict as a JSON string, or an error message
   */
  @CreateAction({
    name: "get_known_bad_flag",
    description: `
This tool returns whether a memecoin creator wallet is KNOWN BAD on GROUNDTRUTH: it rugs more often than the
chain's baseline by more than chance (one-sided exact binomial, p < 0.01, at least 5 resolved launches).
The basis is returned with the verdict; quote it.
known_bad null means the creator is not in the published set. Absence is not innocence.`,
    schema: GroundtruthAddressSchema,
  })
  async getKnownBadFlag(args: z.infer<typeof GroundtruthAddressSchema>): Promise<string> {
    return this.fetchRecord("/api/flag", "addr", args, "known-bad flag");
  }

  /**
   * GROUNDTRUTH is an off-chain HTTP API, so it works on every network.
   *
   * @param _ - The network (unused)
   * @returns Always true
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Calls one GROUNDTRUTH endpoint.
   *
   * @param path - The endpoint path
   * @param param - The query parameter that carries the address
   * @param args - The address and optional chain
   * @param what - What is being fetched, for error messages
   * @returns The response body as a JSON string, or an error message
   */
  private async fetchRecord(
    path: string,
    param: string,
    args: z.infer<typeof GroundtruthAddressSchema>,
    what: string,
  ): Promise<string> {
    try {
      const chain = args.chain || (args.address.startsWith("0x") ? "rh" : "solana");
      const params = new URLSearchParams({ [param]: args.address, chain });
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.apiKey) headers["x-api-key"] = this.apiKey;

      const response = await fetch(`${this.apiUrl}${path}?${params.toString()}`, { headers });
      if (response.status === 402) {
        return `Error fetching GROUNDTRUTH ${what}: the free allowance is used up. Set a GROUNDTRUTH API key, or pay per call with x402 (the x402 action provider can make this request).`;
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return JSON.stringify(await response.json());
    } catch (error) {
      return `Error fetching GROUNDTRUTH ${what}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Creates a new GroundtruthActionProvider.
 *
 * @param config - The configuration options for the GroundtruthActionProvider
 * @returns A new GroundtruthActionProvider
 */
export const groundtruthActionProvider = (config: GroundtruthActionProviderConfig = {}) =>
  new GroundtruthActionProvider(config);
