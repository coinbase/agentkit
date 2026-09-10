/**
 * Query-construction and parsing helpers for The Graph.
 * The discovery + introspection logic is ported from PayQL (Apache-2.0).
 */

/**
 * Fulltext discovery against The Graph network subgraph's `subgraphMetadataSearch`
 * index (over displayName + description), hopping to the most-signalled active
 * subgraph and its current deployment.
 */
export const SEARCH_QUERY = `query AgentkitGraphSearch($text: String!, $first: Int!) {
  subgraphMetadataSearch(text: $text, first: $first) {
    displayName
    description
    categories
    subgraphs(first: 1, where: { active: true }, orderBy: currentSignalledTokens, orderDirection: desc) {
      id
      active
      currentSignalledTokens
      currentVersion {
        subgraphDeployment {
          ipfsHash
          stakedTokens
          signalledTokens
          queryFeesAmount
        }
      }
    }
  }
}`;

/**
 * Introspects a subgraph's top-level query entities and their arguments.
 */
export const INTROSPECT_QUERY = `query AgentkitGraphIntrospect { __type(name: "Query") { fields { name args { name } } } }`;

/**
 * Turns a free-text query into a Postgres tsquery with prefix matching:
 * "uniswap v3" -> "uniswap:* | v3:*".
 *
 * @param q - The free-text search string
 * @returns A tsquery string
 */
export function toFulltext(q: string): string {
  const tokens = q
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return q.trim();
  return tokens.map(t => `${t}:*`).join(" | ");
}

/**
 * Builds a GraphQL POST request body.
 *
 * @param query - The GraphQL query string
 * @param variables - Optional GraphQL variables
 * @returns A fetch RequestInit for the query
 */
export function gqlBody(query: string, variables?: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  };
}

/**
 * Converts a wei string to a GRT float.
 *
 * @param v - The wei value as a string
 * @returns The GRT amount, or null
 */
export function weiToGRT(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 1e18 : null;
}

/**
 * A single subgraph discovery result.
 */
export interface SubgraphHit {
  displayName: string | null;
  subgraphId: string | null;
  ipfsHash: string | null;
  currentSignalledTokensGRT: number | null;
  queryFeesGRT: number | null;
  description: string | null;
  categories: string[] | null;
}

/**
 * Parses a `subgraphMetadataSearch` GraphQL response into ranked hits.
 *
 * @param raw - The parsed GraphQL response body ({ data, errors })
 * @returns Subgraph hits sorted by signal, descending
 */
export function parseHits(raw: unknown): SubgraphHit[] {
  const metas: Array<Record<string, unknown>> =
    (raw as { data?: { subgraphMetadataSearch?: Array<Record<string, unknown>> } })?.data
      ?.subgraphMetadataSearch ?? [];
  const hits: SubgraphHit[] = metas.map(m => {
    const sg = ((m.subgraphs as Array<Record<string, unknown>>) || [])[0] || null;
    const dep =
      ((sg?.currentVersion as Record<string, unknown>)?.subgraphDeployment as Record<
        string,
        unknown
      >) ?? null;
    return {
      displayName: (m.displayName as string) ?? null,
      subgraphId: (sg?.id as string) ?? null,
      ipfsHash: (dep?.ipfsHash as string) ?? null,
      currentSignalledTokensGRT: weiToGRT(sg?.currentSignalledTokens as string),
      queryFeesGRT: weiToGRT(dep?.queryFeesAmount as string),
      description: (m.description as string) ?? null,
      categories: (m.categories as string[]) ?? null,
    };
  });
  hits.sort((a, b) => (b.currentSignalledTokensGRT ?? 0) - (a.currentSignalledTokensGRT ?? 0));
  return hits;
}
