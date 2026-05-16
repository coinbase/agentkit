import { dtelecomActionProvider } from "./dtelecomActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

// Mock @dtelecom/x402-client
const mockBuyCredits = jest.fn();
const mockGetAccount = jest.fn();
const mockGetTransactions = jest.fn();
const mockGetSessions = jest.fn();
const mockCreateAgentSession = jest.fn();
const mockExtendAgentSession = jest.fn();
const mockCreateWebRTCToken = jest.fn();
const mockExtendWebRTCToken = jest.fn();
const mockCreateSTTSession = jest.fn();
const mockExtendSTTSession = jest.fn();
const mockCreateTTSSession = jest.fn();
const mockExtendTTSSession = jest.fn();

jest.mock("@dtelecom/x402-client", () => ({
  DtelecomGateway: jest.fn().mockImplementation(() => ({
    buyCredits: mockBuyCredits,
    getAccount: mockGetAccount,
    getTransactions: mockGetTransactions,
    getSessions: mockGetSessions,
    createAgentSession: mockCreateAgentSession,
    extendAgentSession: mockExtendAgentSession,
    createWebRTCToken: mockCreateWebRTCToken,
    extendWebRTCToken: mockExtendWebRTCToken,
    createSTTSession: mockCreateSTTSession,
    extendSTTSession: mockExtendSTTSession,
    createTTSSession: mockCreateTTSSession,
    extendTTSSession: mockExtendTTSSession,
  })),
}));

describe("DtelecomActionProvider", () => {
  const provider = dtelecomActionProvider();

  const mockWallet = {
    getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
    getNetwork: jest.fn().mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
    getName: jest.fn().mockReturnValue("test-wallet"),
    toSigner: jest.fn().mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
    }),
  } as unknown as EvmWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("supportsNetwork", () => {
    it("should support EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should not support non-EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
    });
  });

  describe("buyCredits", () => {
    it("should buy credits successfully", async () => {
      mockBuyCredits.mockResolvedValueOnce({
        accountId: "acc_123",
        creditedMicrocredits: "1000000",
        amountUsd: 1.0,
      });

      const result = await provider.buyCredits(mockWallet, { amountUsd: 1.0 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.accountId).toBe("acc_123");
      expect(parsed.creditedMicrocredits).toBe("1000000");
      expect(parsed.amountUsd).toBe(1.0);
      expect(mockBuyCredits).toHaveBeenCalledWith({ amountUsd: 1.0 });
    });

    it("should return error message on failure", async () => {
      mockBuyCredits.mockRejectedValueOnce(new Error("Insufficient USDC"));

      const result = await provider.buyCredits(mockWallet, { amountUsd: 1.0 });
      expect(result).toContain("Error buying dTelecom credits");
      expect(result).toContain("Insufficient USDC");
    });
  });

  describe("getAccount", () => {
    it("should return account details", async () => {
      mockGetAccount.mockResolvedValueOnce({
        id: "acc_123",
        walletAddress: "0x1234",
        walletChain: "evm",
        creditBalance: "5000000",
        availableBalance: "4500000",
        maxConcurrentSessions: 5,
        maxApiRate: 10,
        createdAt: "2025-01-01T00:00:00Z",
      });

      const result = await provider.getAccount(mockWallet, {});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.creditBalance).toBe("5000000");
      expect(parsed.availableBalance).toBe("4500000");
    });
  });

  describe("getTransactions", () => {
    it("should return transactions with pagination", async () => {
      mockGetTransactions.mockResolvedValueOnce({
        transactions: [
          {
            id: "tx_1",
            amount: "1000000",
            balanceAfter: "5000000",
            type: "purchase",
            referenceId: null,
            service: null,
            description: "Credit purchase",
            createdAt: "2025-01-01T00:00:00Z",
          },
        ],
        limit: 10,
        offset: 0,
      });

      const result = await provider.getTransactions(mockWallet, { limit: 10, offset: 0 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.transactions).toHaveLength(1);
      expect(mockGetTransactions).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    });
  });

  describe("getSessions", () => {
    it("should return sessions with status filter", async () => {
      mockGetSessions.mockResolvedValueOnce({
        sessions: [
          {
            id: "sess_1",
            service: "webrtc",
            bundleId: null,
            status: "active",
            roomName: "test-room",
            serverUrl: null,
            reservedMicrocredits: "16000",
            chargedMicrocredits: "0",
            tokenExpiresAt: "2025-01-01T01:00:00Z",
            startedAt: "2025-01-01T00:00:00Z",
            endedAt: null,
            settlementMethod: "credit",
            createdAt: "2025-01-01T00:00:00Z",
          },
        ],
        limit: 10,
        offset: 0,
      });

      const result = await provider.getSessions(mockWallet, {
        status: "active",
        limit: null,
        offset: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.sessions[0].status).toBe("active");
      expect(mockGetSessions).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        status: "active",
      });
    });
  });

  describe("createAgentSession", () => {
    const agentSessionResponse = {
      bundleId: "bundle_123",
      webrtc: {
        agent: { sessionId: "ws_1", token: "agent-token", wsUrl: "wss://sfu.example.com" },
        client: { sessionId: "ws_2", token: "client-token", wsUrl: "wss://sfu.example.com" },
      },
      stt: { sessionId: "stt_1", token: "stt-token", serverUrl: "wss://stt.example.com" },
      tts: { sessionId: "tts_1", token: "tts-token", serverUrl: "wss://tts.example.com" },
      expiresAt: "2025-01-01T00:10:00Z",
    };

    it("should create agent session with all options", async () => {
      mockCreateAgentSession.mockResolvedValueOnce(agentSessionResponse);

      const result = await provider.createAgentSession(mockWallet, {
        roomName: "test-room",
        participantIdentity: "agent",
        durationMinutes: 10,
        language: "a",
        clientIdentity: "user",
        ttsMaxCharacters: null,
        metadata: null,
        clientIp: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.bundleId).toBe("bundle_123");
      expect(parsed.webrtc.agent.token).toBe("agent-token");
      expect(parsed.webrtc.client.token).toBe("client-token");
      expect(parsed.stt.token).toBe("stt-token");
      expect(parsed.tts.token).toBe("tts-token");
      expect(mockCreateAgentSession).toHaveBeenCalledWith({
        roomName: "test-room",
        participantIdentity: "agent",
        durationMinutes: 10,
        language: "a",
        ttsMaxCharacters: undefined,
        metadata: undefined,
        clientIdentity: "user",
        clientIp: undefined,
      });
    });

    it("should create agent session with minimal options", async () => {
      mockCreateAgentSession.mockResolvedValueOnce(agentSessionResponse);

      const result = await provider.createAgentSession(mockWallet, {
        roomName: "minimal-room",
        participantIdentity: "agent",
        durationMinutes: 5,
        language: null,
        ttsMaxCharacters: null,
        metadata: null,
        clientIdentity: null,
        clientIp: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.bundleId).toBe("bundle_123");
    });
  });

  describe("extendAgentSession", () => {
    it("should extend agent session", async () => {
      mockExtendAgentSession.mockResolvedValueOnce({
        webrtc: {
          agent: { token: "new-agent-token", newExpiresAt: "2025-01-01T00:20:00Z" },
          client: { token: "new-client-token", newExpiresAt: "2025-01-01T00:20:00Z" },
        },
        stt: { token: "new-stt-token", newExpiresAt: "2025-01-01T00:20:00Z" },
        tts: { token: "new-tts-token", newExpiresAt: "2025-01-01T00:20:00Z" },
      });

      const result = await provider.extendAgentSession(mockWallet, {
        bundleId: "bundle_123",
        additionalMinutes: 10,
        additionalTtsCharacters: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.webrtc.agent.token).toBe("new-agent-token");
      expect(mockExtendAgentSession).toHaveBeenCalledWith({
        bundleId: "bundle_123",
        additionalMinutes: 10,
        additionalTtsCharacters: undefined,
      });
    });
  });

  describe("createWebRTCToken", () => {
    it("should create WebRTC token", async () => {
      mockCreateWebRTCToken.mockResolvedValueOnce({
        sessionId: "ws_1",
        token: "webrtc-token",
        wsUrl: "wss://sfu.example.com",
        expiresAt: "2025-01-01T00:10:00Z",
      });

      const result = await provider.createWebRTCToken(mockWallet, {
        roomName: "test-room",
        participantIdentity: "user",
        durationMinutes: 10,
        metadata: null,
        clientIp: null,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.token).toBe("webrtc-token");
      expect(parsed.wsUrl).toBe("wss://sfu.example.com");
    });
  });

  describe("extendWebRTCToken", () => {
    it("should extend WebRTC token", async () => {
      mockExtendWebRTCToken.mockResolvedValueOnce({
        token: "new-webrtc-token",
        wsUrl: "wss://sfu.example.com",
        newExpiresAt: "2025-01-01T00:20:00Z",
      });

      const result = await provider.extendWebRTCToken(mockWallet, {
        sessionId: "ws_1",
        additionalMinutes: 10,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.token).toBe("new-webrtc-token");
    });
  });

  describe("createSTTSession", () => {
    it("should create STT session", async () => {
      mockCreateSTTSession.mockResolvedValueOnce({
        sessionId: "stt_1",
        token: "stt-token",
        serverUrl: "wss://stt.example.com",
        expiresAt: "2025-01-01T00:10:00Z",
      });

      const result = await provider.createSTTSession(mockWallet, {
        durationMinutes: 10,
        language: "a",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.token).toBe("stt-token");
      expect(parsed.serverUrl).toBe("wss://stt.example.com");
    });
  });

  describe("extendSTTSession", () => {
    it("should extend STT session", async () => {
      mockExtendSTTSession.mockResolvedValueOnce({
        token: "new-stt-token",
        newExpiresAt: "2025-01-01T00:20:00Z",
      });

      const result = await provider.extendSTTSession(mockWallet, {
        sessionId: "stt_1",
        additionalMinutes: 10,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.token).toBe("new-stt-token");
    });
  });

  describe("createTTSSession", () => {
    it("should create TTS session", async () => {
      mockCreateTTSSession.mockResolvedValueOnce({
        sessionId: "tts_1",
        token: "tts-token",
        serverUrl: "wss://tts.example.com",
        expiresAt: "2025-01-01T00:10:00Z",
      });

      const result = await provider.createTTSSession(mockWallet, {
        maxCharacters: 10000,
        language: "a",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.token).toBe("tts-token");
      expect(parsed.serverUrl).toBe("wss://tts.example.com");
    });
  });

  describe("extendTTSSession", () => {
    it("should extend TTS session", async () => {
      mockExtendTTSSession.mockResolvedValueOnce({
        token: "new-tts-token",
        maxCharacters: 20000,
        newExpiresAt: "2025-01-01T00:20:00Z",
      });

      const result = await provider.extendTTSSession(mockWallet, {
        sessionId: "tts_1",
        additionalCharacters: 10000,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.token).toBe("new-tts-token");
      expect(parsed.maxCharacters).toBe(20000);
    });
  });
});
