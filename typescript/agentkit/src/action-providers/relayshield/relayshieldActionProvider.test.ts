import { RelayShieldActionProvider } from "./relayshieldActionProvider";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";

const mockFetchWithPayment = jest.fn();

jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn().mockImplementation(() => ({})),
  wrapFetchWithPayment: () => mockFetchWithPayment,
}));
jest.mock("@x402/evm/exact/client", () => ({ registerExactEvmScheme: jest.fn() }));
jest.mock("@x402/svm/exact/client", () => ({ registerExactSvmScheme: jest.fn() }));

describe("RelayShieldActionProvider", () => {
  let provider: RelayShieldActionProvider;
  let walletProvider: WalletProvider;

  beforeEach(() => {
    provider = new RelayShieldActionProvider();
    walletProvider = {} as WalletProvider;
    mockFetchWithPayment.mockReset();
  });

  describe("supportsNetwork", () => {
    it("supports the networks x402 payment can settle on", () => {
      expect(provider.supportsNetwork({ networkId: "base-mainnet" } as Network)).toBe(true);
      expect(provider.supportsNetwork({ networkId: "solana-mainnet" } as Network)).toBe(true);
    });

    it("rejects networks payment cannot settle on", () => {
      expect(provider.supportsNetwork({ networkId: "ethereum-mainnet" } as Network)).toBe(false);
      expect(provider.supportsNetwork({ networkId: "base-sepolia" } as Network)).toBe(false);
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("screen_wallet", () => {
    it("posts the address and returns the response body", async () => {
      const body = JSON.stringify({ ok: true, risk_level: "LOW", risk_flags: [] });
      mockFetchWithPayment.mockResolvedValue({ ok: true, status: 200, text: async () => body });

      const result = await provider.screenWallet(walletProvider, {
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      });

      expect(result).toBe(body);
      const [url, init] = mockFetchWithPayment.mock.calls[0];
      expect(url).toBe("https://api.relayshield.net/v1/payg/wallet-risk");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      });
    });

    it("returns a HIGH verdict unchanged", async () => {
      const body = JSON.stringify({ ok: true, risk_level: "HIGH", risk_flags: ["sanctioned"] });
      mockFetchWithPayment.mockResolvedValue({ ok: true, status: 200, text: async () => body });

      const result = await provider.screenWallet(walletProvider, { address: "0xbad" });

      expect(result).toBe(body);
      expect(result).toContain("HIGH");
    });

    it("never reports a failed check as a clean result", async () => {
      mockFetchWithPayment.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "upstream error",
      });

      const result = await provider.screenWallet(walletProvider, { address: "0xabc" });

      expect(result).toContain("did NOT complete");
      expect(result).toContain("not a clean result");
      expect(result).toContain("500");
    });

    it("reports a thrown error as an incomplete check rather than swallowing it", async () => {
      mockFetchWithPayment.mockRejectedValue(new Error("insufficient funds"));

      const result = await provider.screenWallet(walletProvider, { address: "0xabc" });

      expect(result).toContain("did NOT complete");
      expect(result).toContain("insufficient funds");
    });
  });

  describe("check_token_security", () => {
    it("maps camelCase args onto the API's snake_case body", async () => {
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      });

      await provider.checkTokenSecurity(walletProvider, {
        contractAddress: "0xtoken",
        chainId: "8453",
      });

      const [url, init] = mockFetchWithPayment.mock.calls[0];
      expect(url).toBe("https://api.relayshield.net/v1/payg/token-security");
      expect(JSON.parse(init.body)).toEqual({
        contract_address: "0xtoken",
        chain_id: "8453",
      });
    });
  });

  describe("check_nft_security", () => {
    it("calls the nft-security endpoint", async () => {
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      });

      await provider.checkNftSecurity(walletProvider, {
        contractAddress: "0xnft",
        chainId: "1",
      });

      const [url, init] = mockFetchWithPayment.mock.calls[0];
      expect(url).toBe("https://api.relayshield.net/v1/payg/nft-security");
      expect(JSON.parse(init.body)).toEqual({ contract_address: "0xnft", chain_id: "1" });
    });
  });

  describe("screen_url", () => {
    it("calls the scan-url endpoint with the url", async () => {
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, verdict: "malicious" }),
      });

      const result = await provider.screenUrl(walletProvider, {
        url: "https://phishing.example.com/claim",
      });

      const [url, init] = mockFetchWithPayment.mock.calls[0];
      expect(url).toBe("https://api.relayshield.net/v1/payg/scan-url");
      expect(JSON.parse(init.body)).toEqual({ url: "https://phishing.example.com/claim" });
      expect(result).toContain("malicious");
    });
  });
});
