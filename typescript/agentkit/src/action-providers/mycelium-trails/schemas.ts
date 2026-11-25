import { z } from "zod";

export const VerifyTrailSchema = z
  .object({
    agent_id: z
      .string()
      .min(1)
      .describe(
        "The agent identifier to verify. Example: 'pioneer-agent-001', 'giskard-self'.",
      ),
    action_ref: z
      .string()
      .length(64)
      .describe(
        "SHA-256 action reference computed from agent_id, action_type, scope, and timestamp. " +
          "Use compute_action_ref to generate it from the same inputs.",
      ),
  })
  .strict();

const ASCII = /^[\x00-\x7f]*$/;
const ASCII_MESSAGE = "ASCII only (action_ref v1 domain)";

export const ComputeActionRefSchema = z
  .object({
    agent_id: z
      .string()
      .min(1)
      .regex(ASCII, ASCII_MESSAGE)
      .describe("The agent identifier (ASCII)."),
    action_type: z
      .string()
      .min(1)
      .regex(ASCII, ASCII_MESSAGE)
      .describe(
        "The type of action (ASCII). Examples: 'enter_oasis', 'agent_trail', 'submit_action'.",
      ),
    scope: z
      .string()
      .min(1)
      .regex(ASCII, ASCII_MESSAGE)
      .describe(
        "The service or context scope (ASCII, non-empty). Examples: 'giskard-oasis', 'argentum-core'.",
      ),
    timestamp: z
      .string()
      .regex(
        /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/,
        "must be YYYY-MM-DDTHH:MM:SS.mmmZ",
      )
      .describe("UTC time of the action as a STRING, exactly YYYY-MM-DDTHH:MM:SS.mmmZ."),
  })
  .strict();

export const GetTrailsSchema = z
  .object({
    agent_id: z.string().min(1).describe("The agent identifier to fetch trails for."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of trails to return. Defaults to 10, maximum 50."),
  })
  .strict();
