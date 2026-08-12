import type { TaskMarketDelegateInput } from "./schemas";

export interface TaskMarketCreateTaskRequest {
  description: string;
  rewardUsdc: number;
  durationHours: number;
  tags?: string[];
}

export interface TaskMarketCreateTaskResult {
  [key: string]: unknown;
  taskId: string;
  status?: string;
  escrowTxHash?: string;
}

/**
 * The write boundary is injected by the host application. It can use the
 * first-party TaskMarket CLI or an equivalent signer/payment adapter. Keeping
 * it outside AgentKit prevents an LLM from obtaining a key or spending funds
 * merely because a tool was exposed.
 */
export type TaskMarketCreateTask = (
  request: TaskMarketCreateTaskRequest,
) => Promise<TaskMarketCreateTaskResult>;

export interface TaskMarketActionProviderConfig {
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  createTask?: TaskMarketCreateTask;
}

export interface TaskMarketDelegationPlan {
  description: TaskMarketDelegateInput["description"];
  rewardUsdc: number;
  durationHours: number;
  tags?: string[];
  maxSpendUsdc: number;
  requiresExplicitConfirmation: true;
  payment: "TaskMarket escrow in USDC; host adapter owns authorization and signing";
}
