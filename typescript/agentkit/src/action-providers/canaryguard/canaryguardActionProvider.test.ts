import { canaryguardActionProvider, CanaryGuardActionProvider } from "./canaryguardActionProvider";

describe("CanaryGuardActionProvider", () => {
  it("should initialize with default service URL", () => {
    const provider = canaryguardActionProvider();
    expect(provider).toBeInstanceOf(CanaryGuardActionProvider);
    expect(provider.name).toBe("canaryguard");
  });

  it("should support any network", () => {
    const provider = canaryguardActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
  });
});
