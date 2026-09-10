import { UcpActionProvider, ucpActionProvider } from "./ucpActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

describe("UcpActionProvider", () => {
  let provider: UcpActionProvider;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    provider = ucpActionProvider();

    mockWalletProvider = {
      getAddress: jest.fn().mockResolvedValue("0x1111111111111111111111111111111111111111"),
      getNetwork: jest.fn().mockResolvedValue({
        protocolFamily: "evm",
        networkId: "base",
      } as Network),
      signTypedData: jest.fn().mockResolvedValue("0xabcdef1234567890"),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("supportsNetwork", () => {
    it("should support base and base-sepolia", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "eip155:8453" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana" })).toBe(false);
    });
  });

  describe("actions export", () => {
    it("should register all 5 core actions", () => {
      const actions = provider.getActions(mockWalletProvider);
      const actionNames = actions.map((a) => a.name);

      expect(actionNames).toContain("ucp_discover");
      expect(actionNames).toContain("ucp_quote");
      expect(actionNames).toContain("ucp_compile");
      expect(actionNames).toContain("ucp_pay");
      expect(actionNames).toContain("ucp_verify_receipt");
    });
  });

  describe("ucp_compile", () => {
    it("should pass bounds check and generate payee-binding nonce", async () => {
      const actions = provider.getActions(mockWalletProvider);
      const compileAction = actions.find((a) => a.name === "ucp_compile")!;

      const resultStr = await compileAction.invoke({
        domain: "merchant.example.com",
        sku: "compute-1h",
        quantity: 1,
        totalMinor: "5000000",
        merchantAddress: "0x2222222222222222222222222222222222222222",
        maxPerOrderMinor: "10000000",
        budgetCapMinor: "50000000",
      });

      const result = JSON.parse(resultStr);
      expect(result.success).toBe(true);
      expect(result.boundsAudit).toBe("PASSED");
      expect(result.payeeBindingCommitmentNonce).toBeDefined();
      expect(result.payeeBindingCommitmentNonce).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should reject spend exceeding maxPerOrder", async () => {
      const actions = provider.getActions(mockWalletProvider);
      const compileAction = actions.find((a) => a.name === "ucp_compile")!;

      const resultStr = await compileAction.invoke({
        domain: "merchant.example.com",
        sku: "compute-1h",
        quantity: 1,
        totalMinor: "15000000",
        merchantAddress: "0x2222222222222222222222222222222222222222",
        maxPerOrderMinor: "10000000",
      });

      const result = JSON.parse(resultStr);
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds maxPerOrder cap");
    });
  });

  describe("ucp_pay", () => {
    it("should request EIP-712 signature locally without touching keys", async () => {
      const actions = provider.getActions(mockWalletProvider);
      const payAction = actions.find((a) => a.name === "ucp_pay")!;

      const resultStr = await payAction.invoke({
        domain: "merchant.example.com",
        sessionId: "sess_12345",
        merchantAddress: "0x2222222222222222222222222222222222222222",
        totalMinor: "5000000",
        nonce: "0x" + "aa".repeat(32),
        validUntil: 1800000000,
      });

      const result = JSON.parse(resultStr);
      expect(result.success).toBe(true);
      expect(result.payer).toBe("0x1111111111111111111111111111111111111111");
      expect(mockWalletProvider.signTypedData).toHaveBeenCalled();
      expect(result.settlementStatus).toBe("AUTHORIZED_AND_READY_FOR_DISPATCH");
    });
  });
});
