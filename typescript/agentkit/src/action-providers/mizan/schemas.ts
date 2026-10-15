import { z } from "zod";

/**
 * Input schema for verifying a MIZAN credential.
 */
export const VerifyCredentialSchema = z
  .object({
    credentialId: z
      .string()
      .nullable()
      .describe("Registry id of the credential, e.g. 'dsr10-flagship'. Omit if sha256 is given."),
    sha256: z
      .string()
      .nullable()
      .describe("Optional sha256 of the proof bundle, used instead of credentialId."),
  })
  .strict();

/**
 * Input schema for listing canonical datasets.
 */
export const ListDatasetsSchema = z.object({}).strict();

/**
 * Input schema for checking whether an agent is proven.
 */
export const CheckAgentSchema = z
  .object({
    agent: z
      .string()
      .describe(
        "The agent to check: its wallet address, name, ERC-8004 id, agent-card URL, MIZAN credential id or a sha256.",
      ),
    action: z
      .string()
      .nullable()
      .describe(
        "What you are about to do with this agent, e.g. 'paying you for signals'. Used in the message returned when it is unverified.",
      ),
  })
  .strict();
