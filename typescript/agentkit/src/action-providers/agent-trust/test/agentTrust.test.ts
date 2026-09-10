import { AgentTrustActionProvider } from "../src/agentTrustActionProvider";

describe("AgentTrustActionProvider", () => {
    let provider: AgentTrustActionProvider;

    beforeEach(() => {
        provider = new AgentTrustActionProvider();
    });

    it("should support Base network", () => {
        const baseNetwork = { protocolFamily: "evm", chainId: "8453" };
        expect(provider.supportsNetwork(baseNetwork as any)).toBe(true);
    });

    it("should not support Ethereum Mainnet", () => {
        const ethNetwork = { protocolFamily: "evm", chainId: "1" };
        expect(provider.supportsNetwork(ethNetwork as any)).toBe(false);
    });
});
