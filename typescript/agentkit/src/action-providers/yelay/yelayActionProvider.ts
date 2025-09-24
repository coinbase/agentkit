import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  YelayClaimSchema,
  YelayDepositSchema,
  YelayRedeemSchema,
  YelayBalanceSchema,
} from "./schemas";
import type { APYResponse, VaultsDetailsResponse, ClaimRequest, ChainId } from "./types";
import {
  CONTRACTS_BY_CHAIN,
  RETAIL_POOL_ID,
  YELAY_BACKEND_URL,
  YELAY_VAULT_ABI,
  YIELD_EXTRACTOR_ABI,
} from "./constants";
import { parseUnits, encodeFunctionData, formatUnits } from "viem";

import { approve } from "../../utils";

// Mainnet, Sonic, Base, Arbitrum, Avalanche
const SUPPORTED_CHAIN_IDS = ["1", "146", "8453", "42161", "43114"];
/**
 * YelayActionProvider provides actions for yelay operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 * It supports all evm networks.
 */
export class YelayActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the YelayActionProvider.
   */
  constructor() {
    super("yelay", []);
  }

  /**
   * Gets the details of the Yelay vaults with their last week APY.
   *
   * @param wallet - The wallet instance to get chainId
   * @returns A formatted string containing the list of vaults with their APY.
   */
  @CreateAction({
    name: "get_vaults",
    description: `Getting Yelay vaults for the base network`,
    schema: z.object({}),
  })
  async getVaults(wallet: EvmWalletProvider): Promise<string> {
    let vaultsResponse: Response;
    let vaultAPYsResponse: Response;

    try {
      const chainId = wallet.getNetwork().chainId!;
      [vaultsResponse, vaultAPYsResponse] = await Promise.all([
        fetch(`${YELAY_BACKEND_URL}/vaults?chainId=${chainId}`),
        fetch(`${YELAY_BACKEND_URL}/interest/vaults?chainId=${chainId}`),
      ]);

      if (!vaultsResponse.ok || !vaultAPYsResponse.ok) {
        const errorMessage = !vaultsResponse.ok
          ? `Failed to fetch vaults: ${vaultsResponse.status} ${vaultsResponse.statusText}`
          : `Failed to fetch APYs: ${vaultAPYsResponse.status} ${vaultAPYsResponse.statusText}`;
        throw new Error(errorMessage);
      }

      const [vaults, vaultAPYs] = await Promise.all([
        vaultsResponse.json() as Promise<VaultsDetailsResponse[]>,
        vaultAPYsResponse.json() as Promise<APYResponse[]>,
      ]);

      const vaultsDetails = vaults.map(vault => ({
        ...vault,
        apy: vaultAPYs.find(apy => apy.vault === vault.address)?.apy,
      }));

      return vaultsDetails
        .map(
          vault => `
${vault.name}:
Address: ${vault.address}
APY: ${vault.apy}%
`,
        )
        .join("----------------");
    } catch (error) {
      if (error instanceof Error) {
return "Error fetching vault data: " + error.message;
      }
      return "Yield backend is currently unavailable. Please try again later.";
    }
  }

  /**
   * Deposits assets into a Yelay Vault
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "deposit",
    description: `
 This action deposits assets into a specified Yelay Vault. 
 
 It takes:
 - assets: The amount of assets to deposit in whole units
   Examples for WETH:
   - 1 WETH
   - 0.1 WETH
   - 0.01 WETH
 - vaultAddress: The address of the Yelay Vault to deposit to
 
 Important notes:
 - Make sure to use the exact amount provided. Do not convert units for assets for this action.
 `,
    schema: YelayDepositSchema,
  })
  async deposit(
    wallet: EvmWalletProvider,
    args: z.infer<typeof YelayDepositSchema>,
  ): Promise<string> {
    try {
      const chainId = wallet.getNetwork().chainId! as ChainId;
      const vaultsResponse = await fetch(`${YELAY_BACKEND_URL}/vaults?chainId=${chainId}`);
      const vaults = (await vaultsResponse.json()) as VaultsDetailsResponse[];
      const vault = vaults.find(vault => vault.address === args.vaultAddress);

      if (!vault) {
        return "Error: Vault not found";
      }

      const atomicAssets = parseUnits(args.assets, vault.decimals);
      if (atomicAssets <= 0) {
        return "Error: Assets amount must be greater than 0";
      }

      await approve(wallet, vault.underlying, args.vaultAddress, atomicAssets);

      const data = encodeFunctionData({
        abi: YELAY_VAULT_ABI,
        functionName: "deposit",
        args: [atomicAssets, RETAIL_POOL_ID, wallet.getAddress() as `0x${string}`],
      });

      const txHash = await wallet.sendTransaction({ to: args.vaultAddress as `0x${string}`, data });

      await wallet.waitForTransactionReceipt(txHash);

      return `Deposited ${args.assets} to Yelay Vault ${args.vaultAddress} with transaction hash: ${txHash}`;
    } catch (error) {
      return `Error depositing to Yelay Vault: ${error}`;
    }
  }

  /**
   * Redeems assets from a Yelay Vault
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "redeem",
    description: `
This tool allows redeeming assets from a Yelay Vault. 
It takes:
- assets: The amount of assets to redeem in atomic units (wei)
- vaultAddress: The address of the vault to redeem from

Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action.
`,
    schema: YelayRedeemSchema,
  })
  async redeem(
    wallet: EvmWalletProvider,
    args: z.infer<typeof YelayRedeemSchema>,
  ): Promise<string> {
    try {
      const chainId = wallet.getNetwork().chainId! as ChainId;
      const vaultsResponse = await fetch(`${YELAY_BACKEND_URL}/vaults?chainId=${chainId}`);
      const vaults = (await vaultsResponse.json()) as VaultsDetailsResponse[];
      const vault = vaults.find(vault => vault.address === args.vaultAddress);

      if (!vault) {
        return "Error: Vault not found";
      }

      const atomicAssets = parseUnits(args.assets, vault.decimals);
      if (atomicAssets <= 0) {
        return "Error: Assets amount must be greater than 0";
      }

      const data = encodeFunctionData({
        abi: YELAY_VAULT_ABI,
        functionName: "redeem",
        args: [atomicAssets, RETAIL_POOL_ID, wallet.getAddress() as `0x${string}`],
      });

      const txHash = await wallet.sendTransaction({ to: args.vaultAddress as `0x${string}`, data });

      await wallet.waitForTransactionReceipt(txHash);

      return `Redeemed ${args.assets} from Yelay Vault ${args.vaultAddress} with transaction hash: ${txHash}`;
    } catch (error) {
      return `Error redeeming from Yelay Vault: ${error}`;
    }
  }

  /**
   * Claims yield from Yelay
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with transaction details or an error message
   */
  @CreateAction({
    name: "claim",
    description: `
This tool allows claiming yield from a Yelay Vault. 
It takes:
- vaultAddress: The address of the Yelay Vault to claim yield from
`,
    schema: YelayClaimSchema,
  })
  async claim(wallet: EvmWalletProvider, args: z.infer<typeof YelayClaimSchema>): Promise<string> {
    try {
      const chainId = wallet.getNetwork().chainId! as ChainId;
      const claimRequestResponse = await fetch(
        `${YELAY_BACKEND_URL}/claim-proof?chainId=${chainId}&u=${wallet.getAddress()}&p=${RETAIL_POOL_ID}&v=${args.vaultAddress}`,
      );
      const claimRequests: ClaimRequest[] = await claimRequestResponse.json();
      if (claimRequests.length === 0) {
        return "Error: No claim requests found";
      }

      try {
        const data = encodeFunctionData({
          abi: YIELD_EXTRACTOR_ABI,
          functionName: "claim",
          args: [claimRequests],
        });

        const txHash = await wallet.sendTransaction({
          to: CONTRACTS_BY_CHAIN[chainId].YieldExtractor,
          data,
        });

        await wallet.waitForTransactionReceipt(txHash);

        return claimRequests
          .map(
            c =>
              `Claimed ${c.yieldSharesTotal} from Yelay Vault ${args.vaultAddress} with transaction hash: ${txHash}`,
          )
          .join("\n");
      } catch (error) {
        return `Error claiming yield from Yelay Vault: ${error}`;
      }
    } catch (error) {
      return `Error obtaining proof for yield to claim from Yelay Vault: ${error}`;
    }
  }

  /**
   * Gets user balance from Yelay
   *
   * @param wallet - The wallet instance to execute the transaction
   * @param args - The input arguments for the action
   * @returns A success message with user postion, generated and claimedyield
   */
  @CreateAction({
    name: "get_balance",
    description: `
This tool allows getting user balance from Yelay. 
It takes:
- vaultAddress: The address of the Yelay Vault to get balance from
`,
    schema: YelayBalanceSchema,
  })
  async getBalance(
    wallet: EvmWalletProvider,
    args: z.infer<typeof YelayBalanceSchema>,
  ): Promise<string> {
    try {
      const chainId = wallet.getNetwork().chainId! as ChainId;
      const vaultsResponse = await fetch(`${YELAY_BACKEND_URL}/vaults?chainId=${chainId}`);
      const vaults = (await vaultsResponse.json()) as VaultsDetailsResponse[];
      const vault = vaults.find(vault => vault.address === args.vaultAddress);

      if (!vault) {
        return "Error: Vault not found";
      }

      const balance = (await wallet.readContract({
        address: args.vaultAddress as `0x${string}`,
        abi: YELAY_VAULT_ABI,
        functionName: "balanceOf",
        args: [wallet.getAddress(), RETAIL_POOL_ID],
      })) as bigint;

      const balanceInWholeUnits = formatUnits(balance, vault.decimals);

      const balanceResponse = await fetch(
        `${YELAY_BACKEND_URL}/claim-proof?chainId=${chainId}&u=${wallet.getAddress()}&p=${RETAIL_POOL_ID}&v=${args.vaultAddress}`,
      );
      if (!balanceResponse.ok) {
        throw new Error("Claim proof failed");
      }
      const claimRequests: ClaimRequest[] = await balanceResponse.json();
      if (claimRequests.length === 0) {
        return `User balance from Yelay Vault ${args.vaultAddress}: ${balanceInWholeUnits}`;
      }
      const claimRequest = claimRequests[0];
      const yieldSharesClaimed = (await wallet.readContract({
        address: CONTRACTS_BY_CHAIN[chainId].YieldExtractor,
        abi: YIELD_EXTRACTOR_ABI,
        functionName: "yieldSharesClaimed",
        args: [wallet.getAddress(), args.vaultAddress, RETAIL_POOL_ID],
      })) as bigint;

      return `
      User balance from Yelay Vault ${args.vaultAddress}: ${balanceInWholeUnits}
      Yield shares generated: ${claimRequest.yieldSharesTotal}
      Yield shares claimed: ${yieldSharesClaimed}`;
    } catch (error) {
      return `Error getting balance from Yelay Vault: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      (network.chainId ? SUPPORTED_CHAIN_IDS.includes(network.chainId) : false)
    );
  }
}

/**
 * Creates a new YelayActionProvider instance
 *
 * @returns A new YelayActionProvider instance
 */
export const yelayActionProvider = (): YelayActionProvider => {
  return new YelayActionProvider();
};
