import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { ScanTokenSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

/**
 * TokenSafetyActionProvider is an action provider for token security scanning.
 */
export class TokenSafetyActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the TokenSafetyActionProvider.
   */
  constructor() {
    super("tokenSafety", []);
  }

  /**
   * Performs a safety scan on a token contract address.
   *
   * @param walletProvider - The wallet provider to use for the action.
   * @param args - The input arguments for the action.
   * @returns A message containing the token safety scan report.
   */
  @CreateAction({
    name: "scan_token",
    description: `
    This tool performs a security and safety scan on an ERC-20 token address.
    It returns a safety score (0-100), a verdict (e.g. "SAFE", "UNSAFE", "SYSTEM TOKEN", "SUSPICIOUS"), and a list of flags identifying potential issues like honeypots, scams, LP lock status, proxy contracts, or ownership privileges.
    Use this tool before executing any token swap or investment on Base or other chains to verify that the token is safe and to prevent interacting with malicious or honeypot contracts.

Inputs:
- tokenAddress: The contract address of the token (e.g., "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" for USDC).
- chain: Optional target chain name (e.g., "base", "ethereum", "optimism", "arbitrum", "polygon", "bsc"). Defaults to "base".
`,
    schema: ScanTokenSchema,
  })
  async scanToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScanTokenSchema>,
  ): Promise<string> {
    const chainName = args.chain || "base";
    const url = `https://cryptogenesis.duckdns.org/token/scan?address=${args.tokenAddress}&chain=${chainName}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return `Error: Failed to perform safety scan (status code ${response.status}).`;
      }

      const result = await response.json();

      const score = result.safety_score ?? "unknown";
      const verdict = result.verdict ?? "UNKNOWN";
      const flags = result.flags && result.flags.length > 0 ? result.flags.join(", ") : "None";
      const symbol = result.token?.symbol ?? "Unknown Symbol";
      const name = result.token?.name ?? "Unknown Name";

      return `Token Safety Report for ${name} (${symbol}) on ${chainName}:
- Token Address: ${args.tokenAddress}
- Safety Score: ${score}/100
- Verdict: ${verdict}
- Security Flags/Warnings: ${flags}
- Timestamp: ${result.timestamp ? new Date(result.timestamp * 1000).toISOString() : "N/A"}
- Note: ${result.note ?? ""}`;
    } catch (error) {
      return `Error performing token safety scan: ${error}`;
    }
  }

  /**
   * Checks if the TokenSafety action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True since token safety check is supported on all networks.
   */
  supportsNetwork = (network: Network) => {
    return true;
  };
}

export const tokenSafetyActionProvider = () => new TokenSafetyActionProvider();
