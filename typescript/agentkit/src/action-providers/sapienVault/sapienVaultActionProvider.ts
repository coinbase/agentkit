import { z } from "zod";
import { Decimal } from "decimal.js";
import { Address, encodeFunctionData, formatUnits, Hex, parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  SAPIEN_TOKEN_ADDRESS,
  SAPIEN_VAULT_ABI,
  SAPIEN_VAULT_ADDRESS,
  SAPIEN_VAULT_APP_URL,
} from "./constants";
import {
  SapienVaultDepositSchema,
  SapienVaultGetPositionSchema,
  SapienVaultGetVaultTotalsSchema,
  SapienVaultRedeemSchema,
  SapienVaultTransferSchema,
  SapienVaultWithdrawSchema,
} from "./schemas";
import {
  approveSapienIfNeeded,
  isSapienVaultNetwork,
  parseDepositAgeStatus,
  parseLockedAmount,
  readSapienShareDecimals,
  readSapienTokenDecimals,
  sapienVaultNetworkError,
} from "./utils";

/**
 * SapienVaultActionProvider is an action provider for the Sapien Vault (vSAPIEN) on Base.
 */
export class SapienVaultActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the SapienVaultActionProvider class.
   */
  constructor() {
    super("sapienVault", []);
  }

  /**
   * Deposits SAPIEN into the Sapien Vault, approving the vault only when needed.
   *
   * @param wallet - The wallet instance to execute the transaction.
   * @param args - The input arguments for the action.
   * @returns A success message with transaction details or an error message.
   */
  @CreateAction({
    name: "deposit",
    description: `
This tool deposits SAPIEN into the Sapien Vault on Base mainnet (ERC-4626) and mints vSAPIEN shares.

It takes:
- assets: The amount of SAPIEN to deposit in whole units (e.g. "1", "0.5", "100")
- receiver: Optional address to receive vSAPIEN. Defaults to the connected wallet.

Important notes:
- Only Base mainnet is supported. Do not call this on any other chain.
- Use the exact amount provided. Do not convert units.
- The vault will be approved to spend SAPIEN only if the current allowance is insufficient.
- Newly deposited shares may be subject to a minimum deposit age before they can be withdrawn or transferred.
- App: ${SAPIEN_VAULT_APP_URL}
- Vault (vSAPIEN): ${SAPIEN_VAULT_ADDRESS}
- Underlying SAPIEN: ${SAPIEN_TOKEN_ADDRESS}
`,
    schema: SapienVaultDepositSchema,
  })
  async deposit(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SapienVaultDepositSchema>,
  ): Promise<string> {
    const networkError = sapienVaultNetworkError(wallet);
    if (networkError) {
      return networkError;
    }

    const assets = new Decimal(args.assets);
    if (assets.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Assets amount must be greater than 0";
    }

    try {
      const owner = wallet.getAddress() as Address;
      const receiver = (args.receiver ?? owner) as Address;

      const decimals = await readSapienTokenDecimals(wallet);
      const atomicAssets = parseUnits(args.assets, decimals);

      const maxDeposit = (await wallet.readContract({
        address: SAPIEN_VAULT_ADDRESS as Hex,
        abi: SAPIEN_VAULT_ABI,
        functionName: "maxDeposit",
        args: [receiver],
      })) as bigint;

      if (atomicAssets > maxDeposit) {
        return (
          `Error: Deposit of ${args.assets} SAPIEN exceeds maxDeposit (${formatUnits(maxDeposit, decimals)} SAPIEN). ` +
          `The vault may be paused.`
        );
      }

      const previewShares = (await wallet.readContract({
        address: SAPIEN_VAULT_ADDRESS as Hex,
        abi: SAPIEN_VAULT_ABI,
        functionName: "previewDeposit",
        args: [atomicAssets],
      })) as bigint;

      if (previewShares === 0n) {
        return "Error: previewDeposit returned 0 shares. Wait and retry rather than depositing.";
      }

      const approvalResult = await approveSapienIfNeeded(wallet, owner, atomicAssets);
      if (approvalResult.startsWith("Error")) {
        return `Error approving Sapien Vault as spender: ${approvalResult}`;
      }

      const data = encodeFunctionData({
        abi: SAPIEN_VAULT_ABI,
        functionName: "deposit",
        args: [atomicAssets, receiver],
      });

      const txHash = await wallet.sendTransaction({
        to: SAPIEN_VAULT_ADDRESS as Hex,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return (
        `Deposited ${args.assets} SAPIEN to Sapien Vault ${SAPIEN_VAULT_ADDRESS} ` +
        `for ${receiver} with transaction hash: ${txHash}\n` +
        `Transaction receipt: ${JSON.stringify(receipt)}\n` +
        `App: ${SAPIEN_VAULT_APP_URL}`
      );
    } catch (error) {
      return `Error depositing to Sapien Vault: ${error}`;
    }
  }

  /**
   * Withdraws SAPIEN from the Sapien Vault by asset amount (ERC-4626 withdraw).
   *
   * @param wallet - The wallet instance to execute the transaction.
   * @param args - The input arguments for the action.
   * @returns A success message with transaction details or an error message.
   */
  @CreateAction({
    name: "withdraw",
    description: `
This tool withdraws SAPIEN from the Sapien Vault on Base mainnet by asset amount (ERC-4626 withdraw).

It takes:
- assets: The amount of SAPIEN to withdraw in whole units (e.g. "1", "0.5")
- receiver: Optional address to receive SAPIEN. Defaults to the connected wallet.

Use withdraw when the user specifies an amount of SAPIEN. Use redeem when they specify vSAPIEN shares.

Important notes:
- Only Base mainnet is supported.
- Withdrawals are limited by maxWithdraw (matured, unlocked shares). Fresh deposits may still be aging, and locked validator stake cannot be withdrawn until the engine unlocks it.
- App: ${SAPIEN_VAULT_APP_URL}
`,
    schema: SapienVaultWithdrawSchema,
  })
  async withdraw(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SapienVaultWithdrawSchema>,
  ): Promise<string> {
    const networkError = sapienVaultNetworkError(wallet);
    if (networkError) {
      return networkError;
    }

    const assets = new Decimal(args.assets);
    if (assets.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Assets amount must be greater than 0";
    }

    try {
      const owner = wallet.getAddress() as Address;
      const receiver = (args.receiver ?? owner) as Address;
      const decimals = await readSapienTokenDecimals(wallet);
      const atomicAssets = parseUnits(args.assets, decimals);

      const maxWithdraw = (await wallet.readContract({
        address: SAPIEN_VAULT_ADDRESS as Hex,
        abi: SAPIEN_VAULT_ABI,
        functionName: "maxWithdraw",
        args: [owner],
      })) as bigint;

      if (atomicAssets > maxWithdraw) {
        return (
          `Error: Withdraw of ${args.assets} SAPIEN exceeds maxWithdraw ` +
          `(${formatUnits(maxWithdraw, decimals)} SAPIEN). ` +
          `Shares may still be aging (minDepositAge) or locked as validator stake.`
        );
      }

      const data = encodeFunctionData({
        abi: SAPIEN_VAULT_ABI,
        functionName: "withdraw",
        args: [atomicAssets, receiver, owner],
      });

      const txHash = await wallet.sendTransaction({
        to: SAPIEN_VAULT_ADDRESS as Hex,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return (
        `Withdrawn ${args.assets} SAPIEN from Sapien Vault ${SAPIEN_VAULT_ADDRESS} ` +
        `to ${receiver} with transaction hash: ${txHash}\n` +
        `Transaction receipt: ${JSON.stringify(receipt)}\n` +
        `App: ${SAPIEN_VAULT_APP_URL}`
      );
    } catch (error) {
      return `Error withdrawing from Sapien Vault: ${error}`;
    }
  }

  /**
   * Redeems vSAPIEN shares from the Sapien Vault (ERC-4626 redeem).
   *
   * @param wallet - The wallet instance to execute the transaction.
   * @param args - The input arguments for the action.
   * @returns A success message with transaction details or an error message.
   */
  @CreateAction({
    name: "redeem",
    description: `
This tool redeems vSAPIEN shares from the Sapien Vault on Base mainnet (ERC-4626 redeem) for SAPIEN.

It takes:
- shares: The amount of vSAPIEN to redeem in whole units (e.g. "1", "0.5")
- receiver: Optional address to receive SAPIEN. Defaults to the connected wallet.

Use redeem when the user specifies an amount of vSAPIEN shares. Use withdraw when they specify SAPIEN assets.

Important notes:
- Only Base mainnet is supported.
- vSAPIEN uses the vault's share decimals (underlying decimals plus an internal offset). Pass whole share units; do not convert.
- Redemptions are limited by maxRedeem (matured, unlocked shares).
- App: ${SAPIEN_VAULT_APP_URL}
`,
    schema: SapienVaultRedeemSchema,
  })
  async redeem(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SapienVaultRedeemSchema>,
  ): Promise<string> {
    const networkError = sapienVaultNetworkError(wallet);
    if (networkError) {
      return networkError;
    }

    const shares = new Decimal(args.shares);
    if (shares.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Shares amount must be greater than 0";
    }

    try {
      const owner = wallet.getAddress() as Address;
      const receiver = (args.receiver ?? owner) as Address;
      const shareDecimals = await readSapienShareDecimals(wallet);
      const atomicShares = parseUnits(args.shares, shareDecimals);

      const maxRedeem = (await wallet.readContract({
        address: SAPIEN_VAULT_ADDRESS as Hex,
        abi: SAPIEN_VAULT_ABI,
        functionName: "maxRedeem",
        args: [owner],
      })) as bigint;

      if (atomicShares > maxRedeem) {
        return (
          `Error: Redeem of ${args.shares} vSAPIEN exceeds maxRedeem ` +
          `(${formatUnits(maxRedeem, shareDecimals)} vSAPIEN). ` +
          `Shares may still be aging (minDepositAge) or locked as validator stake.`
        );
      }

      const data = encodeFunctionData({
        abi: SAPIEN_VAULT_ABI,
        functionName: "redeem",
        args: [atomicShares, receiver, owner],
      });

      const txHash = await wallet.sendTransaction({
        to: SAPIEN_VAULT_ADDRESS as Hex,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return (
        `Redeemed ${args.shares} vSAPIEN from Sapien Vault ${SAPIEN_VAULT_ADDRESS} ` +
        `to ${receiver} with transaction hash: ${txHash}\n` +
        `Transaction receipt: ${JSON.stringify(receipt)}\n` +
        `App: ${SAPIEN_VAULT_APP_URL}`
      );
    } catch (error) {
      return `Error redeeming from Sapien Vault: ${error}`;
    }
  }

  /**
   * Transfers vSAPIEN shares to a destination address.
   *
   * @param wallet - The wallet instance to execute the transaction.
   * @param args - Destination and whole-unit share amount.
   * @returns A success message with transaction details or an error message.
   */
  @CreateAction({
    name: "transfer",
    description: `
This tool transfers vSAPIEN shares from the connected wallet to a destination address on Base mainnet (ERC-20 transfer on the vault share token).

It takes:
- destination: The address that will receive the vSAPIEN shares
- shares: The amount of vSAPIEN to transfer in whole units (e.g. "1", "0.5")

Important notes:
- Only Base mainnet is supported.
- Only matured, unlocked shares can be transferred. Fresh deposits are blocked until minDepositAge elapses, and locked validator stake cannot be transferred.
- Do not use this to deposit or withdraw SAPIEN; use deposit / withdraw / redeem for those.
- App: ${SAPIEN_VAULT_APP_URL}
`,
    schema: SapienVaultTransferSchema,
  })
  async transfer(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SapienVaultTransferSchema>,
  ): Promise<string> {
    const networkError = sapienVaultNetworkError(wallet);
    if (networkError) {
      return networkError;
    }

    const shares = new Decimal(args.shares);
    if (shares.comparedTo(new Decimal(0.0)) != 1) {
      return "Error: Shares amount must be greater than 0";
    }

    const destination = args.destination as Address;
    if (destination.toLowerCase() === SAPIEN_VAULT_ADDRESS.toLowerCase()) {
      return "Error: Do not transfer vSAPIEN to the vault contract. Use deposit / withdraw / redeem.";
    }

    try {
      const owner = wallet.getAddress() as Address;
      const shareDecimals = await readSapienShareDecimals(wallet);
      const atomicShares = parseUnits(args.shares, shareDecimals);

      const [matured, available, stake, tokenDecimals] = await Promise.all([
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "maturedShares",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "availableBalance",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "getStakeAccount",
          args: [owner],
        }),
        readSapienTokenDecimals(wallet),
      ]);

      if (atomicShares > matured) {
        return (
          `Error: Transfer of ${args.shares} vSAPIEN exceeds matured shares ` +
          `(${formatUnits(matured, shareDecimals)} vSAPIEN). ` +
          `Pending (aging) shares cannot be transferred until minDepositAge elapses.`
        );
      }

      const assetsToSend = (await wallet.readContract({
        address: SAPIEN_VAULT_ADDRESS as Hex,
        abi: SAPIEN_VAULT_ABI,
        functionName: "convertToAssets",
        args: [atomicShares],
      })) as bigint;

      if (assetsToSend > available) {
        const lockedAmount = parseLockedAmount(stake);
        return (
          `Error: Transfer of ${args.shares} vSAPIEN exceeds available (matured, unlocked) balance ` +
          `(${formatUnits(available, tokenDecimals)} SAPIEN). ` +
          `Locked stake: ${formatUnits(lockedAmount, tokenDecimals)} SAPIEN.`
        );
      }

      const data = encodeFunctionData({
        abi: SAPIEN_VAULT_ABI,
        functionName: "transfer",
        args: [destination, atomicShares],
      });

      const txHash = await wallet.sendTransaction({
        to: SAPIEN_VAULT_ADDRESS as Hex,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return (
        `Transferred ${args.shares} vSAPIEN from Sapien Vault ${SAPIEN_VAULT_ADDRESS} ` +
        `to ${destination} with transaction hash: ${txHash}\n` +
        `Transaction receipt: ${JSON.stringify(receipt)}\n` +
        `App: ${SAPIEN_VAULT_APP_URL}`
      );
    } catch (error) {
      return `Error transferring vSAPIEN: ${error}`;
    }
  }

  /**
   * Reads a user's Sapien Vault shares, assets, and tranche / age state.
   *
   * @param wallet - The wallet instance used for contract reads.
   * @param args - Optional address to inspect. Defaults to the connected wallet.
   * @returns Share, asset, matured/pending/locked balances, or an error message.
   */
  @CreateAction({
    name: "get_position",
    description: `
This tool reads a Sapien Vault position on Base mainnet: vSAPIEN shares, SAPIEN asset value, and tranche / age state.

It takes:
- address: Optional address to inspect. Defaults to the connected wallet.

Reports:
- total vSAPIEN shares (balanceOf) and SAPIEN assets (convertToAssets / assetsOf)
- matured shares, pending (aging) shares, minDepositAge, and seconds until the next cohort matures (depositAgeStatus)
- availableBalance (matured, unlocked, in SAPIEN) and lockedAmount from getStakeAccount
- maxWithdraw / maxRedeem

Only Base mainnet is supported. App: ${SAPIEN_VAULT_APP_URL}
`,
    schema: SapienVaultGetPositionSchema,
  })
  async getPosition(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SapienVaultGetPositionSchema>,
  ): Promise<string> {
    const networkError = sapienVaultNetworkError(wallet);
    if (networkError) {
      return networkError;
    }

    try {
      const owner = (args.address ?? wallet.getAddress()) as Address;
      const [tokenDecimals, shareDecimals] = await Promise.all([
        readSapienTokenDecimals(wallet),
        readSapienShareDecimals(wallet),
      ]);

      const [
        userShares,
        userAssets,
        matured,
        pending,
        available,
        stake,
        ageStatus,
        maxWithdraw,
        maxRedeem,
      ] = await Promise.all([
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "balanceOf",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "assetsOf",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "maturedShares",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "pendingShares",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "availableBalance",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "getStakeAccount",
          args: [owner],
        }),
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "depositAgeStatus",
          args: [owner],
        }),
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "maxWithdraw",
          args: [owner],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "maxRedeem",
          args: [owner],
        }) as Promise<bigint>,
      ]);

      const lockedAmount = parseLockedAmount(stake);
      const { minAge, nextMaturityRemaining } = parseDepositAgeStatus(ageStatus);

      return [
        `Sapien Vault position for ${owner} on Base mainnet:`,
        `- vSAPIEN shares: ${formatUnits(userShares, shareDecimals)} (${userShares} atomic)`,
        `- SAPIEN assets: ${formatUnits(userAssets, tokenDecimals)} (${userAssets} atomic)`,
        `- matured shares: ${formatUnits(matured, shareDecimals)} vSAPIEN`,
        `- pending shares (aging): ${formatUnits(pending, shareDecimals)} vSAPIEN`,
        `- available balance: ${formatUnits(available, tokenDecimals)} SAPIEN`,
        `- locked stake: ${formatUnits(lockedAmount, tokenDecimals)} SAPIEN`,
        `- minDepositAge: ${minAge.toString()} seconds`,
        `- next maturity remaining: ${nextMaturityRemaining.toString()} seconds`,
        `- maxWithdraw: ${formatUnits(maxWithdraw, tokenDecimals)} SAPIEN`,
        `- maxRedeem: ${formatUnits(maxRedeem, shareDecimals)} vSAPIEN`,
        `Vault: ${SAPIEN_VAULT_ADDRESS}`,
        `Underlying SAPIEN: ${SAPIEN_TOKEN_ADDRESS}`,
        `App: ${SAPIEN_VAULT_APP_URL}`,
      ].join("\n");
    } catch (error) {
      return `Error reading Sapien Vault position: ${error}`;
    }
  }

  /**
   * Reads vault-wide totalAssets and total shares (totalSupply).
   *
   * @param wallet - The wallet instance used for contract reads.
   * @param _args - Unused; the schema is empty.
   * @returns Vault totals, or an error message.
   */
  @CreateAction({
    name: "get_vault_totals",
    description: `
This tool reads Sapien Vault totals on Base mainnet.

It returns:
- totalAssets: SAPIEN held by the vault (ERC-4626 totalAssets)
- total shares: outstanding vSAPIEN (ERC-20 totalSupply on the vault)

No inputs are required. Only Base mainnet is supported. App: ${SAPIEN_VAULT_APP_URL}
`,
    schema: SapienVaultGetVaultTotalsSchema,
  })
  async getVaultTotals(
    wallet: EvmWalletProvider,
    _args: z.infer<typeof SapienVaultGetVaultTotalsSchema>,
  ): Promise<string> {
    const networkError = sapienVaultNetworkError(wallet);
    if (networkError) {
      return networkError;
    }

    try {
      const [tokenDecimals, shareDecimals, totalAssets, totalShares] = await Promise.all([
        readSapienTokenDecimals(wallet),
        readSapienShareDecimals(wallet),
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "totalAssets",
          args: [],
        }) as Promise<bigint>,
        wallet.readContract({
          address: SAPIEN_VAULT_ADDRESS as Hex,
          abi: SAPIEN_VAULT_ABI,
          functionName: "totalSupply",
          args: [],
        }) as Promise<bigint>,
      ]);

      return [
        `Sapien Vault totals on Base mainnet:`,
        `- totalAssets: ${formatUnits(totalAssets, tokenDecimals)} SAPIEN (${totalAssets} atomic)`,
        `- total shares (totalSupply): ${formatUnits(totalShares, shareDecimals)} vSAPIEN (${totalShares} atomic)`,
        `Vault: ${SAPIEN_VAULT_ADDRESS}`,
        `App: ${SAPIEN_VAULT_APP_URL}`,
      ].join("\n");
    } catch (error) {
      return `Error reading Sapien Vault totals: ${error}`;
    }
  }

  /**
   * Checks if the Sapien Vault action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True only for Base mainnet.
   */
  supportsNetwork = (network: Network) => isSapienVaultNetwork(network);
}

/**
 * Creates a new SapienVaultActionProvider instance.
 *
 * @returns A new SapienVaultActionProvider instance.
 */
export const sapienVaultActionProvider = () => new SapienVaultActionProvider();
