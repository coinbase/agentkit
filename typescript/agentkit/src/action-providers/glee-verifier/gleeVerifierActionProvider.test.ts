import {
  gleeVerifierActionProvider,
  GleeVerifierActionProvider,
  BASE_CHAIN_ID,
  BASE_USDC_MAINNET_ADDRESS,
} from "./gleeVerifierActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

describe("GleeVerifierActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  let provider: GleeVerifierActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
    provider = gleeVerifierActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
      signTypedData: jest.fn().mockResolvedValue("0xabcdef123456"),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("supportsNetwork", () => {
    it("should support base-mainnet", () => {
      const network: Network = {
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      };
      expect(provider.supportsNetwork(network)).toBe(true);
    });

    it("should reject solana", () => {
      const network: Network = {
        protocolFamily: "svm",
        networkId: "solana-mainnet",
      };
      expect(provider.supportsNetwork(network)).toBe(false);
    });
  });

  describe("verifyPatch", () => {
    it("should perform 402 discovery, sign EIP-3009 authorization, and submit paid verification", async () => {
      const mockChallenge = {
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            amount: "50000",
            asset: BASE_USDC_MAINNET_ADDRESS,
            payTo: "0x316fe27b443c87398d89cFFebd6a2a2f50210234",
          },
        ],
      };

      const mockSuccessResult = {
        ok: true,
        result: {
          verdict: "PASS",
          score: 100,
          modified_files: ["src/index.js"],
          stats: { added_lines: 1, deleted_lines: 1 },
          acceptance_receipt: {
            receipt_schema: "glee.acceptance_receipt.v0",
            outcome: "PASS",
            signature: "ed25519_sig_test",
          },
        },
      };

      fetchMock
        .mockResolvedValueOnce({
          status: 402,
          json: async () => mockChallenge,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockSuccessResult),
        });

      const patchArgs = {
        patch: "diff --git a/src/index.js b/src/index.js\n--- a/src/index.js\n+++ b/src/index.js\n@@ -1 +1 @@\n-old\n+new",
        path_policy: { allowed_paths: ["src/"] },
        assertions: [{ type: "contains" as const, pattern: "new" }],
        job_id: "test-job-123",
      };

      const result = await provider.verifyPatch(mockWallet, patchArgs);
      const parsed = JSON.parse(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.result.verdict).toBe("PASS");
      expect(mockWallet.getAddress).toHaveBeenCalled();
      expect(mockWallet.signTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: expect.objectContaining({
            chainId: BASE_CHAIN_ID,
            verifyingContract: BASE_USDC_MAINNET_ADDRESS,
          }),
          primaryType: "TransferWithAuthorization",
        }),
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should handle verifier connection failure gracefully", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network connection refused"));

      const result = await provider.verifyPatch(mockWallet, {
        patch: "diff --git a/a b/b\n+test",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain("GLEE patch verification failed");
    });
  });
});
