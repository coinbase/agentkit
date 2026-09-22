import { z } from "zod";
import { Decimal } from "decimal.js";
import {
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  formatUnits,
  Hex,
  parseEther,
  parseUnits,
} from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  GBLIN_ABI,
  GBLIN_ADDRESS,
  GBLIN_LENS_ABI,
  GBLIN_LENS_ADDRESS,
  GBLIN_ZAP_ABI,
  GBLIN_ZAP_ADDRESS,
  VENUE_FEE_TIER,
} from "./constants";
import { BuyGblinSchema, SellGblinForEthSchema, GetTreasuryStateSchema } from "./schemas";

const SUPPORTED_NETWORKS = ["base-mainnet"];

const DEFAULT_SLIPPAGE_BPS = 100n; // 1%
const BPS = 10_000n;

/**
 * GblinActionProvider lets an agent hold and redeem GBLIN, a collateral-backed treasury index
 * on Base (cbBTC, WETH and USDC) whose basket weights are reduced on-chain when an asset draws
 * down. The vault mints at NAV and never swaps; the exit to ETH goes through the GBLIN Zap.
 * Every state-changing action sets a minimum output derived from the on-chain quote.
 *
 * Vault (verified): https://basescan.org/address/0xc2181d975c05c8c724b334bcED0764c0b86B1D53
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
Buy GBLIN, a collateral-backed treasury index on Base (cbBTC, WETH, USDC), using ETH.
Use this to park surplus agent capital in managed crypto exposure. GBLIN is NOT a stablecoin: its NAV moves with BTC and ETH.

It takes:
- ethAmount: amount of ETH to spend in whole units (e.g. "0.1")
- slippageBps: optional max slippage vs the on-chain quote, in basis points (default 100 = 1%)

The action reads the quote from the GBLIN Lens and calls buyGBLIN on the vault with a safe minimum output. The mint fee is 0.10%; a 0.50% yearly management fee accrues as new shares.
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

      const reliable = (await wallet.readContract({
        address: GBLIN_ADDRESS as Hex,
        abi: GBLIN_ABI,
        functionName: "isNavReliable",
        args: [],
      })) as boolean;
      if (!reliable) {
        return "Error: the vault reports its NAV as not reliable right now (a price feed or a basket balance is unavailable). Try again later.";
      }

      const quote = (await wallet.readContract({
        address: GBLIN_LENS_ADDRESS as Hex,
        abi: GBLIN_LENS_ABI,
        functionName: "quoteBuy",
        args: [GBLIN_ADDRESS as Hex, valueWei],
      })) as readonly [bigint, bigint, bigint];

      const expectedOut = quote[0];
      if (expectedOut <= 0n) {
        return "Error: on-chain quote returned zero. Try again shortly.";
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
      if (receipt?.status === "reverted") {
        return `Error buying GBLIN: transaction ${txHash} reverted.`;
      }

      return `Bought GBLIN with ${args.ethAmount} ETH (min out ${formatUnits(minOut, 18)} GBLIN, expected ${formatUnits(expectedOut, 18)}). Transaction hash: ${txHash}`;
    } catch (error) {
      return `Error buying GBLIN: ${error}`;
    }
  }

  /**
   * Redeems GBLIN back to ETH through the GBLIN Zap, protected by a min-out derived from the
   * on-chain quote.
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
- slippageBps: optional max slippage vs the on-chain NAV quote, in basis points (default 100 = 1%)

The GBLIN Zap redeems the shares in kind and sells every basket leg for ETH, all or nothing. If the shares are not yet approved to the Zap, the action first sends an approval.
Note: the vault enforces a 20-second redemption cooldown after a mint for oneself; if you just bought, wait before selling.
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
      const shares = parseUnits(args.gblinAmount, 18);
      const slippage = args.slippageBps != null ? BigInt(args.slippageBps) : DEFAULT_SLIPPAGE_BPS;
      const owner = (await wallet.getAddress()) as Hex;

      const reliable = (await wallet.readContract({
        address: GBLIN_ADDRESS as Hex,
        abi: GBLIN_ABI,
        functionName: "isNavReliable",
        args: [],
      })) as boolean;
      if (!reliable) {
        return "Error: the vault reports its NAV as not reliable right now (a price feed or a basket balance is unavailable). Try again later.";
      }

      const expectedEth = (await wallet.readContract({
        address: GBLIN_LENS_ADDRESS as Hex,
        abi: GBLIN_LENS_ABI,
        functionName: "quoteSell",
        args: [GBLIN_ADDRESS as Hex, shares],
      })) as bigint;
      if (expectedEth <= 0n) {
        return "Error: on-chain quote returned zero. Try again shortly.";
      }
      const minEthOut = (expectedEth * (BPS - slippage)) / BPS;

      const rows = (await wallet.readContract({
        address: GBLIN_LENS_ADDRESS as Hex,
        abi: GBLIN_LENS_ABI,
        functionName: "basketLength",
        args: [GBLIN_ADDRESS as Hex],
      })) as bigint;
      const venue = encodeAbiParameters([{ type: "uint24" }], [VENUE_FEE_TIER]);
      const venueData = Array.from({ length: Number(rows) }, () => venue);

      const allowance = (await wallet.readContract({
        address: GBLIN_ADDRESS as Hex,
        abi: GBLIN_ABI,
        functionName: "allowance",
        args: [owner, GBLIN_ZAP_ADDRESS as Hex],
      })) as bigint;
      if (allowance < shares) {
        const approveHash = await wallet.sendTransaction({
          to: GBLIN_ADDRESS as `0x${string}`,
          data: encodeFunctionData({
            abi: GBLIN_ABI,
            functionName: "approve",
            args: [GBLIN_ZAP_ADDRESS as Hex, shares],
          }),
        });
        const approval = await wallet.waitForTransactionReceipt(approveHash);
        if (approval?.status === "reverted") {
          return `Error redeeming GBLIN: approval ${approveHash} reverted.`;
        }
      }

      const data = encodeFunctionData({
        abi: GBLIN_ZAP_ABI,
        functionName: "sellGBLINForEth",
        args: [shares, minEthOut, venueData, owner],
      });

      const txHash = await wallet.sendTransaction({
        to: GBLIN_ZAP_ADDRESS as `0x${string}`,
        data,
      });
      const receipt = await wallet.waitForTransactionReceipt(txHash);
      if (receipt?.status === "reverted") {
        return `Error redeeming GBLIN: transaction ${txHash} reverted.`;
      }

      return `Redeemed ${args.gblinAmount} GBLIN for at least ${formatEther(minEthOut)} ETH. Transaction hash: ${txHash}`;
    } catch (error) {
      return `Error redeeming GBLIN: ${error}`;
    }
  }

  /**
   * Reads live GBLIN state (per-share ETH value, supply and NAV reliability).
   *
   * @param wallet - The wallet instance used for on-chain reads
   * @param _ - Empty args
   * @returns A JSON string with the vault state or an error message
   */
  @CreateAction({
    name: "get_gblin_state",
    description:
      "Read live GBLIN state: ETH value of one GBLIN at NAV (from the GBLIN Lens), total supply, and whether the vault reports its NAV as reliable. Use before buying or redeeming.",
    schema: GetTreasuryStateSchema,
  })
  async getGblinState(
    wallet: EvmWalletProvider,
    _: z.infer<typeof GetTreasuryStateSchema>,
  ): Promise<string> {
    try {
      const oneGblin = parseUnits("1", 18);
      const [ethPerGblin, supply, navReliable] = await Promise.all([
        wallet.readContract({
          address: GBLIN_LENS_ADDRESS as Hex,
          abi: GBLIN_LENS_ABI,
          functionName: "quoteSell",
          args: [GBLIN_ADDRESS as Hex, oneGblin],
        }) as Promise<bigint>,
        wallet.readContract({
          address: GBLIN_ADDRESS as Hex,
          abi: GBLIN_ABI,
          functionName: "totalSupply",
          args: [],
        }) as Promise<bigint>,
        wallet.readContract({
          address: GBLIN_ADDRESS as Hex,
          abi: GBLIN_ABI,
          functionName: "isNavReliable",
          args: [],
        }) as Promise<boolean>,
      ]);

      return JSON.stringify({
        contract: GBLIN_ADDRESS,
        network: "base-mainnet",
        ethValuePerGblin: formatEther(ethPerGblin),
        totalSupply: formatUnits(supply, 18),
        navReliable,
        note: "Managed crypto exposure (cbBTC, WETH, USDC) with on-chain drawdown protection; not a stablecoin.",
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
