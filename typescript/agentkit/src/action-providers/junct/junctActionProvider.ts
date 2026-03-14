import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  JunctListServersSchema,
  JunctCallToolSchema,
  JunctListToolsSchema,
} from "./schemas";

const JUNCT_SERVERS = [
  { clientId: "binance", name: "Binance", url: "https://binance.mcp.junct.dev/mcp", description: "Binance exchange — spot trading, market data, klines, order book" },
  { clientId: "aave", name: "Aave", url: "https://aave.mcp.junct.dev/mcp", description: "Aave V3 lending protocol — supply, borrow, reserves, rates" },
  { clientId: "chainlink", name: "Chainlink", url: "https://chainlink.mcp.junct.dev/mcp", description: "Chainlink oracle — price feeds, round data, aggregator" },
  { clientId: "curve", name: "Curve", url: "https://curve.mcp.junct.dev/mcp", description: "Curve Finance — stableswap pools, TVL, volume, gauges" },
  { clientId: "coingecko", name: "CoinGecko", url: "https://coingecko.mcp.junct.dev/mcp", description: "CoinGecko — prices, market caps, volumes, trending" },
  { clientId: "defillama", name: "DefiLlama", url: "https://defillama.mcp.junct.dev/mcp", description: "DefiLlama — TVL, protocol data, token prices, yields" },
  { clientId: "ens", name: "ENS", url: "https://ens.mcp.junct.dev/mcp", description: "ENS — domain resolution, lookups, registrations" },
  { clientId: "lido", name: "Lido", url: "https://lido.mcp.junct.dev/mcp", description: "Lido — liquid staking, stETH, rates" },
  { clientId: "compound", name: "Compound", url: "https://compound.mcp.junct.dev/mcp", description: "Compound V3 — supply, borrow, markets" },
  { clientId: "eigenlayer", name: "EigenLayer", url: "https://eigenlayer.mcp.junct.dev/mcp", description: "EigenLayer — restaking, delegation, operators" },
  { clientId: "jupiter", name: "Jupiter", url: "https://jupiter.mcp.junct.dev/mcp", description: "Jupiter — Solana DEX aggregator, quotes, swaps" },
  { clientId: "stargate", name: "Stargate", url: "https://stargate.mcp.junct.dev/mcp", description: "Stargate — cross-chain bridge, liquidity" },
  { clientId: "beefy", name: "Beefy", url: "https://beefy.mcp.junct.dev/mcp", description: "Beefy Finance — multi-chain yield optimizer, vaults" },
  { clientId: "maker", name: "Maker", url: "https://maker.mcp.junct.dev/mcp", description: "MakerDAO — DAI savings rate, vaults" },
  { clientId: "blockscout", name: "Blockscout", url: "https://blockscout.mcp.junct.dev/mcp", description: "Blockscout — block explorer, transactions, addresses" },
];

/**
 * JunctActionProvider enables access to Junct-hosted DeFi MCP servers.
 * Junct (junct.dev) provides hosted, agent-ready MCP servers for DeFi protocols.
 */
export class JunctActionProvider extends ActionProvider {
  constructor() {
    super("junct", []);
  }

  @CreateAction({
    name: "list_junct_servers",
    description: `List all available Junct-hosted DeFi MCP servers.
Returns server names, URLs, and descriptions for 15 DeFi protocols.`,
    schema: JunctListServersSchema,
  })
  async listServers(
    _args: z.infer<typeof JunctListServersSchema>,
  ): Promise<string> {
    return JSON.stringify({ servers: JUNCT_SERVERS }, null, 2);
  }

  @CreateAction({
    name: "list_junct_tools",
    description: `List tools available on a Junct DeFi MCP server.
Use this to discover what tools a server exposes before calling them.

Inputs:
- serverUrl: The Junct MCP server URL (e.g. https://aave.mcp.junct.dev/mcp)`,
    schema: JunctListToolsSchema,
  })
  async listTools(args: z.infer<typeof JunctListToolsSchema>): Promise<string> {
    try {
      const response = await fetch(args.serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      if (!response.ok) {
        return `Error: HTTP ${response.status}`;
      }
      const data = await response.json();
      const tools = (data.result?.tools ?? []).map((t: { name: string; description?: string }) => ({
        name: t.name,
        description: t.description,
      }));
      return JSON.stringify({ tools }, null, 2);
    } catch (error: unknown) {
      return `Error listing tools: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  @CreateAction({
    name: "call_junct_tool",
    description: `Call a tool on a Junct DeFi MCP server.
Use list_junct_tools first to discover available tools.

Inputs:
- serverUrl: The Junct MCP server URL
- toolName: The tool to invoke
- toolArgs: Arguments as a JSON object`,
    schema: JunctCallToolSchema,
  })
  async callTool(args: z.infer<typeof JunctCallToolSchema>): Promise<string> {
    try {
      const response = await fetch(args.serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: args.toolName, arguments: args.toolArgs },
        }),
      });
      if (!response.ok) {
        return `Error: HTTP ${response.status}`;
      }
      const data = await response.json();
      if (data.error) {
        return `Error: ${data.error.message ?? JSON.stringify(data.error)}`;
      }
      return JSON.stringify(data.result, null, 2);
    } catch (error: unknown) {
      return `Error calling tool: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  supportsNetwork(): boolean {
    return true;
  }
}

export const junctActionProvider = () => new JunctActionProvider();
