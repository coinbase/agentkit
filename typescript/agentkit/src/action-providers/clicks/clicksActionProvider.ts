import { z } from "zod";
import { encodeFunctionData, Hex, parseUnits, formatUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import {
  CLICKS_SPLITTER_ADDRESS,
  CLICKS_YIELD_ROUTER_ADDRESS,
  USDC_BASE_ADDRESS,
  CLICKS_SPLITTER_ABI,
  CLICKS_YIELD_ROUTER_ABI,
  ERC20_APPROVE_ABI,
} from "./constants";
import {
  ClicksQuickStartSchema,
  ClicksDepositSchema,
  ClicksWithdrawSchema,
  ClicksGetInfoSchema,
} from "./schemas";
import { Network } from "../../network";

const USDC_DECIMALS = 6;

export const SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * ClicksActionProvider is an action provider for Clicks Protocol interactions.
 *
 * Clicks Protocol enables AI agents to earn yield on USDC through an 80/20 revenue
 * split model, powered by Aave V3 and Morpho yield strategies on Base.
 */
export class ClicksActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the ClicksActionProvider class.
   */
  constructor() {
    super("clicks", []);
  }

  /**
   * Quick start: registers the agent and deposits USDC into Clicks Protocol.
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "quick_start",
    description: `
This tool registers an AI agent with Clicks Protocol and deposits USDC in a single transaction.
Clicks Protocol splits revenue 80/20 (80% to the agent, 20% protocol fee) and routes
deposited USDC into yield strategies (Aave V3 / Morpho) on Base.

It takes:
- amount: The amount of USDC to deposit (e.g. "100" for 100 USDC)

Important notes:
- Only supported on Base mainnet
- The wallet must hold sufficient USDC
- This will approve the ClicksSplitter contract to spend USDC before depositing
`,
    schema: ClicksQuickStartSchema,
  })
  async quickStart(
    wallet: EvmWalletProvider,
    args: z.infer<typeof ClicksQuickStartSchema>,
  ): Promise<string> {
    try {
      const atomicAmount = parseUnits(args.amount, USDC_DECIMALS);

      if (atomicAmount <= 0n) {
        return "Error: Amount must be greater than 0";
      }

      const agentAddress = await wallet.getAddress();

      // Approve USDC spend
      const approveData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [CLICKS_SPLITTER_ADDRESS as Hex, atomicAmount],
      });

      const approveTxHash = await wallet.sendTransaction({
        to: USDC_BASE_ADDRESS as `0x${string}`,
        data: approveData,
      });

      await wallet.waitForTransactionReceipt(approveTxHash);

      // Call quickStart
      const data = encodeFunctionData({
        abi: CLICKS_SPLITTER_ABI,
        functionName: "quickStart",
        args: [agentAddress as Hex, atomicAmount],
      });

      const txHash = await wallet.sendTransaction({
        to: CLICKS_SPLITTER_ADDRESS as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Successfully registered agent and deposited ${args.amount} USDC into Clicks Protocol.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error during Clicks Protocol quick start: ${error}`;
    }
  }

  /**
   * Deposits USDC into the Clicks Yield Router for yield generation.
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "deposit",
    description: `
This tool deposits additional USDC into the Clicks Yield Router, which routes funds
into active yield strategies (Aave V3 / Morpho) on Base.

It takes:
- amount: The amount of USDC to deposit (e.g. "50" for 50 USDC)

Important notes:
- Only supported on Base mainnet
- The wallet must hold sufficient USDC
- The agent should already be registered via quick_start
`,
    schema: ClicksDepositSchema,
  })
  async deposit(
    wallet: EvmWalletProvider,
    args: z.infer<typeof ClicksDepositSchema>,
  ): Promise<string> {
    try {
      const atomicAmount = parseUnits(args.amount, USDC_DECIMALS);

      if (atomicAmount <= 0n) {
        return "Error: Amount must be greater than 0";
      }

      // Approve USDC spend for YieldRouter
      const approveData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [CLICKS_YIELD_ROUTER_ADDRESS as Hex, atomicAmount],
      });

      const approveTxHash = await wallet.sendTransaction({
        to: USDC_BASE_ADDRESS as `0x${string}`,
        data: approveData,
      });

      await wallet.waitForTransactionReceipt(approveTxHash);

      // Deposit into YieldRouter
      const data = encodeFunctionData({
        abi: CLICKS_YIELD_ROUTER_ABI,
        functionName: "deposit",
        args: [atomicAmount],
      });

      const txHash = await wallet.sendTransaction({
        to: CLICKS_YIELD_ROUTER_ADDRESS as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Deposited ${args.amount} USDC into Clicks Yield Router.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error depositing to Clicks Yield Router: ${error}`;
    }
  }

  /**
   * Withdraws USDC from the Clicks Yield Router.
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "withdraw",
    description: `
This tool withdraws USDC from the Clicks Yield Router, pulling funds back from the
active yield strategy.

It takes:
- amount: The amount of USDC to withdraw (e.g. "50" for 50 USDC)

Important notes:
- Only supported on Base mainnet
- Cannot withdraw more than the deposited amount
`,
    schema: ClicksWithdrawSchema,
  })
  async withdraw(
    wallet: EvmWalletProvider,
    args: z.infer<typeof ClicksWithdrawSchema>,
  ): Promise<string> {
    try {
      const atomicAmount = parseUnits(args.amount, USDC_DECIMALS);

      if (atomicAmount <= 0n) {
        return "Error: Amount must be greater than 0";
      }

      const data = encodeFunctionData({
        abi: CLICKS_YIELD_ROUTER_ABI,
        functionName: "withdraw",
        args: [atomicAmount],
      });

      const txHash = await wallet.sendTransaction({
        to: CLICKS_YIELD_ROUTER_ADDRESS as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Withdrawn ${args.amount} USDC from Clicks Yield Router.\nTransaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error withdrawing from Clicks Yield Router: ${error}`;
    }
  }

  /**
   * Gets the agent's current info from Clicks Protocol.
   *
   * @param wallet - The wallet instance to read contract state
   * @param args - The input arguments for the action (none required)
   * @returns Agent info including registration status, deposited amount, and earnings
   */
  @CreateAction({
    name: "get_info",
    description: `
This tool retrieves the current agent's information from Clicks Protocol, including:
- Whether the agent is registered
- The agent's splitter contract address
- Total USDC deposited
- Total USDC earned through the 80/20 yield split

No arguments are required - it uses the connected wallet's address.
`,
    schema: ClicksGetInfoSchema,
  })
  async getInfo(
    wallet: EvmWalletProvider,
    args: z.infer<typeof ClicksGetInfoSchema>,
  ): Promise<string> {
    try {
      const agentAddress = await wallet.getAddress();

      const result = await wallet.readContract({
        address: CLICKS_SPLITTER_ADDRESS as Hex,
        abi: CLICKS_SPLITTER_ABI,
        functionName: "getAgentInfo",
        args: [agentAddress as Hex],
      });

      const [splitter, registered, deposited, earned] = result as [string, boolean, bigint, bigint];

      const depositedUsdc = formatUnits(deposited, USDC_DECIMALS);
      const earnedUsdc = formatUnits(earned, USDC_DECIMALS);

      return `Clicks Protocol Agent Info:
- Address: ${agentAddress}
- Registered: ${registered}
- Splitter: ${splitter}
- Deposited: ${depositedUsdc} USDC
- Earned: ${earnedUsdc} USDC`;
    } catch (error) {
      return `Error getting Clicks Protocol agent info: ${error}`;
    }
  }

  /**
   * Checks if the Clicks action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Clicks action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const clicksActionProvider = () => new ClicksActionProvider();
