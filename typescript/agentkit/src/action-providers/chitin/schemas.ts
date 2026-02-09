import { z } from "zod";

/**
 * Input schema for getting a soul profile.
 */
export const ChitinGetSoulProfileSchema = z
  .object({
    name: z.string().describe("The given name of the agent (e.g. 'kani-alpha')"),
  })
  .strict();

/**
 * Input schema for resolving a DID document.
 */
export const ChitinResolveDIDSchema = z
  .object({
    name: z.string().describe("The given name of the agent to resolve as a DID"),
  })
  .strict();

/**
 * Input schema for verifying a certificate.
 */
export const ChitinVerifyCertSchema = z
  .object({
    certId: z.string().describe("The certificate token ID to verify"),
  })
  .strict();

/**
 * Input schema for checking A2A readiness.
 */
export const ChitinCheckA2aReadySchema = z
  .object({
    name: z.string().describe("The given name of the agent to check A2A readiness for"),
  })
  .strict();

/**
 * Input schema for registering a new soul.
 */
export const ChitinRegisterSoulSchema = z
  .object({
    name: z
      .string()
      .describe("Given name for the soul (3-32 chars, lowercase alphanumeric with hyphens)"),
    systemPrompt: z.string().describe("System prompt or personality definition"),
    agentType: z
      .enum(["personal", "enterprise", "autonomous"])
      .describe("Type of agent: personal, enterprise, or autonomous"),
    agentDescription: z.string().optional().describe("Short description of the agent"),
    bio: z.string().optional().describe("Public bio for the agent's profile"),
    services: z
      .array(
        z.object({
          type: z
            .enum(["a2a", "mcp", "webhook", "rest", "graphql", "web"])
            .describe("Service type"),
          url: z.string().describe("Service endpoint URL"),
          description: z.string().optional().describe("Service description"),
        }),
      )
      .optional()
      .describe("Service endpoints (A2A, MCP, etc.) to register in the ERC-8004 agentURI"),
  })
  .strict();

/**
 * Input schema for issuing a certificate.
 */
export const ChitinIssueCertSchema = z
  .object({
    recipientAddress: z.string().describe("Ethereum address of the certificate recipient"),
    certType: z
      .enum(["achievement", "completion", "membership", "skill", "identity"])
      .describe("Type of certificate"),
    title: z.string().describe("Certificate title"),
    description: z.string().optional().describe("Certificate description"),
  })
  .strict();
