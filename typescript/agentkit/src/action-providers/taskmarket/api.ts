export const DEFAULT_TASKMARKET_API_BASE = "https://api.taskmarket.dev/api";

export interface TaskmarketApiClient {
  getJson(path: string): Promise<unknown>;
}

export class FetchTaskmarketApiClient implements TaskmarketApiClient {
  constructor(private readonly apiBase: string = DEFAULT_TASKMARKET_API_BASE) {}

  async getJson(path: string): Promise<unknown> {
    const url = `${this.apiBase.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "coinbase-agentkit-taskmarket/0.1",
      },
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!response.ok) {
      throw new Error(`Taskmarket API ${response.status} for ${path}: ${text.slice(0, 400)}`);
    }
    return parsed;
  }
}

export function toUsdc(rewardBaseUnits: string | number | undefined): number | null {
  if (rewardBaseUnits === undefined || rewardBaseUnits === null) {
    return null;
  }
  const asNumber = typeof rewardBaseUnits === "number" ? rewardBaseUnits : Number(rewardBaseUnits);
  if (!Number.isFinite(asNumber)) {
    return null;
  }
  return asNumber / 1_000_000;
}

export function summarizeTask(task: Record<string, unknown>): Record<string, unknown> {
  const reward = toUsdc(task.reward as string | number | undefined);
  const netReward = toUsdc(task.netReward as string | number | undefined);
  return {
    id: task.id,
    status: task.status,
    phase: task.phase,
    mode: task.mode,
    rewardUsdc: reward,
    netRewardUsdc: netReward,
    submissionCount: task.submissionCount,
    expiryTime: task.expiryTime,
    createdAt: task.createdAt,
    tags: task.tags,
    network: "Base",
    chainId: 8453,
    url: task.id ? `https://taskmarket.dev/tasks/${task.id}` : undefined,
    descriptionPreview:
      typeof task.description === "string" ? task.description.slice(0, 280) : undefined,
  };
}
