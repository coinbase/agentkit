import { rsoftBankActionProvider, RsoftBankActionProvider } from "./rsoftBankActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

// The @CreateAction decorator fires an unawaited analytics fetch on every
// invocation; neutralize it so mocked fetch state can't leak across tests.
jest.mock("../../analytics", () => ({ sendAnalyticsEvent: jest.fn() }));

const AGENT_WALLET = "0x4CFfda19125efA278475d61Ff28F37EAd2c05bef";
const BASE_MAINNET: Network = {
  protocolFamily: "evm",
  networkId: "base-mainnet",
  chainId: "8453",
};

describe("RsoftBankActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let provider: RsoftBankActionProvider;

  beforeEach(() => {
    jest.resetAllMocks();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(AGENT_WALLET),
      getName: jest.fn().mockReturnValue("mock_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue(BASE_MAINNET),
      signTypedData: jest.fn().mockResolvedValue("0xsigned"),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    provider = rsoftBankActionProvider({ apiKey: "test-key" });
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet", () => {
      expect(provider.supportsNetwork(BASE_MAINNET)).toBe(true);
    });

    it("rejects other EVM networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
          chainId: "1",
        }),
      ).toBe(false);
    });

    it("rejects non-EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("getInterestRates", () => {
    it("returns the bank's rate table", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('{"tiers":[]}'),
      });
      const result = await provider.getInterestRates(mockWallet);
      expect(result).toBe('{"tiers":[]}');
      expect(fetchMock).toHaveBeenCalledWith(
        "https://rsoft-agentic-bank.com/api/v1/interest-rates",
      );
    });

    it("prefixes API errors with the status", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue("down"),
      });
      const result = await provider.getInterestRates(mockWallet);
      expect(result).toContain("Bank API error 503");
    });
  });

  describe("getCreditworthiness", () => {
    it("defaults to the agent's own wallet", async () => {
      fetchMock.mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("{}") });
      await provider.getCreditworthiness(mockWallet, {});
      expect(fetchMock).toHaveBeenCalledWith(
        `https://rsoft-agentic-bank.com/api/v1/agents/${AGENT_WALLET}/creditworthiness`,
      );
    });
  });

  describe("requestLoan", () => {
    it("is fail-closed without an API key", async () => {
      const keyless = rsoftBankActionProvider();
      const result = await keyless.requestLoan(mockWallet, { amount: 5 });
      expect(result).toContain("API key not configured");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockWallet.signTypedData).not.toHaveBeenCalled();
    });

    it("signs the EIP-712 LoanRequest with the agent's wallet and submits it", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('{"request_id":"req_1"}'),
      });

      const result = await provider.requestLoan(mockWallet, { amount: 5 });

      expect(mockWallet.signTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: expect.objectContaining({
            name: "RSoft Agentic Bank",
            chainId: 8453,
          }),
          primaryType: "LoanRequest",
          message: expect.objectContaining({
            agentWallet: AGENT_WALLET,
            loanAmountUsdc6: BigInt(5_000_000),
          }),
        }),
      );

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://rsoft-agentic-bank.com/api/v1/loan/request");
      expect(init.headers["X-API-Key"]).toBe("test-key");
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        agent_wallet: AGENT_WALLET,
        loan_amount: 5,
        signature: "0xsigned",
      });
      expect(result).toBe('{"request_id":"req_1"}');
    });
  });

  describe("confirmRepayment", () => {
    it("posts the request id and tx hash", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('{"status":"repaid"}'),
      });
      const txHash = "0x" + "ab".repeat(32);
      const result = await provider.confirmRepayment(mockWallet, {
        requestId: "req_1",
        txHash,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://rsoft-agentic-bank.com/api/v1/loan/repay");
      expect(JSON.parse(init.body)).toEqual({ request_id: "req_1", tx_hash: txHash });
      expect(result).toBe('{"status":"repaid"}');
    });
  });

  describe("getTrustScore", () => {
    it("queries the trust API", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('{"score":72}'),
      });
      const result = await provider.getTrustScore(mockWallet, { wallet: AGENT_WALLET });
      expect(result).toBe('{"score":72}');
      expect(fetchMock.mock.calls[0][0]).toContain(`/score/${AGENT_WALLET}`);
    });
  });
});
