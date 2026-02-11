import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { encodeFunctionData, Hex } from "viem";
import {
  RegisterAgentSchema,
  GetAgentSchema,
  GetAgentByAddressSchema,
  MutateAgentSchema,
  AddTraitSchema,
  ResolveNameSchema,
  CheckNameSchema,
  GetStatsSchema,
} from "./schemas";
import {
  AGENTDNA_CONTRACT,
  AGENTNAMES_CONTRACT,
  AGENTDNA_ABI,
  AGENTNAMES_ABI,
  NO_PARENT,
} from "./constants";

/**
 * HelixaActionProvider provides actions for Helixa AgentDNA — the onchain identity
 * and reputation protocol for AI agents on Base (ERC-8004).
 *
 * Actions:
 * - register_agent: Mint an onchain identity NFT for an AI agent
 * - get_agent: Look up an agent by token ID
 * - get_agent_by_address: Look up an agent by wallet address
 * - mutate_agent: Record a version change
 * - add_trait: Add a personality trait or skill
 * - resolve_name: Resolve a .agent name to an address
 * - check_name: Check .agent name availability
 * - get_helixa_stats: Get protocol statistics
 *
 * @see https://helixa.xyz
 * @see https://basescan.org/address/0x665971e7bf8ec90c3066162c5b396604b3cd7711
 */
export class HelixaActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the HelixaActionProvider class.
   */
  constructor() {
    super("helixa", []);
  }

  /**
   * Register a new AI agent on Helixa AgentDNA.
   *
   * Mints an ERC-8004 compliant identity NFT on Base with:
   * - Agent name and framework
   * - Soulbound option (non-transferable)
   * - Optional .agent name
   * - Points toward future token allocation (2x for first 100 agents)
   *
   * Pricing: Free (0-100 agents) → 0.005 ETH (101-500) → 0.01 ETH (501-1000) → 0.02 ETH (1001+)
   *
   * @param walletProvider - The wallet provider to mint from.
   * @param args - The registration arguments.
   * @returns A message with mint details.
   */
  @CreateAction({
    name: "register_agent",
    description: `
Register a new AI agent on Helixa AgentDNA — the onchain identity protocol for AI agents on Base.

This mints an ERC-8004 compliant identity NFT that includes:
- Agent name and framework
- Soulbound option (non-transferable, recommended for production agents)
- Optional .agent name (e.g. 'mybot' becomes mybot.agent)
- Points toward future token allocation (2x for first 100 agents)

Pricing: Free for first 100 agents, then 0.005 ETH (101-500), 0.01 ETH (501-1000), 0.02 ETH (1001+).

IMPORTANT: Do NOT call totalSupply() or paused() on this contract — they will revert. Use totalAgents() instead.
`,
    schema: RegisterAgentSchema,
  })
  async registerAgent(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RegisterAgentSchema>,
  ): Promise<string> {
    try {
      // Check current mint price
      const priceData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mintPrice",
      });

      const priceResult = await walletProvider.readContract(AGENTDNA_CONTRACT, priceData);
      const mintPrice = BigInt(priceResult as string);
      const agentAddress = await walletProvider.getAddress();

      // Mint the agent identity
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mint",
        args: [
          agentAddress as Hex,
          args.name,
          args.framework,
          args.tokenURI || "",
          args.soulbound,
          BigInt(NO_PARENT),
        ],
      });

      const hash = await walletProvider.sendTransaction({
        to: AGENTDNA_CONTRACT as `0x${string}`,
        data,
        value: mintPrice,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      // Register .agent name if requested
      if (args.agentName) {
        try {
          const nameData = encodeFunctionData({
            abi: AGENTNAMES_ABI,
            functionName: "register",
            args: [args.agentName],
          });

          const nameHash = await walletProvider.sendTransaction({
            to: AGENTNAMES_CONTRACT as `0x${string}`,
            data: nameData,
          });

          await walletProvider.waitForTransactionReceipt(nameHash);
        } catch (nameError) {
          return `Agent registered successfully (TX: https://basescan.org/tx/${hash}) but .agent name registration failed: ${nameError}`;
        }
      }

      let msg = `Successfully registered agent "${args.name}" on Helixa AgentDNA.\n`;
      msg += `TX: https://basescan.org/tx/${hash}\n`;
      msg += `Contract: ${AGENTDNA_CONTRACT}\n`;
      msg += `Framework: ${args.framework}\n`;
      msg += `Soulbound: ${args.soulbound}\n`;
      if (mintPrice > 0n) {
        msg += `Fee: ${Number(mintPrice) / 1e18} ETH\n`;
      } else {
        msg += `Fee: Free (beta)\n`;
      }
      if (args.agentName) {
        msg += `Name: ${args.agentName}.agent\n`;
      }
      msg += `View: https://helixa.xyz/directory.html`;
      return msg;
    } catch (error) {
      return `Error registering agent: ${error}`;
    }
  }

  /**
   * Look up an agent by token ID.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The lookup arguments.
   * @returns Agent details.
   */
  @CreateAction({
    name: "get_agent",
    description: `
Look up an AI agent's onchain identity on Helixa AgentDNA by token ID.
Returns name, framework, mint date, verification status, soulbound status, generation, version, mutation count, and points.
`,
    schema: GetAgentSchema,
  })
  async getAgent(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "getAgent",
        args: [BigInt(args.tokenId)],
      });

      const result = await walletProvider.readContract(AGENTDNA_CONTRACT, data);

      const pointsData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "getPoints",
        args: [BigInt(args.tokenId)],
      });

      const points = await walletProvider.readContract(AGENTDNA_CONTRACT, pointsData);

      return `Agent #${args.tokenId}:\n${JSON.stringify(result, null, 2)}\nPoints: ${points}`;
    } catch (error) {
      return `Error looking up agent #${args.tokenId}: ${error}`;
    }
  }

  /**
   * Look up an agent by wallet address.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The lookup arguments.
   * @returns Token ID for the address.
   */
  @CreateAction({
    name: "get_agent_by_address",
    description: `Look up an AI agent's onchain identity by wallet address. Returns the token ID associated with that address.`,
    schema: GetAgentByAddressSchema,
  })
  async getAgentByAddress(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentByAddressSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "addressToTokenId",
        args: [args.agentAddress as Hex],
      });

      const tokenId = await walletProvider.readContract(AGENTDNA_CONTRACT, data);

      if (tokenId === "0" || tokenId === 0n) {
        return `No Helixa identity found for address ${args.agentAddress}. Register at https://helixa.xyz/mint.html`;
      }

      return `Address ${args.agentAddress} is registered as Agent #${tokenId}`;
    } catch (error) {
      return `Error looking up address: ${error}`;
    }
  }

  /**
   * Mutate (version update) an agent.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The mutation arguments.
   * @returns Mutation confirmation.
   */
  @CreateAction({
    name: "mutate_agent",
    description: `
Record a version change (mutation) for an AI agent on Helixa. Tracks the agent's evolution over time.
Only the agent's owner can mutate. Awards 50 mutation points.
`,
    schema: MutateAgentSchema,
  })
  async mutateAgent(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MutateAgentSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mutate",
        args: [BigInt(args.tokenId), args.newVersion, args.reason],
      });

      const hash = await walletProvider.sendTransaction({
        to: AGENTDNA_CONTRACT as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Successfully mutated Agent #${args.tokenId} to version ${args.newVersion}. TX: https://basescan.org/tx/${hash}`;
    } catch (error) {
      return `Error mutating agent: ${error}`;
    }
  }

  /**
   * Add a trait to an agent.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The trait arguments.
   * @returns Trait addition confirmation.
   */
  @CreateAction({
    name: "add_trait",
    description: `
Add a trait to an AI agent's onchain identity. Traits are key-value pairs like personality:analytical, skill:defi-trading, alignment:chaotic-good.
Only the agent's owner can add traits. Awards 10 trait points.
`,
    schema: AddTraitSchema,
  })
  async addTrait(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AddTraitSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "addTrait",
        args: [BigInt(args.tokenId), args.traitType, args.traitValue],
      });

      const hash = await walletProvider.sendTransaction({
        to: AGENTDNA_CONTRACT as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Successfully added trait to Agent #${args.tokenId}: ${args.traitType} = ${args.traitValue}. TX: https://basescan.org/tx/${hash}`;
    } catch (error) {
      return `Error adding trait: ${error}`;
    }
  }

  /**
   * Resolve a .agent name to a wallet address.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The resolution arguments.
   * @returns The resolved address.
   */
  @CreateAction({
    name: "resolve_name",
    description: `Resolve a .agent name to a wallet address. For example, resolving "helixa" returns the address that owns helixa.agent.`,
    schema: ResolveNameSchema,
  })
  async resolveName(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ResolveNameSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: AGENTNAMES_ABI,
        functionName: "resolve",
        args: [args.name],
      });

      const result = await walletProvider.readContract(AGENTNAMES_CONTRACT, data);

      if (result === "0x0000000000000000000000000000000000000000") {
        return `${args.name}.agent is not registered.`;
      }

      return `${args.name}.agent resolves to: ${result}`;
    } catch (error) {
      return `Error resolving name: ${error}`;
    }
  }

  /**
   * Check .agent name availability.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The check arguments.
   * @returns Availability status.
   */
  @CreateAction({
    name: "check_name",
    description: `Check if a .agent name is available for registration on Helixa.`,
    schema: CheckNameSchema,
  })
  async checkName(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckNameSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: AGENTNAMES_ABI,
        functionName: "available",
        args: [args.name],
      });

      const result = await walletProvider.readContract(AGENTNAMES_CONTRACT, data);

      return result
        ? `${args.name}.agent is available!`
        : `${args.name}.agent is already taken.`;
    } catch (error) {
      return `Error checking name: ${error}`;
    }
  }

  /**
   * Get Helixa protocol statistics.
   *
   * @param walletProvider - The wallet provider.
   * @param _args - Empty args.
   * @returns Protocol stats.
   */
  @CreateAction({
    name: "get_helixa_stats",
    description: `Get Helixa AgentDNA protocol statistics — total agents registered, current mint price, and free mints remaining.`,
    schema: GetStatsSchema,
  })
  async getStats(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof GetStatsSchema>,
  ): Promise<string> {
    try {
      const totalData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "totalAgents",
      });

      const priceData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mintPrice",
      });

      const [total, price] = await Promise.all([
        walletProvider.readContract(AGENTDNA_CONTRACT, totalData),
        walletProvider.readContract(AGENTDNA_CONTRACT, priceData),
      ]);

      const totalNum = Number(total);
      const priceEth = Number(price) / 1e18;
      const freeRemaining = totalNum < 100 ? 100 - totalNum : 0;

      let msg = `Helixa AgentDNA Stats:\n`;
      msg += `Total Agents: ${totalNum}\n`;
      msg += `Mint Price: ${priceEth === 0 ? "Free (beta)" : `${priceEth} ETH`}\n`;
      if (freeRemaining > 0) {
        msg += `Free Mints Remaining: ${freeRemaining}\n`;
      }
      msg += `Contract: ${AGENTDNA_CONTRACT}\n`;
      msg += `Explorer: https://basescan.org/address/${AGENTDNA_CONTRACT}`;

      return msg;
    } catch (error) {
      return `Error fetching stats: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Helixa AgentDNA is deployed on Base (chain 8453) only.
   *
   * @param network - The network to check.
   * @returns True if the network is Base.
   */
  supportsNetwork(network: Network): boolean {
    return network.chainId === "8453" || (network.chainId as unknown as number) === 8453;
  }
}

/**
 * Factory function for creating a HelixaActionProvider.
 *
 * @returns A new HelixaActionProvider instance.
 */
export const helixaActionProvider = () => new HelixaActionProvider();
