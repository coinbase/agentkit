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

export const ComputeActionRefSchema = z
  .object({
    agent_id: z.string().min(1).describe("The agent identifier."),
    action_type: z
      .string()
      .min(1)
      .describe(
        "The type of action. Examples: 'enter_oasis', 'agent_trail', 'submit_action'.",
      ),
    scope: z
      .string()
      .min(1)
      .describe(
        "The service or context scope. Examples: 'giskard-oasis', 'argentum-core'.",
      ),
    timestamp: z
      .number()
      .int()
      .positive()
      .describe("Unix timestamp (seconds) of the action."),
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
