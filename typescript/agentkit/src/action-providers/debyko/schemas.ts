import { z } from "zod";

const selection = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .describe(
    "Which listings to answer for, in the DQL selection grammar (venue = HYPERLIQUID and base = BTC), with or without the leading where. The machine form of the same node is accepted as an object. Names come from the catalogue.",
  );

const layer = z.enum(["ticker", "mark", "funding", "oi", "book", "stats", "venue_depth"]);

const units = z
  .enum(["published", "base"])
  .optional()
  .describe("published leaves each venue's own unit alone. base converts to the base asset.");

const numberFormat = z
  .enum(["json", "string"])
  .optional()
  .describe("string returns every number as a string with the same digits.");

/**
 * POST /v2/snapshots. Fields are the published SnapshotsRequest.
 */
export const SnapshotsSchema = z
  .object({
    where: selection.optional(),
    layers: z.array(layer).optional().describe("Which layers to read. Every layer when omitted."),
    units,
    number_format: numberFormat,
    include_synthetic: z
      .boolean()
      .optional()
      .describe("Include venues that exist in the registry but are not published."),
    include_raw: z
      .boolean()
      .optional()
      .describe("Also return each layer's message as the venue sent it."),
    allow_stale: z
      .boolean()
      .optional()
      .describe(
        "Return a stale value under withheld, never in the value field. Off by default: a stale value is absent, and only its status, reason and dates are returned.",
      ),
  })
  .describe("Which listings and which layers to read now.");

/**
 * POST /v2/screen. The query is DQL. Names come from the catalogue.
 */
export const ScreenSchema = z
  .object({
    query: z
      .string()
      .describe(
        "The query in DQL only. Names come from the catalogue. The guide is https://docs.debyko.com/dql/guide/",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        "How many instruments to return in one page. Default 100. The catalogue states the ceiling.",
      ),
    include_unknown: z
      .boolean()
      .optional()
      .describe(
        "Also return the instruments the data could not decide, with result: unknown, instead of dropping them.",
      ),
  })
  .describe("A DQL query. Send the text form in query.");

/**
 * POST /v2/snapshots/history. Fields are the published HistoryRequest.
 * Exactly one of interval, at and raw: true. from and to are required with interval and raw, and refused with at.
 */
export const HistorySchema = z
  .object({
    where: selection.optional(),
    layers: z.array(layer).optional().describe("Which layers to read."),
    units,
    number_format: numberFormat,
    include_synthetic: z
      .boolean()
      .optional()
      .describe("Include venues that exist in the registry but are not published."),
    interval: z
      .string()
      .optional()
      .describe(
        "One row per period of this length, each holding the last reading in it. Example: 1h.",
      ),
    at: z
      .array(z.string())
      .optional()
      .describe(
        "One row per ISO-8601 UTC instant, strictly ascending. from and to are refused with at.",
      ),
    raw: z
      .boolean()
      .optional()
      .describe("Every row as it arrived, unsampled. Send true to select this mode."),
    from: z
      .string()
      .optional()
      .describe("Start of the window, ISO-8601 UTC. Required with interval and raw."),
    to: z
      .string()
      .optional()
      .describe("End of the window, ISO-8601 UTC. Required with interval and raw."),
    include_gaps: z
      .boolean()
      .optional()
      .describe(
        "Keep the rows that have no reading. The default keeps them, so a gap stays visible.",
      ),
    freshness: z
      .string()
      .optional()
      .describe("Override the freshness bound for every layer asked for. Example: 30s."),
    allow_stale: z
      .boolean()
      .optional()
      .describe(
        "Return a stale value under withheld, never in the value field. Off by default: a stale value is absent, and only its status, reason and dates are returned.",
      ),
  })
  .superRefine((value, ctx) => {
    const modes = [value.interval !== undefined, value.at !== undefined, value.raw === true].filter(
      Boolean,
    ).length;
    if (modes !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Send exactly one of interval, at, or raw: true.",
      });
    }
    if (
      (value.interval !== undefined || value.raw === true) &&
      (value.from === undefined || value.to === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "from and to are required with interval and with raw.",
      });
    }
    if (value.at !== undefined && (value.from !== undefined || value.to !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "from and to are refused with at.",
      });
    }
  })
  .describe(
    "The same snapshot as it stood in the past. Exactly one of interval, at and raw: true. from and to are required with interval and raw, and refused with at.",
  );
