import { CtccActionProvider, ctccActionProvider } from "./ctccActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CtccClient } from "@cinqueport/ctcc-x402";

jest.mock("@cinqueport/ctcc-x402");

describe("CtccActionProvider", () => {
  let provider: CtccActionProvider;
  let mockWallet: EvmWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = ctccActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue("0x1234567890123456789012345678901234567890"),
      getNetwork: jest.fn().mockReturnValue({ chainId: "8453", protocolFamily: "evm" }),
    } as unknown as EvmWalletProvider;
  });

  it("should support Base Mainnet (chainId 8453)", () => {
    expect(provider.supportsNetwork({ chainId: "8453", protocolFamily: "evm" })).toBe(true);
  });

  it("should reject non-Base networks", () => {
    expect(provider.supportsNetwork({ chainId: "1", protocolFamily: "evm" })).toBe(false);
    expect(provider.supportsNetwork({ chainId: "137", protocolFamily: "evm" })).toBe(false);
  });

  it("should execute checkTokenControl and return observations JSON", async () => {
    const mockObservations = {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      network: "Base Mainnet",
      observations: {
        contract_exists: true,
        bytecode_bytes: 2824,
      },
    };

    (CtccClient.prototype.checkTokenControl as jest.Mock).mockResolvedValue(mockObservations);

    const result = await provider.checkTokenControl(mockWallet, {
      contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });

    expect(result).toContain("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(result).toContain("Base Mainnet");
  });

  it("should return error JSON if inspection throws", async () => {
    (CtccClient.prototype.checkTokenControl as jest.Mock).mockRejectedValue(new Error("Network timeout"));

    const result = await provider.checkTokenControl(mockWallet, {
      contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });

    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("Network timeout");
    expect(parsed.contract_address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });
});
