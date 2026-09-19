import { z } from "zod";
import { encodeFunctionData, type Hex } from "viem";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { AZZLE_TASK_REGISTRY_ABI } from "./constants";
import {
  AzzleTaskAmountSchema,
  AzzleTaskSchema,
  PostAzzleTaskSchema,
} from "./schemas";

function isBaseMainnet(network: Network): boolean {
  return network.protocolFamily === "evm" &&
    (network.chainId === "8453" || network.networkId === "base-mainnet");
}

function futureDeadline(deadline: number): void {
  if (deadline <= Math.floor(Date.now() / 1000)) {
    throw new Error("deadline must be a Unix timestamp in the future.");
  }
}

async function send(
  walletProvider: EvmWalletProvider,
  taskRegistry: string,
  data: Hex,
): Promise<string> {
  if (!isBaseMainnet(walletProvider.getNetwork())) {
    throw new Error("AZZLE V2 actions require Base mainnet (chain ID 8453).");
  }
  const hash = await walletProvider.sendTransaction({
    to: taskRegistry as Hex,
    data,
  });
  await walletProvider.waitForTransactionReceipt(hash);
  return hash;
}

/**
 * AgentKit provider for AZZLE V2 task coordination on Base.
 * Amounts are AZL wei. Registry addresses are supplied at runtime from the
 * caller's current manifest rather than embedded in this provider.
 */
export class AzzleActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("azzle", []);
  }

  supportsNetwork = isBaseMainnet;

  @CreateAction({
    name: "post_azzle_task",
    description: "Post an AZZLE V2 task on Base. totalAmountAzlWei is AZL wei, not USDC.",
    schema: PostAzzleTaskSchema,
  })
  async postAzzleTask(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PostAzzleTaskSchema>,
  ): Promise<string> {
    try {
      futureDeadline(args.deadline);
      const hash = await send(walletProvider, args.taskRegistry, encodeFunctionData({
        abi: AZZLE_TASK_REGISTRY_ABI,
        functionName: "post",
        args: [BigInt(args.totalAmountAzlWei), BigInt(args.deadline)],
      }));
      return `Posted AZZLE task. Read TaskPosted from receipt ${hash} for its canonical v2:standard:N or v2:micro:N ID.`;
    } catch (error) {
      return `Error posting AZZLE task: ${error}`;
    }
  }

  @CreateAction({ name: "claim_azzle_task", description: "Claim a posted AZZLE V2 task on Base.", schema: AzzleTaskSchema })
  async claimAzzleTask(walletProvider: EvmWalletProvider, args: z.infer<typeof AzzleTaskSchema>): Promise<string> {
    return this.call(walletProvider, args.taskRegistry, "claim", [BigInt(args.taskId)], "Claimed AZZLE task");
  }

  @CreateAction({ name: "fund_azzle_task", description: "Fund a claimed AZZLE task in AZL wei; full funding activates it.", schema: AzzleTaskAmountSchema })
  async fundAzzleTask(walletProvider: EvmWalletProvider, args: z.infer<typeof AzzleTaskAmountSchema>): Promise<string> {
    return this.call(walletProvider, args.taskRegistry, "fund", [BigInt(args.taskId), BigInt(args.amountAzlWei)], "Funded AZZLE task");
  }

  @CreateAction({ name: "mark_azzle_task_delivered", description: "Mark a fully funded active AZZLE task delivered.", schema: AzzleTaskSchema })
  async markAzzleTaskDelivered(walletProvider: EvmWalletProvider, args: z.infer<typeof AzzleTaskSchema>): Promise<string> {
    return this.call(walletProvider, args.taskRegistry, "markDelivered", [BigInt(args.taskId)], "Marked AZZLE task delivered");
  }

  @CreateAction({ name: "release_azzle_escrow", description: "Release AZL wei from a delivered AZZLE task.", schema: AzzleTaskAmountSchema })
  async releaseAzzleEscrow(walletProvider: EvmWalletProvider, args: z.infer<typeof AzzleTaskAmountSchema>): Promise<string> {
    return this.call(walletProvider, args.taskRegistry, "release", [BigInt(args.taskId), BigInt(args.amountAzlWei)], "Released AZZLE escrow");
  }

  @CreateAction({ name: "complete_azzle_task", description: "Complete a delivered AZZLE task after release.", schema: AzzleTaskSchema })
  async completeAzzleTask(walletProvider: EvmWalletProvider, args: z.infer<typeof AzzleTaskSchema>): Promise<string> {
    return this.call(walletProvider, args.taskRegistry, "complete", [BigInt(args.taskId)], "Completed AZZLE task");
  }

  private async call(
    walletProvider: EvmWalletProvider,
    taskRegistry: string,
    functionName: "claim" | "fund" | "markDelivered" | "release" | "complete",
    args: readonly bigint[],
    success: string,
  ): Promise<string> {
    try {
      const data = functionName === "fund" || functionName === "release"
        ? encodeFunctionData({
            abi: AZZLE_TASK_REGISTRY_ABI,
            functionName,
            args: [args[0], args[1]],
          })
        : encodeFunctionData({
            abi: AZZLE_TASK_REGISTRY_ABI,
            functionName,
            args: [args[0]],
          });
      const hash = await send(walletProvider, taskRegistry, data);
      return `${success}. Transaction hash: ${hash}`;
    } catch (error) {
      return `Error: ${error}`;
    }
  }
}

export const azzleActionProvider = () => new AzzleActionProvider();
