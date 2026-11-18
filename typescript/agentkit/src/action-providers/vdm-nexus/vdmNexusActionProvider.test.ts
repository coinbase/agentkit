// Mocks for ESM-only transitive deps (loaded via wallet-providers ←
// actionProvider ← our provider). These must be declared before any
// imports because jest hoists `jest.mock(...)` to the top of the file.
jest.mock("jose", () => ({}));
jest.mock("@coinbase/cdp-sdk", () => ({}));

import { verifyReceipt } from "@vdm-nexus/x402";
import { x402Client } from "@x402/fetch";
import { vdmNexusActionProvider, VdmNexusActionProvider } from "./vdmNexusActionProvider";
import { NexusChatSchema, NexusVerifyReceiptSchema, NexusGetDepositAddressSchema } from "./schemas";
import { SvmWalletProvider } from "../../wallet-providers";

jest.mock("@vdm-nexus/x402", () => ({
  verifyReceipt: jest.fn(),
}));

jest.mock("@x402/svm", () => ({
  toClientSvmSigner: jest.fn(() => ({ kind: "mock-signer" })),
}));

jest.mock("@x402/svm/exact/client", () => ({
  ExactSvmScheme: jest.fn().mockImplementation(() => ({ kind: "mock-scheme" })),
}));

jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn(),
}));

const verifyReceiptMock = verifyReceipt as jest.MockedFunction<typeof verifyReceipt>;
const x402ClientMock = x402Client as unknown as jest.Mock;

const MOCK_ENDPOINT = "https://nexus.example.com/api/v1";
const MOCK_RECEIPT = {
  v: 2,
  agent_pubkey: "BSKq2XtBCXHGZKvP9KStjJdpimTAJbmRP7FqZ1SBTshR",
  model: "openai/gpt-4o-mini",
  cost_usdc: 0.01,
  prompt_hash: "abc",
  response_hash: "def",
  inference_id: "test-receipt-id",
  nexus_signature: "sig",
};

/**
 * Encode an object as a base64 JSON string — mirrors the action provider's
 * own header encoder so tests can construct realistic response headers.
 *
 * @param obj - The object to serialize.
 * @returns The base64-encoded JSON string.
 */
function encodeHeader(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

describe("VdmNexusActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
  });

  describe("schema validation", () => {
    describe("NexusChatSchema", () => {
      it("accepts a minimal valid input", () => {
        const r = NexusChatSchema.safeParse({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
        });
        expect(r.success).toBe(true);
      });

      it("accepts a per-call network override", () => {
        const r = NexusChatSchema.safeParse({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          network: "solana:mainnet",
        });
        expect(r.success).toBe(true);
      });

      it("rejects empty messages", () => {
        const r = NexusChatSchema.safeParse({
          model: "openai/gpt-4o-mini",
          messages: [],
        });
        expect(r.success).toBe(false);
      });

      it("rejects unknown role", () => {
        const r = NexusChatSchema.safeParse({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "tool", content: "hi" }],
        });
        expect(r.success).toBe(false);
      });
    });

    describe("NexusVerifyReceiptSchema", () => {
      it("accepts messages-array prompt + object response", () => {
        const r = NexusVerifyReceiptSchema.safeParse({
          receipt: MOCK_RECEIPT,
          prompt: [{ role: "user", content: "hi" }],
          response: { choices: [] },
        });
        expect(r.success).toBe(true);
      });

      it("accepts string prompt + string response (prepaid receipt shape)", () => {
        const r = NexusVerifyReceiptSchema.safeParse({
          receipt: MOCK_RECEIPT,
          prompt: "what is 2+2?",
          response: "4",
        });
        expect(r.success).toBe(true);
      });
    });

    describe("NexusGetDepositAddressSchema", () => {
      it("accepts an empty input", () => {
        const r = NexusGetDepositAddressSchema.safeParse({});
        expect(r.success).toBe(true);
      });

      it("accepts a network override", () => {
        const r = NexusGetDepositAddressSchema.safeParse({ network: "solana:mainnet" });
        expect(r.success).toBe(true);
      });
    });
  });

  describe("supportsNetwork", () => {
    const provider = vdmNexusActionProvider();

    it("returns true for SVM networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "svm",
          networkId: "solana-mainnet",
        }),
      ).toBe(true);
    });

    it("returns false for EVM networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      ).toBe(false);
    });
  });

  describe("nexusGetDepositAddress", () => {
    it("returns the address on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: "4nTiDhEbCFJtfPsi49rPGam8R5azUQNZHpb49CLYxiSv",
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          network: "solana:mainnet",
        }),
      });

      const provider = vdmNexusActionProvider({ endpoint: MOCK_ENDPOINT });
      const result = await provider.nexusGetDepositAddress({});
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.address).toBe("4nTiDhEbCFJtfPsi49rPGam8R5azUQNZHpb49CLYxiSv");
      expect(parsed.network).toBe("solana:mainnet");
      expect(fetchMock).toHaveBeenCalledWith(`${MOCK_ENDPOINT}/deposit-address`);
    });

    it("passes the network query param when supplied", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: "x", mint: "y", network: "solana:devnet" }),
      });

      const provider = vdmNexusActionProvider({ endpoint: MOCK_ENDPOINT });
      await provider.nexusGetDepositAddress({ network: "solana:devnet" });

      expect(fetchMock).toHaveBeenCalledWith(
        `${MOCK_ENDPOINT}/deposit-address?network=solana%3Adevnet`,
      );
    });

    it("returns an error result on non-2xx", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

      const provider = vdmNexusActionProvider({ endpoint: MOCK_ENDPOINT });
      const result = await provider.nexusGetDepositAddress({});
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("deposit_address_fetch_failed");
      expect(parsed.status).toBe(503);
    });
  });

  describe("nexusVerifyReceipt", () => {
    it("delegates to verifyReceipt and returns the check breakdown", async () => {
      verifyReceiptMock.mockResolvedValueOnce({
        ok: true,
        checks: {
          prompt_hash_ok: true,
          response_hash_ok: true,
          nexus_signature_ok: true,
          payment_on_chain_ok: true,
          payer_matches: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const provider = vdmNexusActionProvider({
        endpoint: MOCK_ENDPOINT,
        operatorKey: "pinned-key",
      });
      const result = await provider.nexusVerifyReceipt({
        receipt: MOCK_RECEIPT,
        prompt: [{ role: "user", content: "hi" }],
        response: { choices: [] },
      });
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.checks.nexus_signature_ok).toBe(true);
      expect(verifyReceiptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: MOCK_ENDPOINT,
          operatorKey: "pinned-key",
        }),
      );
    });

    it("returns a verify_failed error when the verifier throws", async () => {
      verifyReceiptMock.mockRejectedValueOnce(new Error("rpc dead"));

      const provider = vdmNexusActionProvider();
      const result = await provider.nexusVerifyReceipt({
        receipt: MOCK_RECEIPT,
        prompt: "what is 2+2?",
        response: "4",
      });
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("verify_failed");
      expect(parsed.detail).toBe("rpc dead");
    });
  });

  describe("nexusChat", () => {
    /**
     * Build a stub SvmWalletProvider whose getKeyPairSigner returns a
     * placeholder — the @x402/svm import is mocked so the placeholder is
     * never actually used.
     *
     * @returns A typed stub SvmWalletProvider.
     */
    function mockWallet(): SvmWalletProvider {
      return {
        getKeyPairSigner: jest.fn().mockResolvedValue({ address: "mock-pubkey" }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }

    /**
     * Wire the next x402Client construction to return a client whose
     * createPaymentPayload resolves to the given canned payment object.
     *
     * @param payment - The payment payload the mock client should return.
     */
    function mockX402Client(payment: object) {
      x402ClientMock.mockImplementationOnce(() => ({
        register: jest.fn(),
        createPaymentPayload: jest.fn().mockResolvedValue(payment),
      }));
    }

    it("runs the full handshake and returns the receipt", async () => {
      const challenge = { accepts: [{ network: "solana:mainnet", scheme: "exact" }] };
      const payment = { network: "solana:mainnet", scheme: "exact", payload: "signed" };
      const openai = { id: "chatcmpl-xyz", choices: [{ message: { content: "hi" } }] };

      fetchMock
        .mockResolvedValueOnce({
          status: 402,
          headers: {
            get: (k: string) => (k === "x-payment-required" ? encodeHeader(challenge) : null),
          },
          text: async () => "",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (k: string) => {
              if (k === "x-nexus-receipt") return encodeHeader(MOCK_RECEIPT);
              if (k === "x-payment-response") return encodeHeader({ transaction: "tx-sig" });
              return null;
            },
          },
          json: async () => openai,
        });

      mockX402Client(payment);

      const provider = vdmNexusActionProvider({ endpoint: MOCK_ENDPOINT });
      const result = await provider.nexusChat(mockWallet(), {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      });
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.openai.id).toBe("chatcmpl-xyz");
      expect(parsed.receipt.inference_id).toBe("test-receipt-id");
      expect(parsed.payment.transaction).toBe("tx-sig");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("returns an error if the probe does not return 402", async () => {
      fetchMock.mockResolvedValueOnce({
        status: 500,
        headers: { get: () => null },
        text: async () => "boom",
      });

      const provider = vdmNexusActionProvider({ endpoint: MOCK_ENDPOINT });
      const result = await provider.nexusChat(mockWallet(), {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      });
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("x402_probe_failed");
    });

    it("returns x402_missing_challenge when the 402 has no challenge header", async () => {
      fetchMock.mockResolvedValueOnce({
        status: 402,
        headers: { get: () => null },
        text: async () => "",
      });

      const provider = vdmNexusActionProvider({ endpoint: MOCK_ENDPOINT });
      const result = await provider.nexusChat(mockWallet(), {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      });
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("x402_missing_challenge");
    });

    it("returns x402_payment_replay on 409 from the paid retry", async () => {
      const challenge = { accepts: [{ network: "solana:mainnet", scheme: "exact" }] };

      fetchMock
        .mockResolvedValueOnce({
          status: 402,
          headers: {
            get: (k: string) => (k === "x-payment-required" ? encodeHeader(challenge) : null),
          },
          text: async () => "",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          headers: { get: () => null },
          json: async () => ({}),
        });

      mockX402Client({ network: "solana:mainnet", scheme: "exact" });

      const provider = vdmNexusActionProvider({ endpoint: MOCK_ENDPOINT });
      const result = await provider.nexusChat(mockWallet(), {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      });
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("x402_payment_replay");
    });
  });

  describe("constructor", () => {
    it("normalizes a trailing-slash endpoint", () => {
      const provider = new VdmNexusActionProvider({
        endpoint: "https://example.com/api/v1/",
      });
      // Indirect check: a subsequent fetch should target the path without
      // a doubled slash.
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: "x", mint: "y", network: "solana:mainnet" }),
      });
      return provider.nexusGetDepositAddress({}).then(() => {
        expect(fetchMock).toHaveBeenCalledWith("https://example.com/api/v1/deposit-address");
      });
    });
  });
});
