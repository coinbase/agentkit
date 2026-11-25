import { rugshieldActionProvider, RugShieldActionProvider } from "./rugshieldActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("@x402/svm/exact/client");

const mockFetchWithPayment = jest.fn();
const mockX402Client = {};
jest.mocked(x402Client).mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest.mocked(registerExactEvmScheme).mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);

function makeMockEvmWalletProvider() {
  const mockProvider = Object.create(EvmWalletProvider.prototype);
  mockProvider.toSigner = jest.fn().mockReturnValue({ address: "0x0000000000000000000000000000000000000001" });
  mockProvider.getNetwork = jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" });
  return mockProvider as EvmWalletProvider;
}

describe("RugShieldActionProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("should support EVM and SVM networks (Base & Solana)", () => {
    const provider = rugshieldActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(true);
  });

  it("should pay via x402 on checkHoneypot and never coerce null is_honeypot to false", async () => {
    mockFetchWithPayment.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        is_honeypot: null,
        sell_tax_bps: null,
        simulation_status: "unsimulated_preview",
        recommendation: null,
      }),
    } as unknown as Response);

    const provider = rugshieldActionProvider();
    const out = JSON.parse(
      await provider.checkHoneypot(makeMockEvmWalletProvider(), {
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        chain: "base",
      }),
    );

    expect(registerExactEvmScheme).toHaveBeenCalled();
    expect(wrapFetchWithPayment).toHaveBeenCalled();
    expect(out.is_honeypot).toBeNull();
    expect(out.sellable).toBeNull();
    expect(out.sell_tax_bps).toBeNull();
    expect(out.recommendation).toBe("UNSIMULATED_PREVIEW");
  });
});
