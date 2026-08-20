import { basePayActionProvider } from "./basepayActionProvider";
import {
  SendUsdcSchema,
  SendUsdcGaslessSchema,
  BatchPayUsdcSchema,
  CreateEscrowSchema,
  SubscribeSchema,
} from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
const MOCK_RECIPIENT = "0xaabbccddee112233445566778899001122334455";
const MOCK_TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab" as `0x${string}`;
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
    const recipients = Array.from({ length: 201 }, () => ({
      address: MOCK_RECIPIENT,
      amount: "1",
    }));
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
      CreateEscrowSchema.safeParse({
        payee: MOCK_RECIPIENT,
        amount: "100",
        unlockAfterSeconds: 86400,
      }).success,
    ).toBe(true);
  });
  it("rejects unlock period below minimum (60s)", () => {
    expect(
      CreateEscrowSchema.safeParse({ payee: MOCK_RECIPIENT, amount: "100", unlockAfterSeconds: 30 })
        .success,
    ).toBe(false);
  });
  it("rejects invalid payee address", () => {
    expect(
      CreateEscrowSchema.safeParse({ payee: "bad", amount: "100", unlockAfterSeconds: 86400 })
        .success,
    ).toBe(false);
  });
});

describe("SubscribeSchema", () => {
  it("parses valid monthly subscription", () => {
    expect(
      SubscribeSchema.safeParse({ payee: MOCK_RECIPIENT, amount: "9.99", intervalSeconds: 2592000 })
        .success,
    ).toBe(true);
  });
  it("rejects interval below minimum (3600s)", () => {
    expect(
      SubscribeSchema.safeParse({ payee: MOCK_RECIPIENT, amount: "9.99", intervalSeconds: 60 })
        .success,
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
      const result = await provider.batchPayUsdc(mockWallet, {
        recipients: twoRecipients,
        memo: "",
      });
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
      const result = await provider.batchPayUsdc(mockWallet, {
        recipients: twoRecipients,
        memo: "",
      });
      expect(result).toContain("Error in batch payment");
      expect(result).toContain("execution reverted");
    });
  });

  // ── createEscrow ──
  describe("createEscrow", () => {
    const escrowArgs = {
      payee: MOCK_RECIPIENT,
      amount: "100",
      unlockAfterSeconds: 86400,
      memo: "test",
    };

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
      const result = await provider.sendUsdcGasless(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "5",
      });
      expect(mockWallet.signTypedData).toHaveBeenCalledTimes(1);
      const callArgs = (mockWallet.signTypedData as jest.Mock).mock.calls[0][0];
      expect(callArgs.primaryType).toBe("TransferWithAuthorization");
      expect(result).toContain("5 USDC");
      expect(result).toContain(MOCK_RECIPIENT);
      expect(result).toContain("basescan.org/tx");
    });

    it("returns an error when wallet does not support signTypedData", async () => {
      const walletNoSign = {
        ...mockWallet,
        signTypedData: undefined,
      } as unknown as EvmWalletProvider;
      const result = await provider.sendUsdcGasless(walletNoSign, {
        to: MOCK_RECIPIENT,
        amount: "5",
      });
      expect(result).toContain("does not support signTypedData");
    });

    it("returns an error when the relay responds with an error", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
        json: async () => ({ error: "invalid signature" }),
      } as unknown as Response);
      const result = await provider.sendUsdcGasless(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "5",
      });
      expect(result).toContain("Relay error");
      expect(result).toContain("invalid signature");
    });

    it("returns an error when the relay fetch throws", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("network timeout"));
      const result = await provider.sendUsdcGasless(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "5",
      });
      expect(result).toContain("Error calling BasePay relay");
      expect(result).toContain("network timeout");
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Policy hook: two-layer execution-boundary matrix (Fix 7)
// ══════════════════════════════════════════════════════════════════════════════
//
// Layer 1 — Authority gate: assertions that fire BEFORE the first irreversible
//   operation. Tests assert the operation was NOT called on policy failure.
//
// Layer 2 — Settlement outcome: assertions that fire AFTER the chain/relay
//   result. Tests assert the correct outcome tag ([executed], [failed],
//   [relay_confirmed]) appears in the return string.
// ══════════════════════════════════════════════════════════════════════════════

import { actionContextHash, recipientAllocationHash } from "../../policy/utils";
import type { PolicyDecision } from "../../policy/interfaces";

jest.mock("../../policy/utils", () => ({
  actionContextHash: jest.fn(),
  recipientAllocationHash: jest.fn(),
}));

const MOCK_HASH = "a".repeat(64);

function decision(overrides?: Partial<PolicyDecision>): PolicyDecision {
  return {
    allowed: true,
    policy_version: "1",
    action_context_hash: MOCK_HASH,
    decision_ref: "ref-" + Math.random().toString(36).slice(2, 10),
    issued_at_ms: Date.now(),
    expires_at_ms: Date.now() + 60_000,
    ...overrides,
  };
}

describe("Policy hook — Layer 1: authority gate", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockEvaluate: jest.Mock;
  let mockRecord: jest.Mock;

  beforeEach(() => {
    (actionContextHash as jest.Mock).mockResolvedValue(MOCK_HASH);
    (recipientAllocationHash as jest.Mock).mockResolvedValue(MOCK_HASH);

    mockEvaluate = jest.fn().mockResolvedValue(decision());
    mockRecord = jest.fn().mockResolvedValue(undefined);
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ chainId: "8453" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success", logs: [] }),
      readContract: jest.fn().mockResolvedValue(0n),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIG),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ txHash: MOCK_TX_HASH }),
    } as unknown as Response);
  });

  function providerWith() {
    return basePayActionProvider({
      policyProvider: { evaluate: mockEvaluate, record: mockRecord },
    });
  }

  // ── sendUsdc: first authority step = sendTransaction ──────────────────────

  describe("sendUsdc — first authority step: sendTransaction", () => {
    it("policy_denied blocks before sendTransaction", async () => {
      mockEvaluate.mockResolvedValue(decision({ allowed: false, reason_codes: ["spend_limit"] }));
      const result = await providerWith().sendUsdc(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "10",
      });
      expect(result).toContain("policy_denied");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "denied",
          error: "policy_denied: spend_limit",
        }),
      );
    });

    it("unbound_execution (missing decision_ref) blocks before sendTransaction", async () => {
      mockEvaluate.mockResolvedValue(decision({ decision_ref: "" }));
      const result = await providerWith().sendUsdc(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "10",
      });
      expect(result).toContain("unbound_execution: missing decision_ref");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("policy_unverifiable (expired TTL) blocks before sendTransaction", async () => {
      mockEvaluate.mockResolvedValue(decision({ expires_at_ms: Date.now() - 1000 }));
      const result = await providerWith().sendUsdc(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "10",
      });
      expect(result).toContain("policy_unverifiable");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("context_drift (hash mismatch) blocks before sendTransaction", async () => {
      mockEvaluate.mockResolvedValue(decision({ action_context_hash: "wrong-hash" }));
      const result = await providerWith().sendUsdc(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "10",
      });
      expect(result).toContain("context_drift");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("duplicate decision_ref blocks second call before sendTransaction", async () => {
      const ref = "fixed-ref-abc";
      mockEvaluate.mockResolvedValue(decision({ decision_ref: ref }));
      const p = providerWith();
      // First call: succeeds
      await p.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "1" });
      // Second call with same ref: consumed — must not reach sendTransaction again
      const sendCallsBefore = (mockWallet.sendTransaction as jest.Mock).mock.calls.length;
      const result = await p.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "1" });
      expect(result).toContain("unbound_execution: duplicate decision_ref");
      expect((mockWallet.sendTransaction as jest.Mock).mock.calls.length).toBe(sendCallsBefore);
    });
  });

  // ── sendUsdcGasless: first authority step = signTypedData ─────────────────

  describe("sendUsdcGasless — first authority step: signTypedData", () => {
    it("policy_denied blocks before signTypedData", async () => {
      mockEvaluate.mockResolvedValue(decision({ allowed: false }));
      const result = await providerWith().sendUsdcGasless(mockWallet, {
        to: MOCK_RECIPIENT,
        amount: "5",
      });
      expect(result).toContain("policy_denied");
      expect(mockWallet.signTypedData).not.toHaveBeenCalled();
    });

    it("duplicate decision_ref blocks second call before signTypedData", async () => {
      const ref = "gasless-fixed-ref";
      mockEvaluate.mockResolvedValue(decision({ decision_ref: ref }));
      const p = providerWith();
      await p.sendUsdcGasless(mockWallet, { to: MOCK_RECIPIENT, amount: "5" });
      const signCallsBefore = (mockWallet.signTypedData as jest.Mock).mock.calls.length;
      const result = await p.sendUsdcGasless(mockWallet, { to: MOCK_RECIPIENT, amount: "5" });
      expect(result).toContain("unbound_execution: duplicate decision_ref");
      expect((mockWallet.signTypedData as jest.Mock).mock.calls.length).toBe(signCallsBefore);
    });
  });

  // ── batchPayUsdc: first authority step = ensureAllowance ─────────────────

  describe("batchPayUsdc — first authority step: ensureAllowance", () => {
    const recipients = [{ address: MOCK_RECIPIENT, amount: "5" }];

    it("policy_denied blocks before ensureAllowance (readContract not called)", async () => {
      mockEvaluate.mockResolvedValue(decision({ allowed: false }));
      const result = await providerWith().batchPayUsdc(mockWallet, { recipients, memo: "" });
      expect(result).toContain("policy_denied");
      expect(mockWallet.readContract).not.toHaveBeenCalled();
    });

    it("duplicate decision_ref blocks second call before ensureAllowance", async () => {
      const ref = "batch-fixed-ref";
      mockEvaluate.mockResolvedValue(decision({ decision_ref: ref }));
      const p = providerWith();
      await p.batchPayUsdc(mockWallet, { recipients, memo: "" });
      const readCallsBefore = (mockWallet.readContract as jest.Mock).mock.calls.length;
      const result = await p.batchPayUsdc(mockWallet, { recipients, memo: "" });
      expect(result).toContain("unbound_execution: duplicate decision_ref");
      expect((mockWallet.readContract as jest.Mock).mock.calls.length).toBe(readCallsBefore);
    });

    it("context_drift: changed recipient_allocation_hash at execution boundary blocks before ensureAllowance", async () => {
      // First call to recipientAllocationHash (ctx build) returns MOCK_HASH — matches decision.
      // Second call (execution-time re-derivation) returns a different hash — triggers context_drift.
      let callCount = 0;
      (recipientAllocationHash as jest.Mock).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? MOCK_HASH : "execution-hash-differs-" + "b".repeat(44);
      });
      const result = await providerWith().batchPayUsdc(mockWallet, { recipients, memo: "" });
      expect(result).toContain("context_drift");
      expect(mockWallet.readContract).not.toHaveBeenCalled();
      expect(mockRecord).toHaveBeenLastCalledWith(
        expect.objectContaining({
          outcome: "context_drift",
          error: "context_drift",
        }),
      );
    });
  });

  // ── createEscrow: first authority step = ensureAllowance ─────────────────

  describe("createEscrow — first authority step: ensureAllowance", () => {
    const escrowArgs = {
      payee: MOCK_RECIPIENT,
      amount: "100",
      unlockAfterSeconds: 86400,
      memo: "",
    };

    it("policy_denied blocks before ensureAllowance", async () => {
      mockEvaluate.mockResolvedValue(decision({ allowed: false }));
      const result = await providerWith().createEscrow(mockWallet, escrowArgs);
      expect(result).toContain("policy_denied");
      expect(mockWallet.readContract).not.toHaveBeenCalled();
    });

    it("duplicate decision_ref blocks second call before ensureAllowance", async () => {
      const ref = "escrow-fixed-ref";
      mockEvaluate.mockResolvedValue(decision({ decision_ref: ref }));
      const p = providerWith();
      await p.createEscrow(mockWallet, escrowArgs);
      const readCallsBefore = (mockWallet.readContract as jest.Mock).mock.calls.length;
      const result = await p.createEscrow(mockWallet, escrowArgs);
      expect(result).toContain("unbound_execution: duplicate decision_ref");
      expect((mockWallet.readContract as jest.Mock).mock.calls.length).toBe(readCallsBefore);
    });
  });

  // ── subscribe (creation): first authority step = ensureAllowance ──────────

  describe("subscribe (creation) — first authority step: ensureAllowance", () => {
    const subArgs = { payee: MOCK_RECIPIENT, amount: "9.99", intervalSeconds: 2592000, memo: "" };

    it("policy_denied blocks before ensureAllowance", async () => {
      mockEvaluate.mockResolvedValue(decision({ allowed: false }));
      const result = await providerWith().subscribe(mockWallet, subArgs);
      expect(result).toContain("policy_denied");
      expect(mockWallet.readContract).not.toHaveBeenCalled();
    });

    it("duplicate decision_ref blocks second creation before ensureAllowance", async () => {
      const ref = "sub-fixed-ref";
      mockEvaluate.mockResolvedValue(decision({ decision_ref: ref }));
      const p = providerWith();
      await p.subscribe(mockWallet, subArgs);
      const readCallsBefore = (mockWallet.readContract as jest.Mock).mock.calls.length;
      const result = await p.subscribe(mockWallet, subArgs);
      expect(result).toContain("unbound_execution: duplicate decision_ref");
      expect((mockWallet.readContract as jest.Mock).mock.calls.length).toBe(readCallsBefore);
    });

    it("subscribe without policyProvider succeeds — charge() is a separate authority plane", async () => {
      // No policyProvider injected: subscribe proceeds without any policy evaluation.
      // This asserts that charge() calls (which happen via on-chain interaction, not
      // through this provider) are not governed by the creation decision_ref.
      const p = basePayActionProvider(); // no policyProvider
      const result = await p.subscribe(mockWallet, subArgs);
      expect(mockEvaluate).not.toHaveBeenCalled();
      expect(result).toContain("[executed]");
    });
  });
});

// ── Layer 2: Settlement outcome assertions ────────────────────────────────────

describe("Policy hook — Layer 2: settlement outcomes", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockEvaluate: jest.Mock;
  let mockRecord: jest.Mock;

  beforeEach(() => {
    (actionContextHash as jest.Mock).mockResolvedValue(MOCK_HASH);
    (recipientAllocationHash as jest.Mock).mockResolvedValue(MOCK_HASH);
    mockEvaluate = jest.fn().mockResolvedValue(decision());
    mockRecord = jest.fn().mockResolvedValue(undefined);

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ chainId: "8453" }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success", logs: [] }),
      readContract: jest.fn().mockResolvedValue(BigInt(999_999_999)),
      signTypedData: jest.fn().mockResolvedValue(MOCK_SIG),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ txHash: MOCK_TX_HASH }),
    } as unknown as Response);
  });

  const noPolicy = () => basePayActionProvider();
  const withRecordingPolicy = () =>
    basePayActionProvider({ policyProvider: { evaluate: mockEvaluate, record: mockRecord } });

  it("sendUsdc: on-chain revert → [failed], not [executed]", async () => {
    mockWallet.waitForTransactionReceipt = jest
      .fn()
      .mockResolvedValue({ status: "reverted", logs: [] });
    const result = await noPolicy().sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "10" });
    expect(result).toContain("[failed]");
    expect(result).not.toContain("[executed]");
  });

  it("sendUsdc: on-chain success → [executed], not [failed]", async () => {
    const result = await noPolicy().sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "10" });
    expect(result).toContain("[executed]");
    expect(result).not.toContain("[failed]");
  });

  it("sendUsdcGasless: relay HTTP 200 → [relay_confirmed], not [executed]", async () => {
    const result = await noPolicy().sendUsdcGasless(mockWallet, {
      to: MOCK_RECIPIENT,
      amount: "5",
    });
    expect(result).toContain("[relay_confirmed]");
    expect(result).not.toContain("[executed]");
  });

  it("sendUsdc success records executed with tx hash", async () => {
    const result = await withRecordingPolicy().sendUsdc(mockWallet, {
      to: MOCK_RECIPIENT,
      amount: "10",
    });
    expect(result).toContain("[executed]");
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "executed",
        tx_hash: MOCK_TX_HASH,
      }),
    );
  });

  it("sendUsdc revert records failed with tx hash", async () => {
    mockWallet.waitForTransactionReceipt = jest
      .fn()
      .mockResolvedValue({ status: "reverted", logs: [] });
    const result = await withRecordingPolicy().sendUsdc(mockWallet, {
      to: MOCK_RECIPIENT,
      amount: "10",
    });
    expect(result).toContain("[failed]");
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        tx_hash: MOCK_TX_HASH,
      }),
    );
  });

  it("sendUsdcGasless relay acceptance records relay_confirmed", async () => {
    const result = await withRecordingPolicy().sendUsdcGasless(mockWallet, {
      to: MOCK_RECIPIENT,
      amount: "5",
    });
    expect(result).toContain("[relay_confirmed]");
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "relay_confirmed",
        tx_hash: MOCK_TX_HASH,
      }),
    );
  });

  it("batchPayUsdc: on-chain revert → [failed], not [executed]", async () => {
    mockWallet.waitForTransactionReceipt = jest
      .fn()
      .mockResolvedValue({ status: "reverted", logs: [] });
    const result = await noPolicy().batchPayUsdc(mockWallet, {
      recipients: [{ address: MOCK_RECIPIENT, amount: "5" }],
      memo: "",
    });
    expect(result).toContain("[failed]");
    expect(result).not.toContain("[executed]");
  });

  it("batchPayUsdc: on-chain success → [executed]", async () => {
    const result = await noPolicy().batchPayUsdc(mockWallet, {
      recipients: [{ address: MOCK_RECIPIENT, amount: "5" }],
      memo: "",
    });
    expect(result).toContain("[executed]");
  });

  it("createEscrow: on-chain revert → [failed], not [executed]", async () => {
    mockWallet.waitForTransactionReceipt = jest
      .fn()
      .mockResolvedValue({ status: "reverted", logs: [] });
    const result = await noPolicy().createEscrow(mockWallet, {
      payee: MOCK_RECIPIENT,
      amount: "100",
      unlockAfterSeconds: 86400,
      memo: "",
    });
    expect(result).toContain("[failed]");
    expect(result).not.toContain("[executed]");
  });

  it("createEscrow: on-chain success → [executed]", async () => {
    const result = await noPolicy().createEscrow(mockWallet, {
      payee: MOCK_RECIPIENT,
      amount: "100",
      unlockAfterSeconds: 86400,
      memo: "",
    });
    expect(result).toContain("[executed]");
  });

  it("subscribe: on-chain revert → [failed], not [executed]", async () => {
    mockWallet.waitForTransactionReceipt = jest
      .fn()
      .mockResolvedValue({ status: "reverted", logs: [] });
    const result = await noPolicy().subscribe(mockWallet, {
      payee: MOCK_RECIPIENT,
      amount: "9.99",
      intervalSeconds: 2592000,
      memo: "",
    });
    expect(result).toContain("[failed]");
    expect(result).not.toContain("[executed]");
  });

  it("subscribe: on-chain success → [executed]", async () => {
    const result = await noPolicy().subscribe(mockWallet, {
      payee: MOCK_RECIPIENT,
      amount: "9.99",
      intervalSeconds: 2592000,
      memo: "",
    });
    expect(result).toContain("[executed]");
  });

  describe("policy outcomes are distinct from chain/relay errors", () => {
    let mockEvaluate: jest.Mock;
    let p: ReturnType<typeof basePayActionProvider>;

    beforeEach(() => {
      (actionContextHash as jest.Mock).mockResolvedValue(MOCK_HASH);
      mockEvaluate = jest.fn();
      p = basePayActionProvider({ policyProvider: { evaluate: mockEvaluate } });
    });

    it("policy_denied is in the result string — not a sendTransaction error", async () => {
      mockEvaluate.mockResolvedValue(decision({ allowed: false }));
      const result = await p.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "1" });
      expect(result).toContain("policy_denied");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("unbound_execution is in the result string — not a wallet error", async () => {
      mockEvaluate.mockResolvedValue(decision({ decision_ref: "" }));
      const result = await p.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "1" });
      expect(result).toContain("unbound_execution: missing decision_ref");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("policy_unverifiable is in the result string — not a chain error", async () => {
      mockEvaluate.mockResolvedValue(decision({ expires_at_ms: Date.now() - 1 }));
      const result = await p.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "1" });
      expect(result).toContain("policy_unverifiable");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("context_drift is in the result string — not a wallet/relay/chain error", async () => {
      mockEvaluate.mockResolvedValue(decision({ action_context_hash: "mismatch" }));
      const result = await p.sendUsdc(mockWallet, { to: MOCK_RECIPIENT, amount: "1" });
      expect(result).toContain("context_drift");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });
  });
});
