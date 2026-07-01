import { PostJsonResult } from "./types";

/**
 * Minimal fetch-based JSON POST helper with a hard timeout. invinoveritas actions are advisory —
 * a slow or failed call must never hang or throw into the agent's main flow, so every caller wraps
 * this in a try/catch and treats a non-ok response as "unavailable", not an error to propagate.
 *
 * @param url - The full URL to POST to
 * @param body - The JSON-serializable request body
 * @param opts - Optional Bearer apiKey and a required timeoutMs
 * @param opts.apiKey - Bearer token to send as an Authorization header, omitted for free/no-auth calls
 * @param opts.timeoutMs - Abort the request after this many milliseconds
 * @returns The parsed response, or `data: null` if the body wasn't valid JSON
 */
export async function postJson(
  url: string,
  body: unknown,
  opts: { apiKey?: string; timeoutMs: number },
): Promise<PostJsonResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.apiKey) headers["Authorization"] = `Bearer ${opts.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}
