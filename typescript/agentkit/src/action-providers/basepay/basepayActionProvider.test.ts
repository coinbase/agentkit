import { basePayActionProvider } from "./basepayActionProvider";
  import {
    SendUsdcSchema,
    SendUsdcGaslessSchema,
    BatchPayUsdcSchema,
    CreateEscrowSchema,
    SubscribeSchema,
  } from "./schemas";
  import { EvmWalletProvider } from "../../wallet-providers";

  const MOCK_ADDRESS   = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_RECIPIENT = "0xaabbccddee112233445566778899001122334455";
  const MOCK_TX_HASH   = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab" as `0x${string}`;
  // 65-byte signature (r + s + v) in hex
  const MOCK_SIG = ("0x" + "ab".repeat(32) + "cd".repeat(32) + "1b") as `0x${string}`;

  // ── Schema tests ──────────────────────────────────────────────────────────────

  describe("SendUsdcSchema", () => {
    it("parses valid input", () => {
      expect(SendUsdcSchema.safeParse({ to: MOCK_RECIPIENT, amount: "10.5" }).success).toBe(true);
    });
    it("rejects an invalid address", () => {
      expect(SendUsdcSchema.safeParse({ to: "not-an-address", amount: "10" }).success).toBe(false);
    });
    it("rejects missing amount", () => {
      expect(SendUsdcSchema.safeParse({ to: MOCK_RECIPIENT }).success).toBe(false);
    });
  });

  describe("SendUsdcGaslessSchema", () => {
    it("parses valid input", () => {
      expect(SendUsdcGaslessSchema.safeParse({ to: MOCK_RECIPIENT, amount: "5" }).success).toBe(true);
    });
    it("rejects invalid address", () => {
      expect(SendUsdcGaslessSchema.safeParse({ to: "bad", amount: "5" }).success).toBe(false);
    });
  });

  describe("BatchPayUsdcSchema", () => {
    it("parses valid recipients", () => {
      const result = BatchPayUsdcSchema.safeParse({
        recipients: [{ address: MOCK_RECIPIENT, amount: "5.0" }],
      });
      expect(result.success).toBe(true);
    });
    it("rejects empty recipients array", () => {
      expect(BatchPayUsdcSchema.safeParse({ recipients: [] }).success).toBe(false);
    });
    it("rejects more than 200 recipients", () => {
      const recipients = Array.from({ length: 201 }, () => ({ address: MOCK_RECIPIENT, amount: "1" }));
      expect(BatchPayUsdcSchema.safeParse({ recipients }).success).toBe(false);
    });
    it("rejects invalid recipient address", () => {
      expect(
        BatchPayUsdcSchema.safeParse({ recipients: [{ address: "bad", amount: "1" }] }).success,
      ).toBe(false);
    });
  });

  describe("CreateEscrowSchema", () => {
    it("parses valid input", () => {
      expect(
        CreateEscrowSchema.safeParse({ payee: MOCK_RECIPIENT, amount: "100", unlockAfterSeconds: 86400 }).success,
      ).toBe(true);
    });
    it("rejects unlock period below minimum (60s)", () => {
      expect(
        CreateEscrowSchema.safeParse({ payee: MOCK_RECIPIENT, amount: "100", unlockAfterSeconds: 30 }).success,
      ).toBe(false);
    });
    it("rejects invalid payee address", () => {
      expect(
        CreateEscrowSchema.safeParse({ payee: "bad", amount: "100", unlockAfterSeconds: 86400 }).success,
      ).toBe(false);
    });
  });

  describe("SubscribeSchema", () => {
    it("parses valid monthly subscription", () => {
      expect(
        SubscribeSchema.safeParse({ payee: MOCK_RECIPIENT, amount: "9.99", intervalSeconds: 2592000 }).success,
      ).toBe(true);
    });
    it("rejects interval below minimum (3600s)", () => {
      expect(
        SubscribeSchema.safeParse({ payee: MOCK_RECIPIENT, amount: "9.99", intervalSeconds: 60 }).success,
      ).toBe(false);
    });
  });

  // ── Action tests ──────────────────────────────────────────────────────────────

  describe("BasePay Action Provider", () => {
    let mockWallet: jest.Mocked<EvmWalletProvider>;
    const provider = basePayActionProvider();

    beforeEach(() => {
      mockWallet = {
        getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
        getNetwork: jest.fn().mockReturnValue({ chainId: "8453" }),
        sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({ logs: [] }),
        readContract: jest.fn().mockResolvedValue(0n),
        signTypedData: jest.fn().mockResolvedValue(MOCK_SIG),
      } as unknown as jest.Mocked<EvmWalletProvider>;
    });

    // ── supportsNetwork ──
    describe("supportsNetwork", () => {
      it("supports Base Mainnet (chainId 8453)", () => {
        expect(provider.supportsNetwork({ chainId: "8453", protocolFamily: "evm" })).toBe(true);
      });
      it("does not support Ethereum mainnet", () => {
        expect(provider.supportsNetwork({ chainId: "1", protocolFamily: "evm" })).toBe(false);
      });
    });

    // ── sendUsdc ──
    describe("sendUsdc", () => {
      it("sends USDC and returns a success message with Basescan link", async () => {
        const result = await provider.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "10" });
        expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1);
        expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
        expect(result).toContain("10 USDC");
        expect(result).toContain(MOCK_RECIPIENT);
        expect(result).toContain("basescan.org/tx");
      });

      it("returns an error message when the transaction fails", async () => {
        mockWallet.sendTransaction.mockRejectedValue(new Error("insufficient funds"));
        const result = await provider.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "10" });
        expect(result).toContain("Error sending USDC");
        expect(result).toContain("insufficient funds");
      });
    });

    // ── batchPayUsdc ──
    describe("batchPayUsdc", () => {
      const twoRecipients = [
        { address: MOCK_RECIPIENT, amount: "5" },
        { address: "0x1234567890123456789012345678901234567890", amount: "3" },
      ];

      it("approves then batch-sends when allowance is zero", async () => {
        const result = await provider.batchPayUsdc(mockWallet, { recipients: twoRecipients, memo: "" });
        // approve tx + batchSend tx
        expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2);
        expect(result).toContain("2 recipients");
        expect(result).toContain("basescan.org/tx");
      });

      it("skips approve when allowance is already sufficient", async () => {
        mockWallet.readContract.mockResolvedValue(BigInt(10_000_000)); // 10 USDC atomic
        const result = await provider.batchPayUsdc(mockWallet, {
          recipients: [{ address: MOCK_RECIPIENT, amount: "5" }],
          memo: "",
        });
        // only batchSend — no approve needed
        expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1);
        expect(result).toContain("1 recipients");
      });

      it("returns an error message on contract revert", async () => {
        mockWallet.sendTransaction.mockRejectedValue(new Error("execution reverted"));
        const result = await provider.batchPayUsdc(mockWallet, { recipients: twoRecipients, memo: "" });
        expect(result).toContain("Error in batch payment");
        expect(result).toContain("execution reverted");
      });
    });

    // ── createEscrow ──
    describe("createEscrow", () => {
      const escrowArgs = { payee: MOCK_RECIPIENT, amount: "100", unlockAfterSeconds: 86400, memo: "test" };

      it("approves then creates escrow, returning details", async () => {
        const result = await provider.createEscrow(mockWallet, escrowArgs);
        expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2);
        expect(result).toContain("Escrow created");
        expect(result).toContain(MOCK_RECIPIENT);
        expect(result).toContain("basescan.org/tx");
      });

      it("includes unlock duration in days", async () => {
        const result = await provider.createEscrow(mockWallet, escrowArgs);
        expect(result).toContain("1.0 days");
      });

      it("returns an error message on failure", async () => {
        mockWallet.sendTransaction.mockRejectedValue(new Error("revert: paused"));
        const result = await provider.createEscrow(mockWallet, escrowArgs);
        expect(result).toContain("Error creating escrow");
      });
    });

    // ── subscribe ──
    describe("subscribe", () => {
      const subArgs = { payee: MOCK_RECIPIENT, amount: "9.99", intervalSeconds: 2592000, memo: "" };

      it("approves 24x then subscribes, labelling interval as monthly", async () => {
        const result = await provider.subscribe(mockWallet, subArgs);
        expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2);
        expect(result).toContain("Subscription created");
        expect(result).toContain("monthly");
      });

      it("labels weekly interval correctly", async () => {
        const result = await provider.subscribe(mockWallet, { ...subArgs, intervalSeconds: 604800 });
        expect(result).toContain("weekly");
      });

      it("returns an error message on failure", async () => {
        mockWallet.sendTransaction.mockRejectedValue(new Error("revert"));
        const result = await provider.subscribe(mockWallet, subArgs);
        expect(result).toContain("Error creating subscription");
      });
    });

    // ── sendUsdcGasless ──
    describe("sendUsdcGasless", () => {
      beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ txHash: MOCK_TX_HASH }),
        } as unknown as Response);
      });

      it("signs EIP-3009 typed data and calls the relay, returning success", async () => {
        const result = await provider.sendUsdcGasless(mockWallet, { to: MOCK_RECIPIENT, amount: "5" });
        expect(mockWallet.signTypedData).toHaveBeenCalledTimes(1);
        const callArgs = (mockWallet.signTypedData as jest.Mock).mock.calls[0][0];
        expect(callArgs.primaryType).toBe("TransferWithAuthorization");
        expect(result).toContain("5 USDC");
        expect(result).toContain(MOCK_RECIPIENT);
        expect(result).toContain("basescan.org/tx");
      });

      it("returns an error when wallet does not support signTypedData", async () => {
        const walletNoSign = { ...mockWallet, signTypedData: undefined } as unknown as EvmWalletProvider;
        const result = await provider.sendUsdcGasless(walletNoSign, { to: MOCK_RECIPIENT, amount: "5" });
        expect(result).toContain("does not support signTypedData");
      });

      it("returns an error when the relay responds with an error", async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          statusText: "Bad Request",
          json: async () => ({ error: "invalid signature" }),
        } as unknown as Response);
        const result = await provider.sendUsdcGasless(mockWallet, { to: MOCK_RECIPIENT, amount: "5" });
        expect(result).toContain("Relay error");
        expect(result).toContain("invalid signature");
      });

      it("returns an error when the relay fetch throws", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("network timeout"));
        const result = await provider.sendUsdcGasless(mockWallet, { to: MOCK_RECIPIENT, amount: "5" });
        expect(result).toContain("Error calling BasePay relay");
        expect(result).toContain("network timeout");
      });
    });
  });
  