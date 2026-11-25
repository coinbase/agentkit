import { AgentKit } from "../../agentkit";
import { m2mSentinelActionProvider, M2MSentinelActionProvider } from "./m2mSentinelActionProvider";
import type { EvmWalletProvider } from "../../wallet-providers";
import type { Network } from "../../network";

jest.mock("../../action-providers", () => ({
  ...jest.requireActual("../../action-providers/actionProvider"),
  walletActionProvider: jest.fn(),
}));
jest.mock("../../analytics", () => ({
  sendAnalyticsEvent: jest.fn(),
}));

const BASE_MAINNET: Network = {
  protocolFamily: "evm",
  chainId: "8453",
  networkId: "base-mainnet",
};

/**
 * Creates a local wallet fixture with the requested AgentKit network identity.
 *
 * @param network - Network identity reported by the fixture wallet.
 * @returns A wallet-shaped fixture for AgentKit registration and dispatch.
 */
function createMockWallet(network: Network): EvmWalletProvider {
  return {
    getAddress: () => "0x0000000000000000000000000000000000000001",
    getName: () => "local-test-wallet",
    getNetwork: () => network,
  } as unknown as EvmWalletProvider;
}

describe("M2MSentinelActionProvider", () => {
  let provider: M2MSentinelActionProvider;
  let mockWallet: EvmWalletProvider;

  beforeEach(() => {
    jest.restoreAllMocks();
    provider = m2mSentinelActionProvider({
      baseUrl: "http://127.0.0.1:3000",
      apiKey: "local-test-api-key",
    });
    mockWallet = createMockWallet(BASE_MAINNET);
  });

  it("should have the correct provider name", () => {
    expect(provider.name).toBe("m2m_sentinel");
  });

  it("supports Base Mainnet and rejects other, missing, or conflicting network identities", () => {
    const baseMainnetByChainId: Network = {
      protocolFamily: "evm",
      chainId: "8453",
    };
    const baseMainnetByNetworkId: Network = {
      protocolFamily: "evm",
      networkId: "base-mainnet",
    };
    const baseSepolia: Network = {
      protocolFamily: "evm",
      chainId: "84532",
      networkId: "base-sepolia",
    };
    const solana: Network = {
      protocolFamily: "svm",
      networkId: "solana-mainnet",
    };
    const conflictingSepoliaId: Network = {
      protocolFamily: "evm",
      chainId: "8453",
      networkId: "base-sepolia",
    };
    const conflictingSepoliaChainId: Network = {
      protocolFamily: "evm",
      chainId: "84532",
      networkId: "base-mainnet",
    };
    const otherEvm: Network = {
      protocolFamily: "evm",
      chainId: "1",
      networkId: "ethereum-mainnet",
    };
    const unidentifiedEvm: Network = {
      protocolFamily: "evm",
    };

    expect(provider.supportsNetwork(BASE_MAINNET)).toBe(true);
    expect(provider.supportsNetwork(baseMainnetByChainId)).toBe(true);
    expect(provider.supportsNetwork(baseMainnetByNetworkId)).toBe(true);
    expect(provider.supportsNetwork(baseSepolia)).toBe(false);
    expect(provider.supportsNetwork(solana)).toBe(false);
    expect(provider.supportsNetwork(conflictingSepoliaId)).toBe(false);
    expect(provider.supportsNetwork(conflictingSepoliaChainId)).toBe(false);
    expect(provider.supportsNetwork(otherEvm)).toBe(false);
    expect(provider.supportsNetwork(unidentifiedEvm)).toBe(false);
  });

  it("registers actions with AgentKit only on Base Mainnet", async () => {
    const agentKit = await AgentKit.from({
      walletProvider: mockWallet,
      actionProviders: [provider],
    });
    const actions = agentKit.getActions();
    expect(actions).toHaveLength(4);

    const actionNames = actions.map(action => action.name);
    expect(actionNames).toContain("M2MSentinelActionProvider_audit_contract");
    expect(actionNames).toContain("M2MSentinelActionProvider_get_gas_metrics");
    expect(actionNames).toContain("M2MSentinelActionProvider_get_token_price");
    expect(actionNames).toContain("M2MSentinelActionProvider_get_service_status");

    const sepoliaKit = await AgentKit.from({
      walletProvider: createMockWallet({
        protocolFamily: "evm",
        chainId: "84532",
        networkId: "base-sepolia",
      }),
      actionProviders: [provider],
    });
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    expect(sepoliaKit.getActions()).toHaveLength(0);
  });

  it("dispatches audit observations through AgentKit without calling a live service", async () => {
    const address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const mockAudit = {
      address,
      notASafetyGuarantee: true,
      reachability: "NOT_ESTABLISHED",
      limitations: ["Static bytecode observations only."],
      proxyResolution: { isProxy: true },
      provenance: { trustLevel: "HIGH_TRUST_PRIMARY" },
    };
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAudit,
    } as Response);

    const agentKit = await AgentKit.from({
      walletProvider: mockWallet,
      actionProviders: [provider],
    });
    const auditAction = agentKit
      .getActions()
      .find(action => action.name === "M2MSentinelActionProvider_audit_contract");
    expect(auditAction).toBeDefined();
    if (!auditAction) {
      throw new Error("AgentKit did not register the audit action on Base Mainnet");
    }

    const result = await auditAction.invoke({ address });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("SUCCESS");
    expect(parsed.notASafetyGuarantee).toBe(true);
    expect(parsed.data.address).toBe(address);
    expect(parsed.data.reachability).toBe("NOT_ESTABLISHED");
    expect(parsed.data.limitations).toContain("Static bytecode observations only.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/v1/audit/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "local-test-api-key",
        }),
      }),
    );
  });

  it("dispatches 402 without claiming to expose or settle an x402 challenge", async () => {
    const address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 402,
    } as Response);

    const agentKit = await AgentKit.from({
      walletProvider: mockWallet,
      actionProviders: [provider],
    });
    const auditAction = agentKit
      .getActions()
      .find(action => action.name === "M2MSentinelActionProvider_audit_contract");
    expect(auditAction).toBeDefined();
    if (!auditAction) {
      throw new Error("AgentKit did not register the audit action on Base Mainnet");
    }

    const result = await auditAction.invoke({ address });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("PAYMENT_REQUIRED");
    expect(parsed.message).toContain("does not expose the challenge or settle payment");
    expect(parsed.notASafetyGuarantee).toBe(true);
  });
});
