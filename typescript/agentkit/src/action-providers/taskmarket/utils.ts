import { TASKMARKET_APP_URL, USDC_DECIMALS } from "./constants";
import { TaskMarketTask, TaskMarketTaskSummary } from "./types";

/**
 * Converts a USDC base-unit amount (6 decimals) to a human number.
 *
 * Values arrive as either strings or numbers depending on the endpoint, and an
 * absent value is meaningfully different from zero, so it returns 0 only when
 * the input is genuinely absent or unparseable.
 *
 * @param value - Raw amount in USDC base units.
 * @returns The amount expressed in whole USDC.
 */
export function toUsdc(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** USDC_DECIMALS;
}

/**
 * Hours between now and an ISO timestamp.
 *
 * @param iso - ISO-8601 timestamp, or undefined.
 * @returns Hours remaining, negative if already past, or null if unparseable.
 */
export function hoursUntil(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round(((t - Date.now()) / 3_600_000) * 10) / 10;
}

/**
 * Collapses a task description to a single readable line.
 *
 * Task descriptions are frequently several hundred words of markdown. Pasting
 * them verbatim into a model context is the single easiest way to make a
 * discovery tool unusable, so the list view keeps only the opening.
 *
 * @param description - The full task description.
 * @param maxLength - Maximum characters to keep.
 * @returns A one-line summary.
 */
export function summarize(description: string, maxLength = 140): string {
  const flat = (description || "").replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;
  return `${flat.slice(0, maxLength - 1)}…`;
}

/**
 * Reduces a raw API task to the fields worth showing an agent.
 *
 * @param task - The raw task from the TaskMarket API.
 * @returns A compact summary.
 */
export function toSummary(task: TaskMarketTask): TaskMarketTaskSummary {
  return {
    id: task.id,
    url: `${TASKMARKET_APP_URL}/tasks/${task.id}`,
    summary: summarize(task.description),
    netRewardUsdc: toUsdc(task.netReward ?? task.reward),
    submissionCount: task.submissionCount ?? 0,
    expiresAt: task.expiryTime ?? null,
    hoursRemaining: hoursUntil(task.expiryTime),
    tags: task.tags ?? [],
  };
}

/**
 * Whether a task is genuinely open to new submissions right now.
 *
 * `status === "open"` alone is not sufficient: a task can be open but past its
 * expiry, or have its submission window explicitly closed.
 *
 * @param task - The raw task from the TaskMarket API.
 * @returns True if a worker could still submit to this task.
 */
export function isOpenForWork(task: TaskMarketTask): boolean {
  if (task.status && task.status !== "open") return false;
  if (task.submissionWindowOpen === false) return false;
  const left = hoursUntil(task.expiryTime);
  if (left !== null && left <= 0) return false;
  return true;
}

/**
 * Scores how well an open task matches a description of work.
 *
 * This is deliberately a transparent keyword overlap rather than an embedding
 * lookup. It runs locally with no extra model call, and an agent operator can
 * read it and predict what it will do, which matters more here than recall.
 *
 * @param task - The raw task from the TaskMarket API.
 * @param workDescription - The work the caller is considering delegating.
 * @returns Number of distinct matched terms.
 */
export function matchScore(task: TaskMarketTask, workDescription: string): number {
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
    "are", "was", "have", "has", "not", "but", "can", "will", "would", "should",
    "a", "an", "of", "to", "in", "on", "is", "it", "be", "as", "at", "by", "or",
  ]);
  const terms = new Set(
    workDescription
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 2 && !stop.has(t)),
  );
  if (terms.size === 0) return 0;

  const haystack = `${task.description} ${(task.tags ?? []).join(" ")}`.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits;
}
