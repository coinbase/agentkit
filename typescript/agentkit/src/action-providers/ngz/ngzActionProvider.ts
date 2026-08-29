import { z } from "zod";
import { parseEther, createPublicClient, http, encodeFunctionData } from "viem";
import { base, baseSepolia } from "viem/chains";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network, WalletProvider } from "../../network";
import {
  GetNGZLeaderboardSchema,
  GetNGZUserSchema,
  GetNGZWallOfShameSchema,
  CheckInNGZSchema,
  TipNGZUserSchema,
} from "./schemas";

const NGZ_CONTRACT_ADDRESS = "0x4D1b5da45a5D278900aedfc6c96F0EE0D4e28bF6" as const;

const NGZ_ABI = [
  {
    name: "getLeaderboard",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "limit", type: "uint256" }],
    outputs: [
      { name: "addrs", type: "address[]" },
      {
        name: "userData",
        type: "tuple[]",
        components: [
          { name: "username", type: "string" },
          { name: "habitName", type: "string" },
          { name: "category", type: "uint8" },
          { name: "currentStreak", type: "uint256" },
          { name: "longestStreak", type: "uint256" },
          { name: "lastCheckIn", type: "uint256" },
          { name: "startedAt", type: "uint256" },
          { name: "totalCheckIns", type: "uint256" },
          { name: "totalRelapses", type: "uint256" },
          { name: "totalTipsReceived", type: "uint256" },
          { name: "registered", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getUser",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "username", type: "string" },
          { name: "habitName", type: "string" },
          { name: "category", type: "uint8" },
          { name: "currentStreak", type: "uint256" },
          { name: "longestStreak", type: "uint256" },
          { name: "lastCheckIn", type: "uint256" },
          { name: "startedAt", type: "uint256" },
          { name: "totalCheckIns", type: "uint256" },
          { name: "totalRelapses", type: "uint256" },
          { name: "totalTipsReceived", type: "uint256" },
          { name: "registered", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getRelapseWall",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "user", type: "address" },
          { name: "username", type: "string" },
          { name: "habitName", type: "string" },
          { name: "streakLost", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "message", type: "string" },
        ],
      },
    ],
  },
  {
    name: "checkIn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "tip",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "message", type: "string" },
    ],
    outputs: [],
  },
] as const;

/**
 * Returns a viem public client configured for the given network.
 *
 * @param networkId - The network ID (e.g. "base-mainnet" or "base-sepolia").
 * @returns A viem PublicClient.
 */
function getClient(networkId: string) {
  const chain = networkId === "base-mainnet" ? base : baseSepolia;
  return createPublicClient({ chain, transport: http() });
}

/**
 * NGZActionProvider provides actions for interacting with No-Going-Zone (NGZ),
 * an onchain habit accountability tracker deployed on Base.
 *
 * NGZ lets users declare habits, check in daily to build streaks, earn soulbound
 * milestone NFTs, and face permanent onchain consequences (Wall of Shame NFTs) if
 * they relapse. All data lives onchain on Base — no backend, no database.
 *
 * Read-only actions (no wallet required):
 * - get_ngz_leaderboard: Fetch top streak holders
 * - get_ngz_user: Look up a user's stats by address
 * - get_ngz_wall_of_shame: Fetch recent relapse events
 *
 * Write actions (wallet required):
 * - check_in_ngz: Record today's check-in to maintain your streak
 * - tip_ngz_user: Send ETH respect directly to another user's wallet
 *
 * Contract: ${NGZ_CONTRACT_ADDRESS} (Base Sepolia testnet)
 * Frontend: https://frontend-one-khaki-22.vercel.app
 */
export class NGZActionProvider extends ActionProvider<WalletProvider> {
  /**
   * Constructs a new NGZActionProvider.
   */
  constructor() {
    super("ngz", []);
  }

  /**
   * Fetches the top streak holders from the NGZ leaderboard.
   *
   * @param args - The arguments for the action.
   * @returns Ranked leaderboard as stringified JSON.
   */
  @CreateAction({
    name: "get_ngz_leaderboard",
    description: `Fetches the top streak holders from No-Going-Zone (NGZ), an onchain habit accountability tracker on Base.

Returns a ranked list of users with their current streak, habit name, longest streak, and total check-ins.
Use this to find who is leading the leaderboard, check on a specific rank, or get an overview of NGZ activity.

Example response fields per user:
- rank: position on the leaderboard (1 = top)
- username: the user's NGZ handle
- habitName: the habit they are tracking (e.g. "No Pornography", "No Smoking")
- currentStreak: days clean right now
- longestStreak: their all-time best streak in days
- totalCheckIns: total number of times they have checked in
- address: their wallet address`,
    schema: GetNGZLeaderboardSchema,
  })
  async getLeaderboard(args: z.infer<typeof GetNGZLeaderboardSchema>): Promise<string> {
    try {
      const client = getClient("base-sepolia");
      const [addrs, userData] = await client.readContract({
        address: NGZ_CONTRACT_ADDRESS,
        abi: NGZ_ABI,
        functionName: "getLeaderboard",
        args: [BigInt(args.limit)],
      });

      if (!addrs || addrs.length === 0) {
        return JSON.stringify({ success: true, count: 0, leaderboard: [] });
      }

      const leaderboard = addrs.map((addr, i) => ({
        rank: i + 1,
        address: addr,
        username: userData[i].username,
        habitName: userData[i].habitName,
        currentStreak: Number(userData[i].currentStreak),
        longestStreak: Number(userData[i].longestStreak),
        totalCheckIns: Number(userData[i].totalCheckIns),
        totalRelapses: Number(userData[i].totalRelapses),
      }));

      return JSON.stringify({ success: true, count: leaderboard.length, leaderboard });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Fetches the onchain stats of an NGZ user by wallet address.
   *
   * @param args - The arguments for the action.
   * @returns User stats as stringified JSON.
   */
  @CreateAction({
    name: "get_ngz_user",
    description: `Fetches the onchain stats of a specific No-Going-Zone (NGZ) user by their wallet address.

Returns the user's full profile including current streak, longest streak, habit name, total check-ins, total relapses, and tips received.
Use this to look up a specific user's accountability record.

Example response fields:
- username: the user's NGZ handle
- habitName: the habit they are tracking
- currentStreak: days clean right now
- longestStreak: their all-time best streak in days
- totalCheckIns: total number of check-ins
- totalRelapses: number of times they have relapsed
- totalTipsReceived: total ETH received as tips (in wei)
- registered: whether this address has an NGZ account`,
    schema: GetNGZUserSchema,
  })
  async getUser(args: z.infer<typeof GetNGZUserSchema>): Promise<string> {
    try {
      const client = getClient("base-sepolia");
      const user = await client.readContract({
        address: NGZ_CONTRACT_ADDRESS,
        abi: NGZ_ABI,
        functionName: "getUser",
        args: [args.address as `0x${string}`],
      });

      if (!user.registered) {
        return JSON.stringify({ success: true, registered: false, address: args.address });
      }

      return JSON.stringify({
        success: true,
        registered: true,
        address: args.address,
        username: user.username,
        habitName: user.habitName,
        currentStreak: Number(user.currentStreak),
        longestStreak: Number(user.longestStreak),
        totalCheckIns: Number(user.totalCheckIns),
        totalRelapses: Number(user.totalRelapses),
        totalTipsReceived: user.totalTipsReceived.toString(),
        lastCheckIn: Number(user.lastCheckIn),
        startedAt: Number(user.startedAt),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Fetches recent relapse events from the NGZ Wall of Shame.
   *
   * @param args - The arguments for the action.
   * @returns Relapse events as stringified JSON.
   */
  @CreateAction({
    name: "get_ngz_wall_of_shame",
    description: `Fetches recent relapse events from the No-Going-Zone (NGZ) Wall of Shame.

The Wall of Shame is a permanent onchain record of every relapse. When a user relapses, their streak resets to zero
and a soulbound shame NFT is minted to their wallet — both cannot be deleted or reversed.

Returns a list of relapse events ordered by most recent first.

Example response fields per entry:
- username: the user who relapsed
- habitName: the habit they were tracking
- streakLost: the number of days they lost when they relapsed
- timestamp: Unix timestamp of when the relapse was recorded
- message: an optional message the user wrote when they relapsed (public, stored onchain)
- userAddress: the wallet address of the user`,
    schema: GetNGZWallOfShameSchema,
  })
  async getWallOfShame(args: z.infer<typeof GetNGZWallOfShameSchema>): Promise<string> {
    try {
      const client = getClient("base-sepolia");
      const relapses = await client.readContract({
        address: NGZ_CONTRACT_ADDRESS,
        abi: NGZ_ABI,
        functionName: "getRelapseWall",
        args: [BigInt(args.offset), BigInt(args.limit)],
      });

      if (!relapses || relapses.length === 0) {
        return JSON.stringify({ success: true, count: 0, relapses: [] });
      }

      const wall = relapses.map(r => ({
        userAddress: r.user,
        username: r.username,
        habitName: r.habitName,
        streakLost: Number(r.streakLost),
        timestamp: Number(r.timestamp),
        message: r.message,
      }));

      return JSON.stringify({ success: true, count: wall.length, relapses: wall });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Records today's daily check-in for the connected wallet on NGZ.
   *
   * @param _args - Unused (no inputs required).
   * @param walletProvider - The wallet provider to send the transaction.
   * @returns Transaction result as stringified JSON.
   */
  @CreateAction({
    name: "check_in_ngz",
    description: `Records today's check-in for the connected wallet on No-Going-Zone (NGZ).

A check-in is only valid once every 20 hours. Missing too many check-ins will reset your streak.
This action sends a transaction to the NGZ contract on Base Sepolia and returns the transaction hash on success.

Use this to help a user maintain their onchain accountability streak.
The user must already be registered on NGZ before checking in.`,
    schema: CheckInNGZSchema,
  })
  async checkIn(
    _args: z.infer<typeof CheckInNGZSchema>,
    walletProvider: WalletProvider,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({ abi: NGZ_ABI, functionName: "checkIn", args: [] });
      const txHash = await walletProvider.sendTransaction({
        to: NGZ_CONTRACT_ADDRESS,
        data,
      });

      return JSON.stringify({
        success: true,
        message: "Check-in recorded successfully. Your streak is growing.",
        transactionHash: txHash,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Sends ETH as a tip to another NGZ user's wallet.
   *
   * @param args - The arguments for the action.
   * @param walletProvider - The wallet provider to send the transaction.
   * @returns Transaction result as stringified JSON.
   */
  @CreateAction({
    name: "tip_ngz_user",
    description: `Sends ETH as a tip directly to another NGZ user's wallet as a sign of respect for their streak.

The minimum tip is 0.0001 ETH. 100% of the tip goes directly to the recipient — NGZ takes no fee.
An optional public message can be included and will be stored permanently onchain.

This action sends a payable transaction to the NGZ contract on Base Sepolia.

Use this to reward a user for maintaining a strong streak or to encourage someone who relapsed to get back on track.`,
    schema: TipNGZUserSchema,
  })
  async tipUser(
    args: z.infer<typeof TipNGZUserSchema>,
    walletProvider: WalletProvider,
  ): Promise<string> {
    try {
      const value = parseEther(args.amountInEth);
      const data = encodeFunctionData({
        abi: NGZ_ABI,
        functionName: "tip",
        args: [args.recipientAddress as `0x${string}`, args.message],
      });

      const txHash = await walletProvider.sendTransaction({
        to: NGZ_CONTRACT_ADDRESS,
        data,
        value,
      });

      return JSON.stringify({
        success: true,
        message: `Sent ${args.amountInEth} ETH to ${args.recipientAddress} as respect.`,
        transactionHash: txHash,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}

export const ngzActionProvider = () => new NGZActionProvider();
