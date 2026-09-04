/** Convert TaskMarket base units (6 decimals) to human USDC string. */
export function baseUnitsToUsdc(baseUnits: string | number | null | undefined): string {
  if (baseUnits === null || baseUnits === undefined || baseUnits === "") {
    return "0";
  }
  const n = typeof baseUnits === "string" ? Number(baseUnits) : baseUnits;
  if (!Number.isFinite(n)) {
    return "0";
  }
  return (n / 1_000_000).toFixed(6).replace(/\.?0+$/, "") || "0";
}

/** Truncate long task descriptions for agent context windows. */
export function summarizeDescription(description: string | null | undefined, max = 280): string {
  if (!description) {
    return "";
  }
  const flat = description.replace(/\\n/g, "\n").replace(/\s+/g, " ").trim();
  if (flat.length <= max) {
    return flat;
  }
  return `${flat.slice(0, max - 1)}…`;
}

export interface CompactTask {
  id: string;
  mode: string;
  status: string;
  rewardUsdc: string;
  netRewardUsdc: string | null;
  submissionCount: number;
  tags: string[];
  hoursLeft: number | null;
  submissionWindowOpen: boolean | null;
  summary: string;
  url: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function compactTask(raw: any): CompactTask {
  const reward = baseUnitsToUsdc(raw?.reward);
  const net = raw?.netReward != null ? baseUnitsToUsdc(raw.netReward) : null;
  let hoursLeft: number | null = null;
  if (raw?.expiryTime) {
    const ms = Date.parse(raw.expiryTime) - Date.now();
    hoursLeft = Number.isFinite(ms) ? Math.max(0, Math.round((ms / 3_600_000) * 10) / 10) : null;
  }
  const id = String(raw?.id || "");
  return {
    id,
    mode: String(raw?.mode || "unknown"),
    status: String(raw?.status || "unknown"),
    rewardUsdc: reward,
    netRewardUsdc: net,
    submissionCount: Number(raw?.submissionCount || 0),
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    hoursLeft,
    submissionWindowOpen:
      typeof raw?.submissionWindowOpen === "boolean" ? raw.submissionWindowOpen : null,
    summary: summarizeDescription(raw?.description),
    url: id ? `https://taskmarket.dev/task/${id}` : "https://taskmarket.dev/",
  };
}
