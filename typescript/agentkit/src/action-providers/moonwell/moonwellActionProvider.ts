import { z } from "zod";
import { Decimal } from "decimal.js";
import { encodeFunctionData, parseEther, parseUnits } from "viem";

import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import {
  MTOKEN_ABI,
  MOONWELL_BASE_ADDRESSES,
  ETH_ROUTER_ABI,
  WETH_ROUTER_ADDRESS,
  MOONWELL_BASE_SEPOLIA_ADDRESSES,
  MTOKENS_UNDERLYING_DECIMALS,
  TOKEN_DECIMALS,
} from "./constants";
import { MintSchema, RedeemSchema } from "./schemas";
import { Network } from "../../network";

export const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * MoonwellActionProvider is an action provider for Moonwell MToken interactions.
 */
export class MoonwellActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the MoonwellActionProvider class.
   */
  constructor() {
    super("moonwell", []);
  }

  /**
   * Deposits assets into a Moonwell MToken
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "mint",
    description: `
This tool allows minting assets into a Moonwell MToken. 

It takes:
- mTokenAddress: The address of the Moonwell MToken to mint to
- assets: The amount of assets that will be approved to spend by the mToken in whole units
  Examples for WETH:
  - 1 WETH
  - 0.1 WETH
  - 0.01 WETH
  Examples for cbETH:
  - 1 cbETH
  - 0.1 cbETH
  - 0.01 cbETH
  Examples for USDC:
  - 1 USDC
  - 0.1 USDC
  - 0.01 USDC
- tokenAddress: The address of the token to approve

Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action.
- Please use a token address (example 0x4200000000000000000000000000000000000006) for the tokenAddress field.
- This tool handles token approval. If requested to mint on Moonwell, do not use any other actions to approve tokens.
`,
    schema: MintSchema,
  })
  async mint(wallet: EvmWalletProvider, args: z.infer<typeof MintSchema>): Promise<string> {
    const assets = new Decimal(args.assets);

    if (assets.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Assets amount must be greater than 0";
    }

    const network = wallet.getNetwork();
    const networkObject =
      network.networkId === "base-mainnet"
        ? MOONWELL_BASE_ADDRESSES
        : MOONWELL_BASE_SEPOLIA_ADDRESSES;

    if (!networkObject[args.mTokenAddress]) {
      return "Error: Invalid MToken address";
    }

    try {
      // Handle different token decimals
      let atomicAssets: bigint;
      const userAddress = wallet.getAddress();

      if (
        network.networkId === "base-mainnet" &&
        "MOONWELL_WETH" === networkObject[args.mTokenAddress]
      ) {
        // For ETH minting, use parseEther (18 decimals)
        atomicAssets = parseEther(args.assets);
      } else {
        // For other tokens, use the correct decimals
        const decimals = TOKEN_DECIMALS[args.tokenAddress];
        if (!decimals) {
          return `Error: Unsupported token address ${args.tokenAddress}. Please verify the token address is correct.`;
        }
        atomicAssets = parseUnits(args.assets, decimals);
      }

      // Check if this is a WETH mint on mainnet
      if (
        network.networkId === "base-mainnet" &&
        "MOONWELL_WETH" === networkObject[args.mTokenAddress]
      ) {
        // Use the router for ETH mints - no approval needed since we're sending native ETH
        const data = encodeFunctionData({
          abi: ETH_ROUTER_ABI,
          functionName: "mint",
          args: [userAddress],
        });

        const txHash = await wallet.sendTransaction({
          to: WETH_ROUTER_ADDRESS as `0x${string}`,
          data,
          value: atomicAssets,
        });

        const receipt = await wallet.waitForTransactionReceipt(txHash);

        return `Deposited ${args.assets} ETH to Moonwell WETH via router with transaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(
          receipt,
          (_, value) => (typeof value === "bigint" ? value.toString() : value),
        )}`;
      } else {
        // For all other tokens, we need approval first
        const approvalResult = await approve(
          wallet,
          args.tokenAddress,
          args.mTokenAddress,
          atomicAssets,
        );

        if (approvalResult.startsWith("Error")) {
          return `Error approving Moonwell MToken as spender: ${approvalResult}`;
        }

        const data = encodeFunctionData({
          abi: MTOKEN_ABI,
          functionName: "mint",
          args: [atomicAssets],
        });

        const txHash = await wallet.sendTransaction({
          to: args.mTokenAddress as `0x${string}`,
          data,
          value: 0n,
        });

        const receipt = await wallet.waitForTransactionReceipt(txHash);

        if (!receipt) {
          throw new Error("No receipt received for mint transaction");
        }

        if (receipt.status !== "success") {
          throw new Error(`Mint transaction failed with status ${receipt.status}`);
        }

        return `Deposited ${args.assets} to Moonwell MToken ${args.mTokenAddress} with transaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(
          receipt,
          (_, value) => (typeof value === "bigint" ? value.toString() : value),
        )}`;
      }
    } catch (error) {
      console.error("DEBUG - Mint error:", error);
      if (error instanceof Error) {
        return `Error minting Moonwell MToken: ${error.message}`;
      }
      return `Error minting Moonwell MToken: ${error}`;
    }
  }

  /**
   * Redeems assets from a Moonwell MToken
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "redeem",
    description: `
This tool allows redeeming assets from a Moonwell MToken. 

It takes:
- mTokenAddress: The address of the Moonwell MToken to redeem from
- assets: The amount of assets to redeem in whole units
  Examples for WETH:
  - 1 WETH
  - 0.1 WETH
  - 0.01 WETH
  Examples for cbETH:
  - 1 cbETH
  - 0.1 cbETH
  - 0.01 cbETH
  Examples for USDC:
  - 1 USDC
  - 0.1 USDC
  - 0.01 USDC

Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action.
- Please use a token address (example 0x4200000000000000000000000000000000000006) for the tokenAddress field.
`,
    schema: RedeemSchema,
  })
  async redeem(wallet: EvmWalletProvider, args: z.infer<typeof RedeemSchema>): Promise<string> {
    const assets = new Decimal(args.assets);

    if (assets.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Assets amount must be greater than 0";
    }

    const network = wallet.getNetwork();
    const networkObject =
      network.networkId === "base-mainnet"
        ? MOONWELL_BASE_ADDRESSES
        : MOONWELL_BASE_SEPOLIA_ADDRESSES;

    if (!networkObject[args.mTokenAddress]) {
      return "Error: Invalid MToken address";
    }

    try {
      // Handle different token decimals
      const decimals = MTOKENS_UNDERLYING_DECIMALS[MOONWELL_BASE_ADDRESSES[args.mTokenAddress]];

      if (!decimals) {
        return `Error: Unsupported token address ${args.mTokenAddress}. Please verify the token address is correct.`;
      }

      const atomicAssets = parseUnits(args.assets, decimals);

      const data = encodeFunctionData({
        abi: MTOKEN_ABI,
        functionName: "redeemUnderlying",
        args: [atomicAssets],
      });

      const txHash = await wallet.sendTransaction({
        to: args.mTokenAddress as `0x${string}`,
        data,
        value: 0n,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      if (!receipt) {
        throw new Error("No receipt received for redeem transaction");
      }

      if (receipt.status !== "success") {
        throw new Error(`Redeem transaction failed with status ${receipt.status}`);
      }

      return `Redeemed ${args.assets} from Moonwell MToken ${args.mTokenAddress} with transaction hash: ${txHash}\nTransaction receipt: ${JSON.stringify(
        receipt,
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
      )}`;
    } catch (error) {
      console.error("DEBUG - Redeem error:", error);
      if (error instanceof Error) {
        return `Error redeeming from Moonwell MToken: ${error.message}`;
      }
      return `Error redeeming from Moonwell MToken: ${error}`;
    }
  }

  /**
   * Checks if the Moonwell action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Moonwell action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const moonwellActionProvider = () => new MoonwellActionProvider();
