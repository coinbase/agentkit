import { ScanTokenSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { tokenSafetyActionProvider } from "./tokenSafetyActionProvider";

const MOCK_TOKEN_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC
const MOCK_API_RESPONSE = {
  address: MOCK_TOKEN_ADDRESS,
  chain: "base",
  token: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  safety_score: 100,
  verdict: "SAFE",
  flags: ["Known safe system/wrapped native token"],
  scan_time_ms: 120,
  note: "Basic scan result",
  timestamp: 1780420766,
};

describe("Scan Token Schema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      tokenAddress: MOCK_TOKEN_ADDRESS,
      chain: "base",
    };

    const result = ScanTokenSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = ScanTokenSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });

  it("should fail parsing invalid address format", () => {
    const invalidInput = {
      tokenAddress: "invalid_address",
    };
    const result = ScanTokenSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });
});

describe("Scan Token Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = tokenSafetyActionProvider();
  let originalFetch: typeof fetch;

  beforeEach(() => {
    mockWallet = {} as unknown as jest.Mocked<EvmWalletProvider>;
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should successfully scan token and return safe report", async () => {
    const args = {
      tokenAddress: MOCK_TOKEN_ADDRESS,
      chain: "base",
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(MOCK_API_RESPONSE),
    } as unknown as Response);

    const response = await actionProvider.scanToken(mockWallet, args);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `https://cryptogenesis.duckdns.org/token/scan?address=${MOCK_TOKEN_ADDRESS}&chain=base`,
    );
    expect(response).toContain("Token Safety Report for USD Coin (USDC) on base:");
    expect(response).toContain("Safety Score: 100/100");
    expect(response).toContain("Verdict: SAFE");
    expect(response).toContain("Security Flags/Warnings: Known safe system/wrapped native token");
  });

  it("should fallback to base if chain parameter is not provided", async () => {
    const args = {
      tokenAddress: MOCK_TOKEN_ADDRESS,
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(MOCK_API_RESPONSE),
    } as unknown as Response);

    await actionProvider.scanToken(mockWallet, args);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `https://cryptogenesis.duckdns.org/token/scan?address=${MOCK_TOKEN_ADDRESS}&chain=base`,
    );
  });

  it("should return error message when API call fails", async () => {
    const args = {
      tokenAddress: MOCK_TOKEN_ADDRESS,
      chain: "base",
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    const response = await actionProvider.scanToken(mockWallet, args);

    expect(response).toContain("Error: Failed to perform safety scan (status code 500)");
  });

  it("should return error message when fetch throws exception", async () => {
    const args = {
      tokenAddress: MOCK_TOKEN_ADDRESS,
      chain: "base",
    };

    globalThis.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const response = await actionProvider.scanToken(mockWallet, args);

    expect(response).toContain("Error performing token safety scan: Error: Network error");
  });
});

describe("supportsNetwork", () => {
  const actionProvider = tokenSafetyActionProvider();

  it("should return true for any network", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "base-mainnet",
    });
    expect(result).toBe(true);
  });
});
