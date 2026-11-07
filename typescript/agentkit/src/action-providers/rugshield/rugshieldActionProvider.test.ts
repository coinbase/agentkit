import { rugshieldActionProvider, RugShieldActionProvider } from "./rugshieldActionProvider";

describe("RugShieldActionProvider", () => {
  it("should initialize with default service URL", () => {
    const provider = rugshieldActionProvider();
    expect(provider).toBeInstanceOf(RugShieldActionProvider);
    expect(provider.name).toBe("rugshield");
  });

  it("should accept custom service URL", () => {
    const customUrl = "https://custom-rugshield.example.com";
    const provider = rugshieldActionProvider({ serviceUrl: customUrl });
    expect(provider).toBeInstanceOf(RugShieldActionProvider);
    expect(provider.name).toBe("rugshield");
  });

  it("should support any network (Base, Solana, EVM)", () => {
    const provider = rugshieldActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(true);
  });
});
