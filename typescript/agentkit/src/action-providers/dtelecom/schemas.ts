import { z } from "zod";

// --- Credits ---

export const BuyCreditsSchema = z
  .object({
    amountUsd: z
      .number()
      .positive()
      .describe("Amount in USD to spend on credits (e.g. 1.0 for $1.00)"),
  })
  .describe("Buy dTelecom credits with USDC via x402 payment protocol");

// --- Account ---

export const GetAccountSchema = z
  .object({})
  .describe("Get dTelecom account details including credit balance and limits");

export const GetTransactionsSchema = z
  .object({
    limit: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Maximum number of transactions to return"),
    offset: z.number().int().nonnegative().nullable().describe("Number of transactions to skip"),
  })
  .describe("List credit transactions for the account");

export const GetSessionsSchema = z
  .object({
    limit: z.number().int().positive().nullable().describe("Maximum number of sessions to return"),
    offset: z.number().int().nonnegative().nullable().describe("Number of sessions to skip"),
    status: z.string().nullable().describe("Filter by session status (e.g. 'active', 'completed')"),
  })
  .describe("List sessions for the account");

// --- Bundled Agent Session ---

export const CreateAgentSessionSchema = z
  .object({
    roomName: z.string().describe("Unique name for the WebRTC room"),
    participantIdentity: z.string().describe("Identity for the server-side agent participant"),
    durationMinutes: z
      .number()
      .int()
      .positive()
      .describe("Session duration in minutes (e.g. 10 for a 10-minute session)"),
    language: z
      .string()
      .nullable()
      .describe(
        "Language code: a=English US, b=English UK, e=Spanish, f=French, h=Hindi, i=Italian, j=Japanese, p=Portuguese BR, z=Chinese Mandarin",
      ),
    ttsMaxCharacters: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Maximum TTS characters (default: 10000)"),
    metadata: z.string().nullable().describe("Optional metadata string for the session"),
    clientIdentity: z
      .string()
      .nullable()
      .describe("Identity for the browser client participant (creates a second token)"),
    clientIp: z.string().nullable().describe("Client IP address for geo-routing optimization"),
  })
  .describe(
    "Create a bundled voice agent session with WebRTC, STT, and TTS. Returns tokens for both agent (server) and client (browser) participants.",
  );

export const ExtendAgentSessionSchema = z
  .object({
    bundleId: z.string().describe("Bundle ID from createAgentSession response"),
    additionalMinutes: z
      .number()
      .int()
      .positive()
      .describe("Additional minutes to extend the session"),
    additionalTtsCharacters: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Additional TTS characters to add"),
  })
  .describe("Extend an active bundled agent session duration and/or TTS character limit");

// --- Standalone WebRTC ---

export const CreateWebRTCTokenSchema = z
  .object({
    roomName: z.string().describe("Unique name for the WebRTC room"),
    participantIdentity: z.string().describe("Identity for the participant"),
    durationMinutes: z.number().int().positive().describe("Token validity duration in minutes"),
    metadata: z.string().nullable().describe("Optional metadata string"),
    clientIp: z.string().nullable().describe("Client IP address for geo-routing optimization"),
  })
  .describe("Create a standalone WebRTC room token for real-time audio/video communication");

export const ExtendWebRTCTokenSchema = z
  .object({
    sessionId: z.string().describe("Session ID from createWebRTCToken response"),
    additionalMinutes: z
      .number()
      .int()
      .positive()
      .describe("Additional minutes to extend the token"),
  })
  .describe("Extend an active WebRTC token duration");

// --- Standalone STT ---

export const CreateSTTSessionSchema = z
  .object({
    durationMinutes: z.number().int().positive().describe("Session duration in minutes"),
    language: z
      .string()
      .nullable()
      .describe(
        "Language code: a=English US, b=English UK, e=Spanish, f=French, h=Hindi, i=Italian, j=Japanese, p=Portuguese BR, z=Chinese Mandarin",
      ),
  })
  .describe("Create a standalone speech-to-text session");

export const ExtendSTTSessionSchema = z
  .object({
    sessionId: z.string().describe("Session ID from createSTTSession response"),
    additionalMinutes: z
      .number()
      .int()
      .positive()
      .describe("Additional minutes to extend the session"),
  })
  .describe("Extend an active STT session duration");

// --- Standalone TTS ---

export const CreateTTSSessionSchema = z
  .object({
    maxCharacters: z
      .number()
      .int()
      .positive()
      .describe("Maximum number of characters that can be synthesized"),
    language: z
      .string()
      .nullable()
      .describe(
        "Language code: a=English US, b=English UK, e=Spanish, f=French, h=Hindi, i=Italian, j=Japanese, p=Portuguese BR, z=Chinese Mandarin",
      ),
  })
  .describe("Create a standalone text-to-speech session");

export const ExtendTTSSessionSchema = z
  .object({
    sessionId: z.string().describe("Session ID from createTTSSession response"),
    additionalCharacters: z
      .number()
      .int()
      .positive()
      .describe("Additional characters to add to the session"),
  })
  .describe("Extend an active TTS session character limit");
