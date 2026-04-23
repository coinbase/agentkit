import { z } from "zod";
import { DtelecomGateway } from "@dtelecom/x402-client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  BuyCreditsSchema,
  GetAccountSchema,
  GetTransactionsSchema,
  GetSessionsSchema,
  CreateAgentSessionSchema,
  ExtendAgentSessionSchema,
  CreateWebRTCTokenSchema,
  ExtendWebRTCTokenSchema,
  CreateSTTSessionSchema,
  ExtendSTTSessionSchema,
  CreateTTSSessionSchema,
  ExtendTTSSessionSchema,
} from "./schemas";

/**
 * Extract a human-readable message from an unknown error.
 *
 * @param error - The error to extract a message from.
 * @returns A human-readable error message string.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  const str = String(error);
  if (str === "[object Object]") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return str;
}

/**
 * DtelecomActionProvider provides actions for dTelecom decentralized voice infrastructure.
 *
 * Supports buying credits (via x402/USDC), managing accounts, and creating
 * WebRTC, STT (speech-to-text), and TTS (text-to-speech) sessions — both
 * standalone and as bundled agent sessions.
 */
export class DtelecomActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Creates a new DtelecomActionProvider instance.
   */
  constructor() {
    super("dtelecom", []);
  }

  /**
   * Buy dTelecom credits with USDC.
   *
   * @param walletProvider - The wallet provider for signing transactions.
   * @param args - The buy credits arguments.
   * @returns JSON string with purchase result.
   */
  @CreateAction({
    name: "buy_credits",
    description: `Buy dTelecom credits with USDC via x402 payment protocol.
Credits are used to pay for WebRTC, STT, and TTS sessions.
The payment is made automatically from the wallet's USDC balance on Base.

Inputs:
- amountUsd: Amount in USD to spend (e.g. 1.0 for $1.00)`,
    schema: BuyCreditsSchema,
  })
  async buyCredits(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BuyCreditsSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.buyCredits({ amountUsd: args.amountUsd });
      return JSON.stringify({
        success: true,
        accountId: result.accountId,
        creditedMicrocredits: result.creditedMicrocredits,
        amountUsd: result.amountUsd,
      });
    } catch (error) {
      return `Error buying dTelecom credits: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Get dTelecom account details.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param _args - Empty args object.
   * @returns JSON string with account details.
   */
  @CreateAction({
    name: "get_account",
    description: `Get dTelecom account details including credit balance and session limits.
Returns wallet address, credit balance, available balance, max concurrent sessions, and API rate limit.`,
    schema: GetAccountSchema,
  })
  async getAccount(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof GetAccountSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.getAccount();
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error getting dTelecom account: ${getErrorMessage(error)}`;
    }
  }

  /**
   * List credit transactions.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Pagination options.
   * @returns JSON string with transactions list.
   */
  @CreateAction({
    name: "get_transactions",
    description: `List credit transactions for the account.
Shows purchases, charges, and refunds with amounts and timestamps.

Inputs:
- limit: Max transactions to return (optional)
- offset: Number to skip for pagination (optional)`,
    schema: GetTransactionsSchema,
  })
  async getTransactions(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTransactionsSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.getTransactions({
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error getting dTelecom transactions: ${getErrorMessage(error)}`;
    }
  }

  /**
   * List sessions.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Pagination and filter options.
   * @returns JSON string with sessions list.
   */
  @CreateAction({
    name: "get_sessions",
    description: `List sessions for the account.
Shows active and completed WebRTC, STT, TTS sessions with status and costs.

Inputs:
- limit: Max sessions to return (optional)
- offset: Number to skip for pagination (optional)
- status: Filter by status like 'active' or 'completed' (optional)`,
    schema: GetSessionsSchema,
  })
  async getSessions(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetSessionsSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.getSessions({
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
        status: args.status ?? undefined,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error getting dTelecom sessions: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Create a bundled voice agent session.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Session configuration.
   * @returns JSON string with session tokens and endpoints.
   */
  @CreateAction({
    name: "create_agent_session",
    description: `Create a bundled voice agent session with WebRTC + STT + TTS.
This is the recommended way to create a complete voice AI session.
Returns tokens for both server-side agent and browser client participants.

Inputs:
- roomName: Unique room name
- participantIdentity: Agent identity
- durationMinutes: Session duration in minutes
- language: Language code (optional, default English US)
  a=English US, b=English UK, e=Spanish, f=French, h=Hindi, i=Italian, j=Japanese, p=Portuguese BR, z=Chinese Mandarin
- ttsMaxCharacters: Max TTS characters (optional, default 10000)
- clientIdentity: Browser client identity (optional, creates second token)
- clientIp: Client IP for geo-routing (optional)`,
    schema: CreateAgentSessionSchema,
  })
  async createAgentSession(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateAgentSessionSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.createAgentSession({
        roomName: args.roomName,
        participantIdentity: args.participantIdentity,
        durationMinutes: args.durationMinutes,
        language: args.language ?? undefined,
        ttsMaxCharacters: args.ttsMaxCharacters ?? undefined,
        metadata: args.metadata ?? undefined,
        clientIdentity: args.clientIdentity ?? undefined,
        clientIp: args.clientIp ?? undefined,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error creating dTelecom agent session: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Extend an active bundled agent session.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Extension parameters.
   * @returns JSON string with new tokens.
   */
  @CreateAction({
    name: "extend_agent_session",
    description: `Extend an active bundled agent session.
Adds more time and/or TTS characters to a running session.

Inputs:
- bundleId: Bundle ID from the create response
- additionalMinutes: Extra minutes to add
- additionalTtsCharacters: Extra TTS characters (optional)`,
    schema: ExtendAgentSessionSchema,
  })
  async extendAgentSession(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ExtendAgentSessionSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.extendAgentSession({
        bundleId: args.bundleId,
        additionalMinutes: args.additionalMinutes,
        additionalTtsCharacters: args.additionalTtsCharacters ?? undefined,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error extending dTelecom agent session: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Create a standalone WebRTC room token.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Token configuration.
   * @returns JSON string with token and WebSocket URL.
   */
  @CreateAction({
    name: "create_webrtc_token",
    description: `Create a standalone WebRTC room token for real-time audio/video.
Use this for custom setups where you manage STT/TTS separately.

Inputs:
- roomName: Unique room name
- participantIdentity: Participant identity
- durationMinutes: Token validity in minutes
- metadata: Optional metadata string
- clientIp: Client IP for geo-routing (optional)`,
    schema: CreateWebRTCTokenSchema,
  })
  async createWebRTCToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateWebRTCTokenSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.createWebRTCToken({
        roomName: args.roomName,
        participantIdentity: args.participantIdentity,
        durationMinutes: args.durationMinutes,
        metadata: args.metadata ?? undefined,
        clientIp: args.clientIp ?? undefined,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error creating dTelecom WebRTC token: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Extend an active WebRTC token.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Extension parameters.
   * @returns JSON string with new token.
   */
  @CreateAction({
    name: "extend_webrtc_token",
    description: `Extend an active WebRTC token duration.

Inputs:
- sessionId: Session ID from the create response
- additionalMinutes: Extra minutes to add`,
    schema: ExtendWebRTCTokenSchema,
  })
  async extendWebRTCToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ExtendWebRTCTokenSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.extendWebRTCToken({
        sessionId: args.sessionId,
        additionalMinutes: args.additionalMinutes,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error extending dTelecom WebRTC token: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Create a standalone STT session.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Session configuration.
   * @returns JSON string with session token and server URL.
   */
  @CreateAction({
    name: "create_stt_session",
    description: `Create a standalone speech-to-text session.

Inputs:
- durationMinutes: Session duration in minutes
- language: Language code (optional)
  a=English US, b=English UK, e=Spanish, f=French, h=Hindi, i=Italian, j=Japanese, p=Portuguese BR, z=Chinese Mandarin`,
    schema: CreateSTTSessionSchema,
  })
  async createSTTSession(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateSTTSessionSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.createSTTSession({
        durationMinutes: args.durationMinutes,
        language: args.language ?? undefined,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error creating dTelecom STT session: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Extend an active STT session.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Extension parameters.
   * @returns JSON string with new token.
   */
  @CreateAction({
    name: "extend_stt_session",
    description: `Extend an active STT session duration.

Inputs:
- sessionId: Session ID from the create response
- additionalMinutes: Extra minutes to add`,
    schema: ExtendSTTSessionSchema,
  })
  async extendSTTSession(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ExtendSTTSessionSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.extendSTTSession({
        sessionId: args.sessionId,
        additionalMinutes: args.additionalMinutes,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error extending dTelecom STT session: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Create a standalone TTS session.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Session configuration.
   * @returns JSON string with session token and server URL.
   */
  @CreateAction({
    name: "create_tts_session",
    description: `Create a standalone text-to-speech session.

Inputs:
- maxCharacters: Maximum characters that can be synthesized
- language: Language code (optional)
  a=English US, b=English UK, e=Spanish, f=French, h=Hindi, i=Italian, j=Japanese, p=Portuguese BR, z=Chinese Mandarin`,
    schema: CreateTTSSessionSchema,
  })
  async createTTSSession(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateTTSSessionSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.createTTSSession({
        maxCharacters: args.maxCharacters,
        language: args.language ?? undefined,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error creating dTelecom TTS session: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Extend an active TTS session.
   *
   * @param walletProvider - The wallet provider for authentication.
   * @param args - Extension parameters.
   * @returns JSON string with new token and updated character limit.
   */
  @CreateAction({
    name: "extend_tts_session",
    description: `Extend an active TTS session character limit.

Inputs:
- sessionId: Session ID from the create response
- additionalCharacters: Extra characters to add`,
    schema: ExtendTTSSessionSchema,
  })
  async extendTTSSession(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ExtendTTSSessionSchema>,
  ): Promise<string> {
    try {
      const gateway = this.createGateway(walletProvider);
      const result = await gateway.extendTTSSession({
        sessionId: args.sessionId,
        additionalCharacters: args.additionalCharacters,
      });
      return JSON.stringify({ success: true, ...result });
    } catch (error) {
      return `Error extending dTelecom TTS session: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Check if the provider supports the given network.
   * dTelecom uses x402 payments on EVM (Base mainnet).
   *
   * @param network - The network to check.
   * @returns True if the network is EVM-based.
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm";
  }

  /**
   * Create a DtelecomGateway instance from the wallet provider.
   *
   * @param walletProvider - The wallet provider to derive the signer from.
   * @returns A configured DtelecomGateway instance.
   */
  private createGateway(walletProvider: EvmWalletProvider): DtelecomGateway {
    return new DtelecomGateway({ account: walletProvider.toSigner() });
  }
}

/**
 * Factory function to create a new DtelecomActionProvider instance.
 *
 * @returns A new DtelecomActionProvider
 */
export const dtelecomActionProvider = () => new DtelecomActionProvider();
