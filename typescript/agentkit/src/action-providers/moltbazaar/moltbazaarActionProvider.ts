import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { WalletProvider } from "../../wallet-providers";
import {
  MoltBazaarBrowseTasksSchema,
  MoltBazaarGetTaskSchema,
  MoltBazaarPlaceBidSchema,
  MoltBazaarSubmitWorkSchema,
  MoltBazaarGetAgentSchema,
} from "./schemas";

const MOLTBAZAAR_API_BASE = "https://www.moltbazaar.ai/api";

/**
 * Configuration options for the MoltBazaarActionProvider.
 */
export interface MoltBazaarActionProviderConfig {
  /**
   * Optional custom API base URL.
   */
  apiBaseUrl?: string;
}

/**
 * MoltBazaarActionProvider is an action provider for the MoltBazaar AI Agent Marketplace.
 * 
 * MoltBazaar is the first trustless marketplace where AI agents can:
 * - Browse tasks posted by humans
 * - Bid on work opportunities
 * - Complete tasks and receive USDC payments
 * - Build on-chain reputation
 * 
 * All payments are secured by smart contract escrow on Base.
 */
export class MoltBazaarActionProvider extends ActionProvider<WalletProvider> {
  private readonly apiBaseUrl: string;

  /**
   * Constructor for the MoltBazaarActionProvider class.
   *
   * @param config - The configuration options for the MoltBazaarActionProvider.
   */
  constructor(config: MoltBazaarActionProviderConfig = {}) {
    super("moltbazaar", []);
    this.apiBaseUrl = config.apiBaseUrl || MOLTBAZAAR_API_BASE;
  }

  /**
   * Creates the authentication message for MoltBazaar API.
   */
  private createAuthMessage(action: string, walletAddress: string, timestamp: number): string {
    return `MoltBazaar Authentication\nAction: ${action}\nWallet: ${walletAddress.toLowerCase()}\nTimestamp: ${timestamp}`;
  }

  /**
   * Browse available tasks on MoltBazaar.
   *
   * @param args - The input arguments for the action.
   * @returns A message containing the list of available tasks.
   */
  @CreateAction({
    name: "moltbazaar_browse_tasks",
    description: `
Browse available tasks on MoltBazaar - the AI Agent Job Marketplace on Base.

This action retrieves a list of tasks that humans have posted for AI agents to complete.
Each task includes:
- Title and description of the work
- Budget in USDC
- Required skills
- Current status
- Deadline (if any)

Use this to find work opportunities that match your capabilities.

A successful response returns a JSON array of tasks.
A failure response returns an error message.
`,
    schema: MoltBazaarBrowseTasksSchema,
  })
  async browseTasks(args: z.infer<typeof MoltBazaarBrowseTasksSchema>): Promise<string> {
    try {
      const params = new URLSearchParams({
        status: args.status,
        limit: args.limit.toString(),
      });

      const response = await fetch(`${this.apiBaseUrl}/tasks?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        return `Error browsing tasks: ${error.error || response.statusText}`;
      }

      const data = await response.json();
      return `Found ${data.count} tasks on MoltBazaar:\n${JSON.stringify(data.tasks, null, 2)}`;
    } catch (error) {
      return `Error browsing MoltBazaar tasks: ${error}`;
    }
  }

  /**
   * Get details of a specific task.
   *
   * @param args - The input arguments for the action.
   * @returns A message containing the task details.
   */
  @CreateAction({
    name: "moltbazaar_get_task",
    description: `
Get detailed information about a specific task on MoltBazaar.

This action retrieves full details of a task including:
- Complete description
- Budget and deadline
- Required skills
- Current bids from other agents
- Task poster information

Use this before bidding to understand the full scope of work.

A successful response returns the task details as JSON.
A failure response returns an error message.
`,
    schema: MoltBazaarGetTaskSchema,
  })
  async getTask(args: z.infer<typeof MoltBazaarGetTaskSchema>): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/tasks/${args.taskId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        return `Error getting task: ${error.error || response.statusText}`;
      }

      const task = await response.json();
      return `Task details:\n${JSON.stringify(task, null, 2)}`;
    } catch (error) {
      return `Error getting MoltBazaar task: ${error}`;
    }
  }

  /**
   * Place a bid on a task.
   *
   * @param walletProvider - The wallet provider to use for signing.
   * @param args - The input arguments for the action.
   * @returns A message indicating success or failure of the bid.
   */
  @CreateAction({
    name: "moltbazaar_place_bid",
    description: `
Place a bid on a task on MoltBazaar.

This action submits your proposal to complete a task. You specify:
- The amount in USDC you want to be paid
- A proposal message explaining why you're the best agent for the job

The task poster will review all bids and select the best one.
If selected, you'll be assigned the task and can start working.

Payment is secured via smart contract escrow - you get paid when work is approved.

Requires wallet signature for authentication.

A successful response confirms your bid was placed.
A failure response returns an error message.
`,
    schema: MoltBazaarPlaceBidSchema,
  })
  async placeBid(
    walletProvider: WalletProvider,
    args: z.infer<typeof MoltBazaarPlaceBidSchema>
  ): Promise<string> {
    try {
      const address = await walletProvider.getAddress();
      const timestamp = Date.now();
      const message = this.createAuthMessage("place_bid", address, timestamp);
      const signature = await walletProvider.signMessage(message);

      const response = await fetch(`${this.apiBaseUrl}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: args.taskId,
          agent_wallet: address,
          proposed_amount_usdc: args.proposedAmountUsdc,
          proposal_message: args.proposalMessage,
          signature,
          message,
          timestamp,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return `Error placing bid: ${error.error || response.statusText}`;
      }

      const data = await response.json();
      return `Successfully placed bid on MoltBazaar!\nBid ID: ${data.bid?.id}\nAmount: ${args.proposedAmountUsdc} USDC\n\nThe task poster will review your bid and may accept it.`;
    } catch (error) {
      return `Error placing bid on MoltBazaar: ${error}`;
    }
  }

  /**
   * Submit completed work for a task.
   *
   * @param walletProvider - The wallet provider to use for signing.
   * @param args - The input arguments for the action.
   * @returns A message indicating success or failure of the submission.
   */
  @CreateAction({
    name: "moltbazaar_submit_work",
    description: `
Submit completed work for a task on MoltBazaar.

After you've been assigned a task and completed the work, use this action to submit your deliverables.

You provide:
- Notes describing what you did
- Optional URL to deliverables (GitHub repo, deployed site, etc.)

The task poster will review your submission. If approved, payment is automatically released from escrow to your wallet.

Requires wallet signature for authentication.

A successful response confirms your work was submitted.
A failure response returns an error message.
`,
    schema: MoltBazaarSubmitWorkSchema,
  })
  async submitWork(
    walletProvider: WalletProvider,
    args: z.infer<typeof MoltBazaarSubmitWorkSchema>
  ): Promise<string> {
    try {
      const address = await walletProvider.getAddress();
      const timestamp = Date.now();
      const message = this.createAuthMessage("submit_work", address, timestamp);
      const signature = await walletProvider.signMessage(message);

      const response = await fetch(`${this.apiBaseUrl}/tasks/${args.taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_wallet: address,
          submission_notes: args.submissionNotes,
          submission_url: args.submissionUrl,
          signature,
          message,
          timestamp,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return `Error submitting work: ${error.error || response.statusText}`;
      }

      const data = await response.json();
      return `Successfully submitted work on MoltBazaar!\n\nYour submission is now pending review by the task poster.\nOnce approved, payment will be automatically released to your wallet via the escrow smart contract.`;
    } catch (error) {
      return `Error submitting work on MoltBazaar: ${error}`;
    }
  }

  /**
   * Get agent profile and stats.
   *
   * @param walletProvider - The wallet provider to use.
   * @param args - The input arguments for the action.
   * @returns A message containing the agent profile.
   */
  @CreateAction({
    name: "moltbazaar_get_agent",
    description: `
Get your agent profile and stats on MoltBazaar.

This action retrieves your agent profile including:
- Name and description
- Reputation score
- Total tasks completed
- Total earnings in USDC
- Skills and categories

Use this to check your standing on the platform.

A successful response returns your agent profile as JSON.
A failure response returns an error message.
`,
    schema: MoltBazaarGetAgentSchema,
  })
  async getAgent(
    walletProvider: WalletProvider,
    args: z.infer<typeof MoltBazaarGetAgentSchema>
  ): Promise<string> {
    try {
      let url = `${this.apiBaseUrl}/agents`;
      
      if (args.agentId) {
        url = `${this.apiBaseUrl}/agents/${args.agentId}`;
      } else {
        const address = await walletProvider.getAddress();
        url = `${this.apiBaseUrl}/agents?wallet=${address.toLowerCase()}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        return `Error getting agent profile: ${error.error || response.statusText}`;
      }

      const data = await response.json();
      return `Agent profile:\n${JSON.stringify(data, null, 2)}`;
    } catch (error) {
      return `Error getting MoltBazaar agent profile: ${error}`;
    }
  }

  /**
   * Checks if the MoltBazaar action provider supports the given network.
   * MoltBazaar operates on Base mainnet.
   *
   * @param network - The network to check.
   * @returns True if the network is Base mainnet, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.chainId === "8453";
}

/**
 * Factory function to create a MoltBazaarActionProvider instance.
 *
 * @param config - The configuration options for the MoltBazaarActionProvider.
 * @returns A new MoltBazaarActionProvider instance.
 */
export const moltbazaarActionProvider = (config: MoltBazaarActionProviderConfig = {}) =>
  new MoltBazaarActionProvider(config);
