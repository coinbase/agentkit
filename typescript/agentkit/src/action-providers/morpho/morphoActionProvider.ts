import { z } from "zod";
import { Decimal } from "decimal.js";
import { encodeFunctionData, Hex, parseUnits } from "viem";
import { abi } from "../erc20/constants";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { METAMORPHO_ABI } from "./constants";
import { DepositSchema, WithdrawSchema } from "./schemas";
import { Network } from "../../network";

export const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * MorphoActionProvider is an action provider for Morpho Vault interactions.
 */
export class MorphoActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the MorphoActionProvider class.
   */
  constructor() {
    super("morpho", []);
  }

  /**
   * Deposits assets into a Morpho Vault
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "deposit",
    description: `
This tool allows depositing assets into a Morpho Vault. 

It takes:
- vaultAddress: The address of the Morpho Vault to deposit to
- assets: The amount of assets to deposit in whole units
  Examples for WETH:
  - 1 WETH
  - 0.1 WETH
  - 0.01 WETH
- receiver: The address to receive the shares
- tokenAddress: The address of the token to approve

Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action.
- Please use a token address (example 0x4200000000000000000000000000000000000006) for the tokenAddress field.
`,
    schema: DepositSchema,
  })
  async deposit(wallet: EvmWalletProvider, args: z.infer<typeof DepositSchema>): Promise<string> {
    const assets = new Decimal(args.assets);

    if (assets.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Assets amount must be greater than 0";
    }

    try {
      const decimals = await wallet.readContract({
        address: args.tokenAddress as Hex,
        abi,
        functionName: "decimals",
        args: [],
      });

      const atomicAssets = parseUnits(args.assets, decimals);

      const approvalResult = await approve(
        wallet,
        args.tokenAddress,
        args.vaultAddress,
        atomicAssets,
      );
      if (approvalResult.startsWith("Error")) {
        return `Error approving Morpho Vault as spender: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: METAMORPHO_ABI,
        functionName: "deposit",
        args: [atomicAssets, args.receiver],
      });

      const txHash = await wallet.sendTransaction({
        to: args.vaultAddress as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Deposited ${args.assets} to Morpho Vault ${args.vaultAddress} with transaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error depositing to Morpho Vault: ${error}`;
    }
  }

  /**
   * Withdraws assets from a Morpho Vault
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "withdraw",
    description: `
This tool allows withdrawing assets from a Morpho Vault. It takes:

- vaultAddress: The address of the Morpho Vault to withdraw from
- assets: The amount of assets to withdraw in atomic units (wei)
- receiver: The address to receive the shares
`,
    schema: WithdrawSchema,
  })
  async withdraw(wallet: EvmWalletProvider, args: z.infer<typeof WithdrawSchema>): Promise<string> {
    if (BigInt(args.assets) <= 0) {
      return "Error: Assets amount must be greater than 0";
    }

    try {
      const data = encodeFunctionData({
        abi: METAMORPHO_ABI,
        functionName: "withdraw",
        args: [BigInt(args.assets), args.receiver, args.receiver],
      });

      const txHash = await wallet.sendTransaction({
        to: args.vaultAddress as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Withdrawn ${args.assets} from Morpho Vault ${args.vaultAddress} with transaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error withdrawing from Morpho Vault: ${error}`;
    }
  }

  /**
   * Checks if the Morpho action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Morpho action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const morphoActionProvider = () => new MorphoActionProvider();
