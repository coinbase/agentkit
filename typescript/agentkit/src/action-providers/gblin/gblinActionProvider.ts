import { z } from "zod";
import { Decimal } from "decimal.js";
import { encodeFunctionData, formatEther, formatUnits, Hex, parseEther, parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { GBLIN_ADDRESS, GBLIN_ABI } from "./constants";
import { BuyGblinSchema, SellGblinForEthSchema, GetTreasuryStateSchema } from "./schemas";

export const SUPPORTED_NETWORKS = ["base-mainnet"];

const DEFAULT_SLIPPAGE_BPS = 100n; // 1%
const BPS = 10_000n;

/**
 * GblinActionProvider lets an agent hold and redeem GBLIN — the collateral-backed,
 * self-defending treasury index on Base (WETH/cbBTC/USDC with an autonomous Crash
 * Shield). It is designed for parking surplus agent capital with capped drawdown,
 * not as a USDC substitute. All actions set an on-chain-quote-derived minOut, so
 * the agent is never exposed to an unbounded swap.
 *
 * Contract (verified): https://basescan.org/address/0x36C81d7E1966310F305eA637e761Cf77F90852f0
 */
export class GblinActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the GblinActionProvider class.
   */
  constructor() {
    super("gblin", []);
  }

  /**
   * Buys GBLIN with ETH, protected by a min-out derived from the on-chain quote.
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "buy_gblin",
    description: `
Buy GBLIN, a collateral-backed, self-defending treasury index on Base, using ETH.
Use this to park surplus agent capital with capped drawdown (managed crypto exposure, NOT a stablecoin).

It takes:
- ethAmount: amount of ETH to spend in whole units (e.g. "0.1")
- slippageBps: optional max slippage vs the on-chain quote, in basis points (default 100 = 1%)

The action reads quoteBuyGBLIN on-chain and submits buyGBLIN with a safe minimum output; it never sends an unbounded swap.
`,
    schema: BuyGblinSchema,
  })
  async buyGblin(wallet: EvmWalletProvider, args: z.infer<typeof BuyGblinSchema>): Promise<string> {
    const eth = new Decimal(args.ethAmount);
    if (eth.comparedTo(new Decimal(0)) != 1) {
      return "Error: ethAmount must be greater than 0";
    }

    try {
      const valueWei = parseEther(args.ethAmount);
      const slippage = args.slippageBps != null ? BigInt(args.slippageBps) : DEFAULT_SLIPPAGE_BPS;

      const quote = (await wallet.readContract({
        address: GBLIN_ADDRESS as Hex,
        abi: GBLIN_ABI,
        functionName: "quoteBuyGBLIN",
        args: [valueWei],
      })) as readonly [bigint, bigint, bigint];

      const expectedOut = quote[0];
      if (expectedOut <= 0n) {
        return "Error: on-chain quote returned zero (oracles may be stale). Try again shortly.";
      }
      const minOut = (expectedOut * (BPS - slippage)) / BPS;

      const data = encodeFunctionData({
        abi: GBLIN_ABI,
        functionName: "buyGBLIN",
        args: [minOut],
      });

      const txHash = await wallet.sendTransaction({
        to: GBLIN_ADDRESS as `0x${string}`,
        data,
        value: valueWei,
      });
      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Bought GBLIN with ${args.ethAmount} ETH (min out ${formatUnits(minOut, 18)} GBLIN, expected ${formatUnits(expectedOut, 18)}). Tx: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error buying GBLIN: ${error}`;
    }
  }

  /**
   * Redeems GBLIN back to ETH, protected by a min-out derived from the on-chain quote.
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "sell_gblin_for_eth",
    description: `
Redeem GBLIN back to ETH (e.g. to free capital for an x402 payment).

It takes:
- gblinAmount: amount of GBLIN to redeem in whole units (e.g. "5")
- slippageBps: optional max slippage vs the on-chain quote, in basis points (default 100 = 1%)

Note: GBLIN enforces a short post-purchase cooldown before redemption; if you just bought, wait a couple of minutes.
`,
    schema: SellGblinForEthSchema,
  })
  async sellGblinForEth(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SellGblinForEthSchema>,
  ): Promise<string> {
    const amount = new Decimal(args.gblinAmount);
    if (amount.comparedTo(new Decimal(0)) != 1) {
      return "Error: gblinAmount must be greater than 0";
    }

    try {
      const atomic = parseUnits(args.gblinAmount, 18);
      const slippage = args.slippageBps != null ? BigInt(args.slippageBps) : DEFAULT_SLIPPAGE_BPS;

      const expectedEth = (await wallet.readContract({
        address: GBLIN_ADDRESS as Hex,
        abi: GBLIN_ABI,
        functionName: "quoteSellGBLIN",
        args: [atomic],
      })) as bigint;

      if (expectedEth <= 0n) {
        return "Error: on-chain quote returned zero (oracles may be stale). Try again shortly.";
      }
      const minEthOut = (expectedEth * (BPS - slippage)) / BPS;

      const data = encodeFunctionData({
        abi: GBLIN_ABI,
        functionName: "sellGBLINForEth",
        args: [atomic, minEthOut],
      });

      const txHash = await wallet.sendTransaction({
        to: GBLIN_ADDRESS as `0x${string}`,
        data,
      });
      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Redeemed ${args.gblinAmount} GBLIN for ~${formatEther(minEthOut)} ETH (min). Tx: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error redeeming GBLIN: ${error}`;
    }
  }

  /**
   * Reads live GBLIN treasury state (per-unit ETH value and supply).
   *
   * @param wallet - The wallet instance used for on-chain reads
   * @param _ - Empty args
   * @returns A JSON string with treasury state or an error message
   */
  @CreateAction({
    name: "get_gblin_state",
    description:
      "Read live GBLIN state: per-GBLIN ETH redemption value (from quoteSellGBLIN of 1 GBLIN) and total supply. Use before buying/redeeming to make an informed decision.",
    schema: GetTreasuryStateSchema,
  })
  async getGblinState(
    wallet: EvmWalletProvider,
    _: z.infer<typeof GetTreasuryStateSchema>,
  ): Promise<string> {
    try {
      const oneGblin = parseUnits("1", 18);
      const [ethPerGblin, supply] = await Promise.all([
        wallet.readContract({
          address: GBLIN_ADDRESS as Hex,
          abi: GBLIN_ABI,
          functionName: "quoteSellGBLIN",
          args: [oneGblin],
        }) as Promise<bigint>,
        wallet.readContract({
          address: GBLIN_ADDRESS as Hex,
          abi: GBLIN_ABI,
          functionName: "totalSupply",
          args: [],
        }) as Promise<bigint>,
      ]);

      return JSON.stringify({
        contract: GBLIN_ADDRESS,
        network: "base-mainnet",
        ethValuePerGblin: formatEther(ethPerGblin),
        totalSupply: formatUnits(supply, 18),
        note: "Managed crypto exposure with an autonomous Crash Shield; capped drawdown, not a stablecoin.",
      });
    } catch (error) {
      return `Error reading GBLIN state: ${error}`;
    }
  }

  /**
   * Checks if the GBLIN action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if supported (Base mainnet), false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const gblinActionProvider = () => new GblinActionProvider();
