import { Connection, Keypair } from "@solana/web3.js";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { SaidActionProvider } from "./saidActionProvider";
import { MIN_REGISTER_AND_VERIFY_LAMPORTS } from "./constants";
import { deriveAgentIdentityPda } from "./utils";

jest.mock("../../wallet-providers/svmWalletProvider");

const OWNER = Keypair.generate().publicKey;
const OTHER_WALLET = Keypair.generate().publicKey.toBase58();

/**
 * Builds a mock fetch Response.
 *
 * @param body - The JSON body to resolve with
 * @param ok - Whether the response is ok (default true)
 * @param status - The HTTP status code (defaults to 200 if ok, else 500)
 * @returns A mock Response-like object
 */
function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("SaidActionProvider", () => {
  let actionProvider: SaidActionProvider;
  let mockWallet: jest.Mocked<SvmWalletProvider>;
  let mockConnection: jest.Mocked<Connection>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    actionProvider = new SaidActionProvider();

    mockConnection = {
      getAccountInfo: jest.fn().mockResolvedValue(null),
      getBalance: jest.fn().mockResolvedValue(MIN_REGISTER_AND_VERIFY_LAMPORTS * 2),
      getLatestBlockhash: jest
        .fn()
        .mockResolvedValue({ blockhash: "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi" }),
    } as unknown as jest.Mocked<Connection>;

    mockWallet = {
      getConnection: jest.fn().mockReturnValue(mockConnection),
      getPublicKey: jest.fn().mockReturnValue(OWNER),
      signMessage: jest.fn().mockResolvedValue(new Uint8Array(64).fill(7)),
      signAndSendTransaction: jest.fn().mockResolvedValue("mock-signature"),
      waitForSignatureResult: jest.fn().mockResolvedValue({
        context: { slot: 1 },
        value: { err: null },
      }),
    } as unknown as jest.Mocked<SvmWalletProvider>;

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe("supportsNetwork", () => {
    it("should support Solana mainnet", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" }),
      ).toBe(true);
    });

    it("should not support other networks", () => {
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-devnet" }),
      ).toBe(false);
      expect(
        actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
      ).toBe(false);
    });
  });

  describe("getAgentReputation", () => {
    it("should return the reputation summary for a scored wallet", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          wallet: OTHER_WALLET,
          tier: "silver",
          compositeScore: 0.7421,
          registered: true,
          verified: true,
          scored: true,
        }),
      );

      const result = await actionProvider.getAgentReputation(mockWallet, {
        wallet: OTHER_WALLET,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.saidprotocol.com/api/trust/${OTHER_WALLET}`,
      );
      expect(result).toContain("silver");
      expect(result).toContain("0.7421");
      expect(result).toContain("Registered SAID agent: yes");
      expect(result).toContain("On-chain verified: yes");
    });

    it("should describe an unknown wallet as an unknown counterparty", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          wallet: OTHER_WALLET,
          tier: "unranked",
          compositeScore: 0,
          registered: false,
          verified: false,
          scored: false,
        }),
      );

      const result = await actionProvider.getAgentReputation(mockWallet, {
        wallet: OTHER_WALLET,
      });

      expect(result).toContain("unknown counterparty");
      expect(result).not.toContain("Tier: unranked");
    });

    it("should reject an invalid address without calling the API", async () => {
      const result = await actionProvider.getAgentReputation(mockWallet, {
        wallet: "not-a-solana-address",
      });

      expect(result).toContain("not a valid Solana address");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface API errors", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false));

      const result = await actionProvider.getAgentReputation(mockWallet, {
        wallet: OTHER_WALLET,
      });

      expect(result).toContain("Error fetching SAID reputation");
    });
  });

  describe("findAgents", () => {
    const agent = {
      name: "Research Bot",
      description: "Performs deep research for hire",
      wallet: OTHER_WALLET,
      isVerified: true,
      skills: ["research", "summarization"],
      serviceTypes: ["api"],
      a2aEndpoint: "https://bot.example.com/a2a",
      mcpEndpoint: null,
      x402Wallet: OTHER_WALLET,
      reputation: { tier: "gold", compositeScore: 0.81, scored: true },
    };

    it("should return a ranked list with endpoints", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ agents: [agent] }));

      const result = await actionProvider.findAgents(mockWallet, {
        query: "research",
        verifiedOnly: true,
        limit: 5,
      });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("search=research");
      expect(calledUrl).toContain("verified=true");
      expect(calledUrl).toContain("limit=5");
      expect(result).toContain("Research Bot");
      expect(result).toContain("gold (0.81)");
      expect(result).toContain("A2A: https://bot.example.com/a2a");
      expect(result).toContain(`x402 wallet: ${OTHER_WALLET}`);
    });

    it("should handle empty results", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ agents: [] }));

      const result = await actionProvider.findAgents(mockWallet, {
        query: "nonexistent",
        verifiedOnly: true,
        limit: 5,
      });

      expect(result).toBe("No SAID agents matched the search.");
    });
  });

  describe("sendAgentMessage", () => {
    it("should send a message via the relay and return the task id", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ taskId: "task_123", status: "created" }));

      const result = await actionProvider.sendAgentMessage(mockWallet, {
        toWallet: OTHER_WALLET,
        message: "please research X",
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.saidprotocol.com/a2a/${OTHER_WALLET}/message`);
      expect(init.method).toBe("POST");
      const sent = JSON.parse(init.body);
      expect(sent.from).toBe(OWNER.toBase58());
      expect(mockWallet.signMessage).toHaveBeenCalledTimes(1);
      expect(typeof sent.signature).toBe("string");
      expect(typeof sent.timestamp).toBe("number");
      expect(result).toContain("task_123");
      expect(result).toContain("created");
    });

    it("should still send unauthenticated when the wallet cannot sign messages", async () => {
      mockWallet.signMessage.mockRejectedValue(new Error("Message signing is not supported yet"));
      fetchMock.mockResolvedValue(jsonResponse({ taskId: "task_456", status: "created" }));

      const result = await actionProvider.sendAgentMessage(mockWallet, {
        toWallet: OTHER_WALLET,
        message: "hi",
      });

      const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sent.signature).toBeUndefined();
      expect(sent.timestamp).toBeUndefined();
      expect(result).toContain("unauthenticated");
      expect(result).toContain("task_456");
    });

    it("should tell the agent to register when the relay rejects an unregistered sender", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: "Sender not registered on SAID" }, false, 403),
      );

      const result = await actionProvider.sendAgentMessage(mockWallet, {
        toWallet: OTHER_WALLET,
        message: "hi",
      });

      expect(result).toContain("register_said_identity");
    });

    it("should report when the recipient is not a SAID agent", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "Recipient not found" }, false, 404));

      const result = await actionProvider.sendAgentMessage(mockWallet, {
        toWallet: OTHER_WALLET,
        message: "hi",
      });

      expect(result).toContain("not a registered SAID agent");
    });

    it("should reject an invalid recipient address", async () => {
      const result = await actionProvider.sendAgentMessage(mockWallet, {
        toWallet: "nope",
        message: "hi",
      });

      expect(result).toContain("not a valid Solana address");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("checkAgentMessages", () => {
    it("should list incoming messages with sender reputation", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          count: 1,
          messages: [
            {
              taskId: "task_9",
              message: "can you summarize this?",
              status: "created",
              createdAt: "2026-06-13T00:00:00Z",
              from: { wallet: OTHER_WALLET, name: "Caller Bot", verified: true, reputation: 0.72 },
            },
          ],
        }),
      );

      const result = await actionProvider.checkAgentMessages(mockWallet, { limit: 20 });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain(`/a2a/${OWNER.toBase58()}/inbox`);
      expect(result).toContain("Caller Bot");
      expect(result).toContain("verified, reputation 0.72");
      expect(result).toContain("task_9");
    });

    it("should handle an empty inbox", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ count: 0, messages: [] }));

      const result = await actionProvider.checkAgentMessages(mockWallet, { limit: 20 });

      expect(result).toBe("No incoming agent messages.");
    });
  });

  describe("registerSaidIdentity", () => {
    const META = "https://example.com/.well-known/agent-card.json";

    /**
     * Builds raw agent identity account data matching the on-chain layout.
     *
     * @param isVerified - The value of the on-chain is_verified flag
     * @returns The raw account data buffer
     */
    function agentAccountData(isVerified: boolean): Buffer {
      const uri = Buffer.from(META, "utf8");
      const data = Buffer.alloc(8 + 32 + 32 + 4 + uri.length + 8 + 1 + 16);
      data.writeUInt32LE(uri.length, 8 + 32 + 32);
      uri.copy(data, 8 + 32 + 32 + 4);
      data[8 + 32 + 32 + 4 + uri.length + 8] = isVerified ? 1 : 0;
      return data;
    }

    it("should register and verify an unregistered wallet", async () => {
      const result = await actionProvider.registerSaidIdentity(mockWallet, {
        metadataUri: META,
      });

      expect(mockWallet.signAndSendTransaction).toHaveBeenCalledTimes(1);
      const tx = mockWallet.signAndSendTransaction.mock.calls[0][0];
      expect(tx.message.compiledInstructions).toHaveLength(2);
      expect(result).toContain("registered and verified");
      expect(result).toContain("mock-signature");
      expect(result).toContain(deriveAgentIdentityPda(OWNER).toBase58());
    });

    it("should only verify when an unverified identity PDA already exists", async () => {
      mockConnection.getAccountInfo.mockResolvedValue({ data: agentAccountData(false) } as never);

      const result = await actionProvider.registerSaidIdentity(mockWallet, {
        metadataUri: META,
      });

      const tx = mockWallet.signAndSendTransaction.mock.calls[0][0];
      expect(tx.message.compiledInstructions).toHaveLength(1);
      expect(result).toContain("verified");
    });

    it("should do nothing when the on-chain identity is already verified", async () => {
      mockConnection.getAccountInfo.mockResolvedValue({ data: agentAccountData(true) } as never);

      const result = await actionProvider.registerSaidIdentity(mockWallet, {
        metadataUri: META,
      });

      expect(mockWallet.signAndSendTransaction).not.toHaveBeenCalled();
      expect(result).toContain("already has a verified SAID identity");
    });

    it("should refuse when the balance is insufficient", async () => {
      mockConnection.getBalance.mockResolvedValue(1_000_000);

      const result = await actionProvider.registerSaidIdentity(mockWallet, {
        metadataUri: META,
      });

      expect(mockWallet.signAndSendTransaction).not.toHaveBeenCalled();
      expect(result).toContain("insufficient balance");
    });

    it("should report success when confirmation times out but the transaction landed", async () => {
      mockWallet.waitForSignatureResult.mockRejectedValue(
        new Error("Signature has expired: block height exceeded"),
      );
      mockConnection.getSignatureStatuses = jest.fn().mockResolvedValue({
        value: [{ err: null, confirmationStatus: "finalized" }],
      }) as never;

      const result = await actionProvider.registerSaidIdentity(mockWallet, {
        metadataUri: META,
      });

      expect(result).toContain("registered and verified");
      expect(result).toContain("mock-signature");
    });

    it("should report an error when confirmation fails and the transaction did not land", async () => {
      mockWallet.waitForSignatureResult.mockRejectedValue(
        new Error("Signature has expired: block height exceeded"),
      );
      mockConnection.getSignatureStatuses = jest.fn().mockResolvedValue({
        value: [null],
      }) as never;

      const result = await actionProvider.registerSaidIdentity(mockWallet, {
        metadataUri: META,
      });

      expect(result).toContain("Error registering SAID identity");
    }, 15000);
  });
});
