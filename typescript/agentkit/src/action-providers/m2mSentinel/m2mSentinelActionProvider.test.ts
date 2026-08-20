import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mSentinelActionProvider, M2MSentinelActionProvider } from "./m2mSentinelActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

describe("M2MSentinelActionProvider", () => {
  let provider: M2MSentinelActionProvider;
  let mockWallet: EvmWalletProvider;

  beforeEach(() => {
    provider = m2mSentinelActionProvider();
    mockWallet = {} as unknown as EvmWalletProvider;
    vi.restoreAllMocks();
  });

  it("should have the correct provider name", () => {
    expect(provider.name).toBe("m2m_sentinel");
  });

  it("should support Base networks", () => {
    const baseMainnet: Network = { protocolFamily: "evm", chainId: "8453", networkId: "base-mainnet" };
    const baseSepolia: Network = { protocolFamily: "evm", chainId: "84532", networkId: "base-sepolia" };
    const solana: Network = { protocolFamily: "svm", chainId: "solana", networkId: "solana" };

    expect(provider.supportsNetwork(baseMainnet)).toBe(true);
    expect(provider.supportsNetwork(baseSepolia)).toBe(true);
    expect(provider.supportsNetwork(solana)).toBe(false);
  });

  it("should expose all 4 actions", () => {
    const actions = provider.getActions(mockWallet);
    expect(actions).toHaveLength(4);

    const actionNames = actions.map((a) => a.name);
    expect(actionNames).toContain("m2m_audit_contract");
    expect(actionNames).toContain("m2m_get_gas_metrics");
    expect(actionNames).toContain("m2m_get_token_price");
    expect(actionNames).toContain("m2m_get_service_status");
  });

  it("should handle auditContract successfully", async () => {
    const mockAudit = {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      proxyResolution: { isProxy: true },
      provenance: { trustLevel: "HIGH_TRUST_PRIMARY" },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAudit,
    } as Response);

    const result = await provider.auditContract(mockWallet, {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("SUCCESS");
    expect(parsed.notASafetyGuarantee).toBe(true);
    expect(parsed.data.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });
});
