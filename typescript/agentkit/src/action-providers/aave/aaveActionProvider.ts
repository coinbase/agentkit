import { z } from "zod";
import { Decimal } from "decimal.js";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";

import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { Network } from "../../network";
import { AAVE_POOL_ABI, AAVE_POOL_ADDRESSES, SUPPORTED_NETWORKS } from "./constants";
import { SupplySchema, WithdrawSchema } from "./schemas";

/**
 * AaveActionProvider is an action provider for Aave V3 Pool interactions
 * (supply/withdraw of ERC-20 reserves).
 */
export class AaveActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the AaveActionProvider class.
   */
  constructor() {
    super("aave", []);
  }

  /**
   * Supplies an ERC-20 asset into the Aave V3 lending pool.
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "supply",
    description: `
This tool allows supplying (depositing) an ERC-20 asset into the Aave V3 lending pool.

It takes:
- assetAddress: The address of the underlying ERC-20 asset to supply (e.g. USDC)
- assets: The amount of assets to supply, in whole units
  Examples for USDC:
  - 1 USDC
  - 0.5 USDC
  - 100 USDC
- onBehalfOf: The address that will receive the aTokens and own the supplied position — usually the wallet's own address

Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action.
- This tool handles token approval. Do not use any other action to approve tokens before calling this one.
- Only supported on Base mainnet and Base Sepolia.
`,
    schema: SupplySchema,
  })
  async supply(wallet: EvmWalletProvider, args: z.infer<typeof SupplySchema>): Promise<string> {
    const assets = new Decimal(args.assets);

    if (assets.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Assets amount must be greater than 0";
    }

    const network = wallet.getNetwork();
    const poolAddress = AAVE_POOL_ADDRESSES[network.networkId!];

    if (!poolAddress) {
      return `Error: Aave V3 is not supported on network ${network.networkId}`;
    }

    try {
      const decimals = await wallet.readContract({
        address: args.assetAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        args: [],
      });
      const atomicAssets = parseUnits(args.assets, decimals);

      const approvalResult = await approve(wallet, args.assetAddress, poolAddress, atomicAssets);
      if (approvalResult.startsWith("Error")) {
        return `Error approving Aave V3 Pool as spender: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [
          args.assetAddress as `0x${string}`,
          atomicAssets,
          args.onBehalfOf as `0x${string}`,
          0,
        ],
      });

      const txHash = await wallet.sendTransaction({ to: poolAddress, data });
      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Supplied ${args.assets} of ${args.assetAddress} to Aave V3 with transaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(
        receipt,
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
      )}`;
    } catch (error) {
      return `Error supplying to Aave V3: ${error}`;
    }
  }

  /**
   * Withdraws a previously supplied ERC-20 asset from the Aave V3 lending pool.
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "withdraw",
    description: `
This tool allows withdrawing a previously supplied ERC-20 asset from the Aave V3 lending pool.

It takes:
- assetAddress: The address of the underlying ERC-20 asset to withdraw (e.g. USDC)
- assets: The amount of assets to withdraw, in whole units. Aave treats an amount greater than the supplied balance as a request to withdraw the entire balance — use a very large number (e.g. 1000000000) to withdraw everything.
- to: The address that will receive the withdrawn assets

Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action.
- Only supported on Base mainnet and Base Sepolia.
`,
    schema: WithdrawSchema,
  })
  async withdraw(wallet: EvmWalletProvider, args: z.infer<typeof WithdrawSchema>): Promise<string> {
    const assets = new Decimal(args.assets);

    if (assets.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Assets amount must be greater than 0";
    }

    const network = wallet.getNetwork();
    const poolAddress = AAVE_POOL_ADDRESSES[network.networkId!];

    if (!poolAddress) {
      return `Error: Aave V3 is not supported on network ${network.networkId}`;
    }

    try {
      const decimals = await wallet.readContract({
        address: args.assetAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        args: [],
      });
      const atomicAssets = parseUnits(args.assets, decimals);

      const data = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "withdraw",
        args: [args.assetAddress as `0x${string}`, atomicAssets, args.to as `0x${string}`],
      });

      const txHash = await wallet.sendTransaction({ to: poolAddress, data });
      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Withdrew ${args.assets} of ${args.assetAddress} from Aave V3 with transaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(
        receipt,
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
      )}`;
    } catch (error) {
      return `Error withdrawing from Aave V3: ${error}`;
    }
  }

  /**
   * Checks if the Aave action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Aave action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const aaveActionProvider = () => new AaveActionProvider();
