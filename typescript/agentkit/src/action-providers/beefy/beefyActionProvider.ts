import { z } from "zod";
import { encodeFunctionData, formatUnits, Hex, parseUnits } from "viem";
import { erc20Abi } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { Network } from "../../network";
import { BEEFY_API_BASE, BEEFY_VAULT_ABI } from "./constants";
import { BeefyDepositSchema, BeefyWithdrawSchema, CheckPositionSchema, ListVaultsSchema } from "./schemas";

const BEEFY_SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * BeefyActionProvider enables interaction with Beefy Finance vaults on Base.
 *
 * Beefy auto-compounds yield from DeFi protocols (Aerodrome, Morpho, Curve, etc.)
 * into mooToken vaults. Users deposit the "want" token and receive mooTokens
 * whose value increases as yield is compounded.
 */
export class BeefyActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("beefy", []);
  }

  @CreateAction({
    name: "deposit",
    description: `
Deposit tokens into a Beefy auto-compounding vault to earn yield.

Beefy vaults automatically harvest and compound rewards from the underlying
DeFi protocol (Aerodrome, Morpho, Curve, etc.). You deposit the "want" token
and receive mooTokens that increase in value over time.

It takes:
- vaultAddress: The Beefy vault contract address (find vaults using list_vaults)
- amount: Amount of the underlying want token to deposit, in whole units

Important:
- You must hold the vault's "want" token before depositing
- For LP vaults, the want token is the LP token (e.g., Aerodrome vAMM LP)
- For single-asset vaults (Morpho, Compound), the want token is the raw asset (WETH, USDC, etc.)
- The vault will be approved to spend your want tokens automatically
`,
    schema: BeefyDepositSchema,
  })
  async deposit(wallet: EvmWalletProvider, args: z.infer<typeof BeefyDepositSchema>): Promise<string> {
    try {
      // Get the want token address from the vault
      const wantToken = (await wallet.readContract({
        address: args.vaultAddress as Hex,
        abi: BEEFY_VAULT_ABI,
        functionName: "want",
        args: [],
      })) as `0x${string}`;

      // Get want token decimals
      const decimals = (await wallet.readContract({
        address: wantToken,
        abi: erc20Abi,
        functionName: "decimals",
        args: [],
      })) as number;

      const atomicAmount = parseUnits(args.amount, decimals);

      // Approve vault to spend want tokens
      const approvalResult = await approve(wallet, wantToken, args.vaultAddress, atomicAmount);
      if (approvalResult.startsWith("Error")) {
        return `Error approving vault: ${approvalResult}`;
      }

      // Deposit into vault
      const data = encodeFunctionData({
        abi: BEEFY_VAULT_ABI,
        functionName: "deposit",
        args: [atomicAmount],
      });

      const txHash = await wallet.sendTransaction({
        to: args.vaultAddress as `0x${string}`,
        data,
      });

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Successfully deposited ${args.amount} tokens into Beefy vault ${args.vaultAddress}.\nWant token: ${wantToken}\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error depositing into Beefy vault: ${error}`;
    }
  }

  @CreateAction({
    name: "withdraw",
    description: `
Withdraw tokens from a Beefy vault back to the underlying want token.

If no amount is specified, withdraws the entire position (withdrawAll).
If an amount is specified, withdraws that many mooTokens (vault shares).

It takes:
- vaultAddress: The Beefy vault contract address
- amount: (Optional) Amount of mooTokens to withdraw. Leave empty to withdraw all.
`,
    schema: BeefyWithdrawSchema,
  })
  async withdraw(wallet: EvmWalletProvider, args: z.infer<typeof BeefyWithdrawSchema>): Promise<string> {
    try {
      let txHash: `0x${string}`;

      if (!args.amount) {
        // Withdraw all
        const data = encodeFunctionData({
          abi: BEEFY_VAULT_ABI,
          functionName: "withdrawAll",
          args: [],
        });

        txHash = await wallet.sendTransaction({
          to: args.vaultAddress as `0x${string}`,
          data,
        });
      } else {
        // Withdraw specific amount of shares
        const atomicAmount = parseUnits(args.amount, 18);

        const data = encodeFunctionData({
          abi: BEEFY_VAULT_ABI,
          functionName: "withdraw",
          args: [atomicAmount],
        });

        txHash = await wallet.sendTransaction({
          to: args.vaultAddress as `0x${string}`,
          data,
        });
      }

      const receipt = await wallet.waitForTransactionReceipt(txHash);

      return `Successfully withdrew from Beefy vault ${args.vaultAddress}.\nTransaction: ${txHash}\nReceipt: ${JSON.stringify(receipt)}`;
    } catch (error) {
      return `Error withdrawing from Beefy vault: ${error}`;
    }
  }

  @CreateAction({
    name: "check_position",
    description: `
Check your position in a Beefy vault — shows your mooToken balance,
the current price per share, and estimated underlying token value.

It takes:
- vaultAddress: The Beefy vault contract address to check
`,
    schema: CheckPositionSchema,
  })
  async checkPosition(
    wallet: EvmWalletProvider,
    args: z.infer<typeof CheckPositionSchema>,
  ): Promise<string> {
    try {
      const userAddress = await wallet.getAddress();

      const [mooBalance, pricePerShare, vaultSymbol] = await Promise.all([
        wallet.readContract({
          address: args.vaultAddress as Hex,
          abi: BEEFY_VAULT_ABI,
          functionName: "balanceOf",
          args: [userAddress as `0x${string}`],
        }) as Promise<bigint>,
        wallet.readContract({
          address: args.vaultAddress as Hex,
          abi: BEEFY_VAULT_ABI,
          functionName: "getPricePerFullShare",
          args: [],
        }) as Promise<bigint>,
        wallet.readContract({
          address: args.vaultAddress as Hex,
          abi: BEEFY_VAULT_ABI,
          functionName: "symbol",
          args: [],
        }) as Promise<string>,
      ]);

      const underlyingValue = (mooBalance * pricePerShare) / BigInt(1e18);
      const mooFormatted = formatUnits(mooBalance, 18);
      const underlyingFormatted = formatUnits(underlyingValue, 18);
      const ppfsFormatted = formatUnits(pricePerShare, 18);

      return `Beefy Vault Position:\nVault: ${args.vaultAddress}\nToken: ${vaultSymbol}\nShares: ${mooFormatted}\nPrice per share: ${ppfsFormatted}\nUnderlying value: ~${underlyingFormatted} want tokens`;
    } catch (error) {
      return `Error checking Beefy position: ${error}`;
    }
  }

  @CreateAction({
    name: "list_vaults",
    description: `
List active Beefy vaults on Base with their APYs and TVL.

Returns the top vaults sorted by TVL, including vault address, underlying
assets, APY, and TVL.

It takes:
- platform: (Optional) Filter by platform — 'aerodrome', 'morpho', 'curve',
  'compound', 'pancakeswap', etc. Leave empty for all platforms.
`,
    schema: ListVaultsSchema,
  })
  async listVaults(
    wallet: EvmWalletProvider,
    args: z.infer<typeof ListVaultsSchema>,
  ): Promise<string> {
    try {
      const [vaultsRes, apyRes, tvlRes] = await Promise.all([
        fetch(`${BEEFY_API_BASE}/vaults`),
        fetch(`${BEEFY_API_BASE}/apy`),
        fetch(`${BEEFY_API_BASE}/tvl`),
      ]);

      if (!vaultsRes.ok || !apyRes.ok || !tvlRes.ok) {
        throw new Error("Failed to fetch Beefy API data");
      }

      const vaults = (await vaultsRes.json()) as Array<{
        id: string;
        chain: string;
        status: string;
        earnContractAddress: string;
        tokenAddress: string;
        earnedToken: string;
        platformId: string;
        assets: string[];
      }>;
      const apys = (await apyRes.json()) as Record<string, number>;
      const tvls = (await tvlRes.json()) as Record<string, Record<string, number>>;

      let baseVaults = vaults.filter((v) => v.chain === "base" && v.status === "active");

      if (args.platform) {
        baseVaults = baseVaults.filter(
          (v) => v.platformId?.toLowerCase() === args.platform!.toLowerCase(),
        );
      }

      // Sort by TVL descending
      const sorted = baseVaults
        .map((v) => ({
          ...v,
          apy: apys[v.id] || 0,
          tvl: tvls[v.id]?.[v.earnContractAddress] || tvls[v.id] || 0,
        }))
        .sort((a, b) => {
          const tvlA = typeof a.tvl === "number" ? a.tvl : 0;
          const tvlB = typeof b.tvl === "number" ? b.tvl : 0;
          return tvlB - tvlA;
        })
        .slice(0, 20);

      if (sorted.length === 0) {
        return `No active Beefy vaults found on Base${args.platform ? ` for platform "${args.platform}"` : ""}.`;
      }

      const lines = sorted.map((v) => {
        const apyStr = v.apy ? `${(v.apy * 100).toFixed(2)}%` : "N/A";
        const tvlNum = typeof v.tvl === "number" ? v.tvl : 0;
        const tvlStr = tvlNum > 0 ? `$${(tvlNum / 1e6).toFixed(2)}M` : "N/A";
        const assets = v.assets?.join("-") || v.id;
        return `- ${assets} (${v.platformId}) | Vault: ${v.earnContractAddress} | APY: ${apyStr} | TVL: ${tvlStr}`;
      });

      return `Active Beefy Vaults on Base (top ${sorted.length}):\n\n${lines.join("\n")}`;
    } catch (error) {
      return `Error listing Beefy vaults: ${error}`;
    }
  }

  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && BEEFY_SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const beefyActionProvider = () => new BeefyActionProvider();
