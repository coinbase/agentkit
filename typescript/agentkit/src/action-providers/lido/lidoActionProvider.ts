import { z } from "zod";
import { encodeFunctionData, formatEther, Hex, parseEther } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { Network } from "../../network";
import {
  WSTETH_BASE,
  LIDO_CUSTOM_SENDER_BASE,
  WETH_BASE,
  LIDO_CUSTOM_SENDER_ABI,
  WSTETH_ABI,
} from "./constants";
import { StakeSchema, StakeWethSchema, CheckBalanceSchema } from "./schemas";

const LIDO_SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * LidoActionProvider enables staking ETH/WETH to receive wstETH on Base.
 *
 * Uses Lido's Direct Staking via Chainlink CCIP for instant fastStake
 * operations. wstETH is the non-rebasing wrapped version of stETH,
 * earning staking yield through increasing exchange rate.
 */
export class LidoActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("lido", []);
  }

  @CreateAction({
    name: "stake_eth",
    description: `
Stake ETH to receive wstETH on Base via Lido Direct Staking.

Uses Lido's fastStake powered by Chainlink CCIP — instant wstETH from the
Base liquidity pool. wstETH is the non-rebasing wrapped staked ETH that
earns ~3-4% APY through an increasing exchange rate.

It takes:
- amount: Amount of ETH to stake in whole units (e.g., '0.1' for 0.1 ETH)
- slippage: Max slippage tolerance (default 0.005 = 0.5%)

Example: Stake 0.5 ETH to receive ~0.415 wstETH (rate varies with staking rewards).

Important: The exchange rate is approximately 1 wstETH = 1.2 ETH. You will
receive fewer wstETH tokens than ETH sent, but each wstETH is worth more.
`,
    schema: StakeSchema,
  })
  async stakeEth(wallet: EvmWalletProvider, args: z.infer<typeof StakeSchema>): Promise<string> {
    try {
      const ethAmount = parseEther(args.amount);

      // Get expected wstETH output for slippage calculation
      const expectedWstETH = (await wallet.readContract({
        address: LIDO_CUSTOM_SENDER_BASE as Hex,
        abi: LIDO_CUSTOM_SENDER_ABI,
        functionName: "getExpectedWstETH",
        args: [ethAmount],
      })) as bigint;

      const slippageBps = BigInt(Math.floor(args.slippage * 10000));
      const minWstETH = expectedWstETH - (expectedWstETH * slippageBps) / 10000n;

      const data = encodeFunctionData({
        abi: LIDO_CUSTOM_SENDER_ABI,
        functionName: "fastStake",
        args: [minWstETH, "0x0000000000000000000000000000000000000000" as `0x${string}`],
      });

      const txHash = await wallet.sendTransaction({
        to: LIDO_CUSTOM_SENDER_BASE as `0x${string}`,
        data,
        value: ethAmount,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Successfully staked ${args.amount} ETH via Lido on Base.\nExpected wstETH: ~${formatEther(expectedWstETH)}\nMin wstETH (with ${args.slippage * 100}% slippage): ${formatEther(minWstETH)}\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error staking ETH via Lido: ${error}`;
    }
  }

  @CreateAction({
    name: "stake_weth",
    description: `
Stake WETH to receive wstETH on Base via Lido Direct Staking.

Similar to stake_eth but uses WETH instead of native ETH. Requires
WETH approval before staking.

It takes:
- amount: Amount of WETH to stake in whole units (e.g., '0.1' for 0.1 WETH)
- slippage: Max slippage tolerance (default 0.005 = 0.5%)
`,
    schema: StakeWethSchema,
  })
  async stakeWeth(
    wallet: EvmWalletProvider,
    args: z.infer<typeof StakeWethSchema>,
  ): Promise<string> {
    try {
      const wethAmount = parseEther(args.amount);

      // Get expected wstETH output
      const expectedWstETH = (await wallet.readContract({
        address: LIDO_CUSTOM_SENDER_BASE as Hex,
        abi: LIDO_CUSTOM_SENDER_ABI,
        functionName: "getExpectedWstETH",
        args: [wethAmount],
      })) as bigint;

      const slippageBps = BigInt(Math.floor(args.slippage * 10000));
      const minWstETH = expectedWstETH - (expectedWstETH * slippageBps) / 10000n;

      // Approve WETH spending
      const approvalResult = await approve(
        wallet,
        WETH_BASE,
        LIDO_CUSTOM_SENDER_BASE,
        wethAmount,
      );
      if (approvalResult.startsWith("Error")) {
        return `Error approving WETH: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: LIDO_CUSTOM_SENDER_ABI,
        functionName: "fastStakeWETH",
        args: [
          wethAmount,
          minWstETH,
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        ],
      });

      const txHash = await wallet.sendTransaction({
        to: LIDO_CUSTOM_SENDER_BASE as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Successfully staked ${args.amount} WETH via Lido on Base.\nExpected wstETH: ~${formatEther(expectedWstETH)}\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error staking WETH via Lido: ${error}`;
    }
  }

  @CreateAction({
    name: "check_wsteth_balance",
    description: `
Check the current wstETH balance of the connected wallet on Base.

Returns the wstETH balance and an estimate of the underlying ETH value
based on the current exchange rate (~1.2 ETH per wstETH).

No inputs required.
`,
    schema: CheckBalanceSchema,
  })
  async checkBalance(wallet: EvmWalletProvider): Promise<string> {
    try {
      const userAddress = await wallet.getAddress();

      const balance = (await wallet.readContract({
        address: WSTETH_BASE as Hex,
        abi: WSTETH_ABI,
        functionName: "balanceOf",
        args: [userAddress as `0x${string}`],
      })) as bigint;

      const balanceFormatted = formatEther(balance);

      return `wstETH Balance on Base: ${balanceFormatted} wstETH\nWallet: ${userAddress}\nToken: ${WSTETH_BASE}`;
    } catch (error) {
      return `Error checking wstETH balance: ${error}`;
    }
  }

  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && LIDO_SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const lidoActionProvider = () => new LidoActionProvider();
