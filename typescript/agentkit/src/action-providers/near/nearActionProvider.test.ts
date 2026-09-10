import { Network } from "../../network";
import { NearWalletProvider } from "../../wallet-providers/nearWalletProvider";
import { NearActionProvider } from "./nearActionProvider";

jest.mock("../../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe("NearActionProvider", () => {
  let actionProvider: NearActionProvider;
  let wallet: jest.Mocked<NearWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    actionProvider = new NearActionProvider();
    wallet = Object.assign(Object.create(NearWalletProvider.prototype), {
      getAddress: jest.fn().mockReturnValue("agent.testnet"),
      getName: jest.fn().mockReturnValue("near_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "near", networkId: "near-testnet" }),
      getNep141Balance: jest.fn(),
      getNep141Metadata: jest.fn(),
      transferNep141: jest.fn(),
      callContract: jest.fn(),
    }) as jest.Mocked<NearWalletProvider>;
  });

  it("supports only NEAR networks", () => {
    const near: Network = { protocolFamily: "near", networkId: "near-testnet" };
    const evm: Network = { protocolFamily: "evm", networkId: "base-mainnet" };

    expect(actionProvider.supportsNetwork(near)).toBe(true);
    expect(actionProvider.supportsNetwork(evm)).toBe(false);
  });

  it("formats a NEP-141 token balance", async () => {
    wallet.getNep141Balance.mockResolvedValue(1_250_000n);
    wallet.getNep141Metadata.mockResolvedValue({ symbol: "USDC", decimals: 6 });

    const result = await actionProvider.getNep141Balance(wallet, {
      tokenId: "usdc.testnet",
      accountId: null,
    });

    expect(wallet.getNep141Balance).toHaveBeenCalledWith("usdc.testnet", "agent.testnet");
    expect(result).toContain("1.25 USDC");
    expect(result).toContain("Atomic balance: 1250000");
  });

  it("converts whole token units and transfers NEP-141 tokens", async () => {
    wallet.getNep141Metadata.mockResolvedValue({ symbol: "USDC", decimals: 6 });
    wallet.getNep141Balance.mockResolvedValue(2_000_000n);
    wallet.transferNep141.mockResolvedValue("transaction-hash");

    const result = await actionProvider.transferNep141(wallet, {
      tokenId: "usdc.testnet",
      receiverId: "receiver.testnet",
      amount: "1.25",
    });

    expect(wallet.transferNep141).toHaveBeenCalledWith(
      "usdc.testnet",
      "receiver.testnet",
      1_250_000n,
    );
    expect(result).toContain("Transferred 1.25 USDC");
    expect(result).toContain("Transaction hash: transaction-hash");
  });

  it("does not submit a NEP-141 transfer with insufficient balance", async () => {
    wallet.getNep141Metadata.mockResolvedValue({ symbol: "USDC", decimals: 6 });
    wallet.getNep141Balance.mockResolvedValue(1n);

    const result = await actionProvider.transferNep141(wallet, {
      tokenId: "usdc.testnet",
      receiverId: "receiver.testnet",
      amount: "1",
    });

    expect(result).toContain("Insufficient USDC balance");
    expect(wallet.transferNep141).not.toHaveBeenCalled();
  });

  it("calls a contract with explicit atomic gas and deposit", async () => {
    wallet.callContract.mockResolvedValue("transaction-hash");

    const result = await actionProvider.callContract(wallet, {
      contractId: "counter.testnet",
      methodName: "increment",
      args: { by: 2 },
      gas: "30000000000000",
      deposit: "1",
    });

    expect(wallet.callContract).toHaveBeenCalledWith({
      contractId: "counter.testnet",
      methodName: "increment",
      args: { by: 2 },
      gas: 30_000_000_000_000n,
      deposit: 1n,
    });
    expect(result).toContain("Called counter.testnet.increment");
  });
});
