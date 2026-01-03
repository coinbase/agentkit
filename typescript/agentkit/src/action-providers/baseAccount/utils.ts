/**
 * Convert Unix timestamp to human-readable format
 *
 * @param timestamp - Unix timestamp to convert
 * @returns Human-readable date string
 */
export function formatTimestamp(timestamp: number): string {
  // Handle special case for maximum timestamp (never expires)
  // 281474976710655 is the maximum value used in spend permissions to indicate "never expires"
  if (timestamp >= 281474976710655) {
    return "Never expires";
  }

  // Check if the timestamp would be valid when converted to milliseconds
  const timestampMs = timestamp * 1000;
  if (timestampMs > Number.MAX_SAFE_INTEGER) {
    return "Far future";
  }

  const date = new Date(timestampMs);
  if (isNaN(date.getTime())) {
    return "Invalid timestamp";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Convert period in seconds to human-readable format
 *
 * @param seconds - Period in seconds to convert
 * @returns Human-readable period string
 */
export function formatPeriod(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (remainingSeconds > 0)
    parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`);

  return parts.length > 0 ? parts.join(", ") : "0 seconds";
}
