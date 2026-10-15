import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { encodeFunctionData, erc20Abi } from "viem";
import { FoddaQueryContextSchema } from "./schemas";
import {
  BASE_USDC_ADDRESS,
  FODDA_SETTLEMENT_ADDRESS,
  FODDA_MICRO_PRICE_USDC,
  FODDA_API_URL,
} from "./constants";

/**
 * FoddaActionProvider provides actions for querying the Fodda Context Layer.
 * It autonomously resolves HTTP 402 micro-settlements by transferring 5¢ USDC
 * on Base Mainnet, respecting block finality Retry-After headers.
 */
export class FoddaActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructs a new FoddaActionProvider.
   */
  constructor() {
    super("fodda", []);
  }

  /**
   * Queries verified market intelligence graphs from Fodda.
   *
   * @param walletProvider - The EVM wallet provider to execute Base settlements if required
   * @param args - The arguments containing the graph slug
   * @returns The graph data as text or JSON string
   */
  @CreateAction({
    name: "query_fodda_context",
    description: `Queries verified market intelligence or trend graphs from Fodda.
Autonomously resolves 5¢ USDC x402 payment challenges on Base if challenged.

Inputs:
- slug: The exact slug for the knowledge graph or market intelligence report to retrieve (e.g. 'psfk-retail', 'food-beverage', 'hospitality').
`,
    schema: FoddaQueryContextSchema,
  })
  async queryFoddaContext(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FoddaQueryContextSchema>,
  ): Promise<string> {
    const targetUrl = `${FODDA_API_URL}/v1/graphs/${args.slug}`;

    // 1. Initial request probe
    const response = await fetch(targetUrl, { method: "GET" });

    // 2. Already authorized or free preview
    if (response.status === 200) {
      return await response.text();
    }

    // 3. Handle HTTP 402 Payment Required challenge
    if (response.status === 402) {
      const challengePayload = await response.json();

      const x402Method = challengePayload.payment_methods_detail?.find(
        (m: { method?: string; recipient_address?: string }) => m.method === "x402",
      );

      const recipientAddress = (x402Method?.recipient_address ||
        FODDA_SETTLEMENT_ADDRESS) as `0x${string}`;

      // Encode standard ERC-20 transfer(address,uint256) for 50,000 micro-USDC (5 cents)
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipientAddress, FODDA_MICRO_PRICE_USDC],
      });

      // Execute transaction on Base USDC contract
      const txHash = await walletProvider.sendTransaction({
        to: BASE_USDC_ADDRESS,
        data,
      });

      // Wait for on-chain inclusion
      await walletProvider.waitForTransactionReceipt(txHash);

      // Respect server's requested block finality delay (Retry-After header)
      const retryAfterSeconds = parseInt(response.headers.get("Retry-After") || "2", 10);
      if (retryAfterSeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      }

      // Resubmit paid request with proof of transaction
      const paidResponse = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "X-402-Payment": txHash,
          "X-402-Network": "base",
        },
      });

      if (!paidResponse.ok) {
        throw new Error(
          `Fodda paid query failed with status ${paidResponse.status}: ${await paidResponse.text()}`,
        );
      }

      return await paidResponse.text();
    }

    throw new Error(
      `Unexpected response from Fodda (HTTP ${response.status}): ${await response.text()}`,
    );
  }

  /**
   * Checks if the Fodda action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True if network is Base Mainnet or Base Sepolia, false otherwise
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" ||
    network.networkId === "base-sepolia" ||
    network.chainId === "8453";
}

export const foddaActionProvider = () => new FoddaActionProvider();
