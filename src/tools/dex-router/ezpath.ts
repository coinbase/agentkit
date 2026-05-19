import { Tool } from "@coinbase/agentkit";

export const ezPathQuoteTool: Tool = {
  name: "ezpath_quote",
  description:
    "Get the best DEX swap quote on Base mainnet by racing 10+ venues (0x, ParaSwap, Aerodrome, Uniswap V3, and more). Returns highest buyAmount with execution details. Powered by x402 v2 USDC micropayments.",

  inputSchema: {
    type: "object" as const,
    properties: {
      sellTokenAddress: {
        type: "string",
        description: "Contract address of token to sell (Base mainnet)",
      },
      buyTokenAddress: {
        type: "string",
        description: "Contract address of token to buy (Base mainnet)",
      },
      sellAmount: {
        type: "string",
        description: "Amount to sell in base units (e.g., 100000000 for 100 USDC with 6 decimals)",
      },
      tier: {
        type: "string",
        enum: ["basic", "resilient", "institutional"],
        description:
          'Execution tier: basic ($0.03, 0x only), resilient ($0.10, 0x+ParaSwap race), institutional ($0.50, all 10 venues)',
      },
    },
    required: ["sellTokenAddress", "buyTokenAddress", "sellAmount"],
  },

  async execute(input: Record<string, unknown>) {
    const { sellTokenAddress, buyTokenAddress, sellAmount, tier = "basic" } =
      input as {
        sellTokenAddress: string;
        buyTokenAddress: string;
        sellAmount: string;
        tier?: "basic" | "resilient" | "institutional";
      };

    const url = new URL("https://ezpath.myezverse.xyz/api/v1/quote");
    url.searchParams.set("sellToken", sellTokenAddress);
    url.searchParams.set("buyToken", buyTokenAddress);
    url.searchParams.set("sellAmount", sellAmount);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`EZ-Path quote failed: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      status: "success",
      buyAmount: data.buyAmount as string,
      price: data.price as string,
      routingEngine: data.routingEngine as string,
      sources: (data.sources as Array<{ name: string }>)
        .map((s) => s.name)
        .join(", "),
      tier: data.tier as string,
      requestId: data.requestId as string,
      expiresAt: data.expiresAt as number,
      message: `Got best quote via ${data.routingEngine}. Buy ${data.buyAmount} for ${data.sellAmount} sell amount.`,
    };
  },
};
