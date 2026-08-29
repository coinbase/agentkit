import { z } from "zod";
import { encodeFunctionData, Hex, parseUnits } from "viem";
import { erc20Abi } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { Network } from "../../network";
import {
  PENDLE_ROUTER_V4,
  PENDLE_API_BASE,
  PENDLE_ROUTER_ABI,
  SUPPORTED_CHAIN_IDS,
} from "./constants";
import {
  BuyPtSchema,
  SellPtSchema,
  BuyYtSchema,
  SellYtSchema,
  AddLiquiditySchema,
  RemoveLiquiditySchema,
  ClaimRewardsSchema,
  ListMarketsSchema,
} from "./schemas";

const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

const PENDLE_SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * PendleActionProvider enables interaction with Pendle Finance on Base.
 *
 * Pendle splits yield-bearing tokens into PT (Principal Token) and YT (Yield Token),
 * enabling fixed-yield and yield-speculation strategies. This provider uses the
 * Pendle Hosted SDK API for optimal execution (better gas, aggregator routing,
 * limit order matching).
 */
export class PendleActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("pendle", []);
  }

  /**
   * Calls the Pendle Convert API to get transaction calldata.
   */
  private async callConvertApi(
    chainId: number,
    receiver: string,
    slippage: number,
    inputs: Array<{ tokenAddress: string; amount: string }>,
    outputs: Array<{ tokenAddress: string }>,
  ): Promise<{
    tx: { to: string; data: string; value: string };
    requiredApprovals: Array<{ tokenAddress: string; spender: string; amount: string }>;
  }> {
    const url = `${PENDLE_API_BASE}/v3/sdk/${chainId}/convert`;
    const body = {
      receiver,
      slippage,
      enableAggregator: true,
      inputs,
      outputs,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pendle API error (${response.status}): ${text}`);
    }

    return response.json();
  }

  /**
   * Resolves token decimals — returns 18 for native ETH.
   */
  private async getDecimals(wallet: EvmWalletProvider, tokenAddress: string): Promise<number> {
    if (tokenAddress.toLowerCase() === NATIVE_TOKEN) return 18;
    return (await wallet.readContract({
      address: tokenAddress as Hex,
      abi: erc20Abi,
      functionName: "decimals",
      args: [],
    })) as number;
  }

  /**
   * Gets the chain ID for the current network.
   */
  private getChainId(wallet: EvmWalletProvider): number {
    const network = wallet.getNetwork();
    const chainId = SUPPORTED_CHAIN_IDS[network.networkId!];
    if (!chainId) throw new Error(`Unsupported network: ${network.networkId}`);
    return chainId;
  }

  /**
   * Fetches market info from Pendle API to resolve PT/YT/LP addresses.
   */
  private async getMarketInfo(
    chainId: number,
    marketAddress: string,
  ): Promise<{
    pt: string;
    yt: string;
    sy: string;
    underlyingAsset: string;
    expiry: string;
    name: string;
  }> {
    const url = `${PENDLE_API_BASE}/v1/sdk/${chainId}/markets/${marketAddress}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch market info: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Executes a convert operation via the Pendle API and submits the transaction.
   */
  private async executeConvert(
    wallet: EvmWalletProvider,
    slippage: number,
    inputs: Array<{ tokenAddress: string; amount: string }>,
    outputs: Array<{ tokenAddress: string }>,
  ): Promise<{ txHash: string; receipt: unknown }> {
    const chainId = this.getChainId(wallet);
    const receiver = await wallet.getAddress();

    const result = await this.callConvertApi(chainId, receiver, slippage, inputs, outputs);

    // Handle required approvals
    for (const approval of result.requiredApprovals || []) {
      const approvalResult = await approve(
        wallet,
        approval.tokenAddress,
        approval.spender,
        BigInt(approval.amount),
      );
      if (approvalResult.startsWith("Error")) {
        throw new Error(`Token approval failed: ${approvalResult}`);
      }
    }

    // Submit the transaction
    const txHash = await wallet.sendTransaction({
      to: result.tx.to as `0x${string}`,
      data: result.tx.data as `0x${string}`,
      value: BigInt(result.tx.value || "0"),
    });

    const receipt = await wallet.waitForTransactionReceipt(txHash);
    return { txHash, receipt };
  }

  // ─── Actions ────────────────────────────────────────────────

  @CreateAction({
    name: "buy_pt",
    description: `
Buy PT (Principal Token) on Pendle Finance to lock in a fixed yield.

PT represents the principal portion of a yield-bearing token. It trades at a discount
before maturity and is redeemable 1:1 for the underlying asset at maturity.
The discount = your fixed yield.

It takes:
- market: The Pendle market address (find markets using the list_markets action)
- tokenIn: The token to swap from (e.g., WETH, USDC address). Use 0x0000000000000000000000000000000000000000 for native ETH
- amount: Amount of input tokens in whole units (e.g., '0.1' for 0.1 WETH)
- slippage: Slippage tolerance (default 0.01 = 1%)

Example: Buy PT with 0.1 ETH on the yoETH market to lock in ~5% fixed yield.
`,
    schema: BuyPtSchema,
  })
  async buyPt(wallet: EvmWalletProvider, args: z.infer<typeof BuyPtSchema>): Promise<string> {
    try {
      const chainId = this.getChainId(wallet);
      const decimals = await this.getDecimals(wallet, args.tokenIn);
      const atomicAmount = parseUnits(args.amount, decimals).toString();
      const marketInfo = await this.getMarketInfo(chainId, args.market);

      const { txHash, receipt } = await this.executeConvert(
        wallet,
        args.slippage,
        [{ tokenAddress: args.tokenIn, amount: atomicAmount }],
        [{ tokenAddress: marketInfo.pt }],
      );

      return `Successfully bought PT on Pendle market ${args.market}.\nInput: ${args.amount} tokens\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error buying PT on Pendle: ${error}`;
    }
  }

  @CreateAction({
    name: "sell_pt",
    description: `
Sell PT (Principal Token) on Pendle Finance back to an underlying token.

Use this to exit a fixed-yield position before maturity, or to redeem after maturity.

It takes:
- market: The Pendle market address
- tokenOut: The token to receive (e.g., WETH, USDC address). Use 0x0000000000000000000000000000000000000000 for native ETH
- amount: Amount of PT to sell, in whole units
- slippage: Slippage tolerance (default 0.01 = 1%)
`,
    schema: SellPtSchema,
  })
  async sellPt(wallet: EvmWalletProvider, args: z.infer<typeof SellPtSchema>): Promise<string> {
    try {
      const chainId = this.getChainId(wallet);
      const marketInfo = await this.getMarketInfo(chainId, args.market);

      // PT tokens have 18 decimals
      const atomicAmount = parseUnits(args.amount, 18).toString();

      const { txHash, receipt } = await this.executeConvert(
        wallet,
        args.slippage,
        [{ tokenAddress: marketInfo.pt, amount: atomicAmount }],
        [{ tokenAddress: args.tokenOut }],
      );

      return `Successfully sold PT on Pendle market ${args.market}.\nSold: ${args.amount} PT\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error selling PT on Pendle: ${error}`;
    }
  }

  @CreateAction({
    name: "buy_yt",
    description: `
Buy YT (Yield Token) on Pendle Finance to speculate on yield going up.

YT holders receive all yield generated by the underlying asset until maturity.
If you expect yields to increase, buying YT lets you profit from that.

It takes:
- market: The Pendle market address (find markets using the list_markets action)
- tokenIn: The token to swap from. Use 0x0000000000000000000000000000000000000000 for native ETH
- amount: Amount of input tokens in whole units
- slippage: Slippage tolerance (default 0.01 = 1%)
`,
    schema: BuyYtSchema,
  })
  async buyYt(wallet: EvmWalletProvider, args: z.infer<typeof BuyYtSchema>): Promise<string> {
    try {
      const chainId = this.getChainId(wallet);
      const decimals = await this.getDecimals(wallet, args.tokenIn);
      const atomicAmount = parseUnits(args.amount, decimals).toString();
      const marketInfo = await this.getMarketInfo(chainId, args.market);

      const { txHash, receipt } = await this.executeConvert(
        wallet,
        args.slippage,
        [{ tokenAddress: args.tokenIn, amount: atomicAmount }],
        [{ tokenAddress: marketInfo.yt }],
      );

      return `Successfully bought YT on Pendle market ${args.market}.\nInput: ${args.amount} tokens\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error buying YT on Pendle: ${error}`;
    }
  }

  @CreateAction({
    name: "sell_yt",
    description: `
Sell YT (Yield Token) on Pendle Finance back to an underlying token.

Use this to exit a yield speculation position.

It takes:
- market: The Pendle market address
- tokenOut: The token to receive. Use 0x0000000000000000000000000000000000000000 for native ETH
- amount: Amount of YT to sell, in whole units
- slippage: Slippage tolerance (default 0.01 = 1%)
`,
    schema: SellYtSchema,
  })
  async sellYt(wallet: EvmWalletProvider, args: z.infer<typeof SellYtSchema>): Promise<string> {
    try {
      const chainId = this.getChainId(wallet);
      const marketInfo = await this.getMarketInfo(chainId, args.market);
      const atomicAmount = parseUnits(args.amount, 18).toString();

      const { txHash, receipt } = await this.executeConvert(
        wallet,
        args.slippage,
        [{ tokenAddress: marketInfo.yt, amount: atomicAmount }],
        [{ tokenAddress: args.tokenOut }],
      );

      return `Successfully sold YT on Pendle market ${args.market}.\nSold: ${args.amount} YT\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error selling YT on Pendle: ${error}`;
    }
  }

  @CreateAction({
    name: "add_liquidity",
    description: `
Add liquidity to a Pendle market to earn swap fees and PENDLE rewards.

Pendle LP positions earn from three sources: swap fees, underlying yield, and PENDLE incentives.

It takes:
- market: The Pendle market address
- tokenIn: The token to provide as liquidity. Use 0x0000000000000000000000000000000000000000 for native ETH
- amount: Amount of tokens to add, in whole units
- slippage: Slippage tolerance (default 0.01 = 1%)
`,
    schema: AddLiquiditySchema,
  })
  async addLiquidity(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AddLiquiditySchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(wallet);
      const decimals = await this.getDecimals(wallet, args.tokenIn);
      const atomicAmount = parseUnits(args.amount, decimals).toString();

      // LP token address is the market address itself
      const { txHash, receipt } = await this.executeConvert(
        wallet,
        args.slippage,
        [{ tokenAddress: args.tokenIn, amount: atomicAmount }],
        [{ tokenAddress: args.market }],
      );

      return `Successfully added liquidity to Pendle market ${args.market}.\nInput: ${args.amount} tokens\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error adding liquidity on Pendle: ${error}`;
    }
  }

  @CreateAction({
    name: "remove_liquidity",
    description: `
Remove liquidity from a Pendle market back to a single token.

It takes:
- market: The Pendle market address
- tokenOut: The token to receive back. Use 0x0000000000000000000000000000000000000000 for native ETH
- amount: Amount of LP tokens to remove, in whole units
- slippage: Slippage tolerance (default 0.01 = 1%)
`,
    schema: RemoveLiquiditySchema,
  })
  async removeLiquidity(
    wallet: EvmWalletProvider,
    args: z.infer<typeof RemoveLiquiditySchema>,
  ): Promise<string> {
    try {
      const atomicAmount = parseUnits(args.amount, 18).toString();

      const { txHash, receipt } = await this.executeConvert(
        wallet,
        args.slippage,
        [{ tokenAddress: args.market, amount: atomicAmount }],
        [{ tokenAddress: args.tokenOut }],
      );

      return `Successfully removed liquidity from Pendle market ${args.market}.\nRemoved: ${args.amount} LP\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error removing liquidity on Pendle: ${error}`;
    }
  }

  @CreateAction({
    name: "claim_rewards",
    description: `
Claim accrued interest, yield, and PENDLE rewards from Pendle positions.

Pendle positions accrue rewards over time:
- YT holders earn yield from the underlying asset
- LP providers earn swap fees and PENDLE incentives
- SY holders may earn interest

Provide the addresses of the positions you want to claim from.

It takes:
- syAddresses: Array of SY token addresses (optional)
- ytAddresses: Array of YT token addresses (optional)
- marketAddresses: Array of market/LP addresses (optional)
`,
    schema: ClaimRewardsSchema,
  })
  async claimRewards(
    wallet: EvmWalletProvider,
    args: z.infer<typeof ClaimRewardsSchema>,
  ): Promise<string> {
    try {
      const userAddress = await wallet.getAddress();

      const data = encodeFunctionData({
        abi: PENDLE_ROUTER_ABI,
        functionName: "redeemDueInterestAndRewards",
        args: [
          userAddress as `0x${string}`,
          (args.syAddresses || []) as `0x${string}`[],
          (args.ytAddresses || []) as `0x${string}`[],
          (args.marketAddresses || []) as `0x${string}`[],
        ],
      });

      const txHash = await wallet.sendTransaction({
        to: PENDLE_ROUTER_V4 as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Successfully claimed Pendle rewards.\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error claiming Pendle rewards: ${error}`;
    }
  }

  @CreateAction({
    name: "list_markets",
    description: `
List active Pendle markets on Base with their current APYs, TVL, and maturity dates.

Returns a formatted list of markets including:
- Market name and address
- Underlying asset
- Fixed APY (implied from PT price)
- TVL
- Maturity date

No inputs required.
`,
    schema: ListMarketsSchema,
  })
  async listMarkets(wallet: EvmWalletProvider): Promise<string> {
    try {
      const chainId = this.getChainId(wallet);
      const url = `${PENDLE_API_BASE}/v2/markets/all?chainId=${chainId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Pendle API error: ${response.status}`);
      }

      const data = await response.json();
      const markets = (data.results || data) as Array<{
        address: string;
        name: string;
        expiry: string;
        pt: { address: string };
        yt: { address: string };
        underlyingAsset: { symbol: string; address: string };
        aggregatedApy: number;
        impliedApy: number;
        tvl: { usd: number };
        liquidity: { usd: number };
      }>;

      if (!markets || markets.length === 0) {
        return "No active Pendle markets found on Base.";
      }

      const lines = markets
        .filter((m) => new Date(m.expiry) > new Date())
        .sort((a, b) => (b.tvl?.usd || 0) - (a.tvl?.usd || 0))
        .slice(0, 15)
        .map((m) => {
          const expiry = new Date(m.expiry).toLocaleDateString();
          const tvl = m.tvl?.usd ? `$${(m.tvl.usd / 1e6).toFixed(2)}M` : "N/A";
          const fixedApy = m.impliedApy ? `${(m.impliedApy * 100).toFixed(2)}%` : "N/A";
          return `- ${m.name} | Market: ${m.address} | Fixed APY: ${fixedApy} | TVL: ${tvl} | Expires: ${expiry}`;
        });

      return `Active Pendle Markets on Base:\n\n${lines.join("\n")}`;
    } catch (error) {
      return `Error listing Pendle markets: ${error}`;
    }
  }

  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && PENDLE_SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const pendleActionProvider = () => new PendleActionProvider();
