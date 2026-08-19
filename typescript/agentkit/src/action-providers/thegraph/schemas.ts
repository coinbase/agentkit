import { z } from "zod";

/**
 * Input schema for discovering subgraphs by plain-English topic.
 */
export const SearchSubgraphsSchema = z
  .object({
    query: z
      .string()
      .min(1, "A search topic is required.")
      .describe("Plain-English topic to find subgraphs for, e.g. 'uniswap v3 arbitrum' or 'aave lending'"),
    first: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("How many subgraph candidates to return (default 5)"),
  })
  .describe("Find the best subgraphs on The Graph for a data topic");

/**
 * Input schema for fetching a subgraph's queryable entities/fields.
 */
export const GetSubgraphSchemaSchema = z
  .object({
    subgraphId: z
      .string()
      .min(1)
      .describe("The subgraph id (from search_subgraphs) whose schema to introspect"),
  })
  .describe("Get the queryable entities and their arguments for a subgraph");

/**
 * Input schema for running a paid GraphQL query against a subgraph.
 */
export const QuerySubgraphSchema = z
  .object({
    subgraphId: z.string().min(1).describe("The subgraph id to query (from search_subgraphs)"),
    query: z
      .string()
      .min(1)
      .describe("The GraphQL query string (use get_subgraph_schema to see available entities/fields)"),
    variables: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional GraphQL variables"),
  })
  .describe("Run a GraphQL query against a subgraph, auto-paying the x402 fee");
