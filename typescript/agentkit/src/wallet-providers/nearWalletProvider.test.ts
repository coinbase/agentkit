import { KeyPair } from "@near-js/crypto";
import { createClientNearSigner, type NearSignedDelegateInput } from "@x402/near";

import { NEAR_TESTNET_NETWORK, NEAR_TESTNET_NETWORK_ID } from "../network/near";
import { NearWalletProvider } from "./nearWalletProvider";

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock("@x402/near", () => ({
  createClientNearSigner: jest.fn(),
}));

describe("NearWalletProvider", () => {
  const accountId = "agent.testnet";
  const rpcUrl = "https://rpc.testnet.example.com";
  const mockCreateSignedDelegateAction = jest.fn();
  let wallet: NearWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createClientNearSigner).mockReturnValue({
      createSignedDelegateAction: mockCreateSignedDelegateAction,
    });

    wallet = new NearWalletProvider({
      accountId,
      secretKey: KeyPair.fromRandom("ed25519").toString(),
      networkId: NEAR_TESTNET_NETWORK_ID,
      rpcUrl,
    });
  });

  it("initializes account, network, RPC, and signer metadata", () => {
    expect(wallet.getAddress()).toBe(accountId);
    expect(wallet.getName()).toBe("near_wallet_provider");
    expect(wallet.getNetwork()).toEqual(NEAR_TESTNET_NETWORK);
    expect(wallet.getRpcUrl()).toBe(rpcUrl);
    expect(wallet.getProvider()).toBeDefined();
    expect(wallet.getSigner()).toBeDefined();
    expect(wallet.getAccount()).toBeDefined();
    expect(createClientNearSigner).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        rpcUrls: { "near:testnet": rpcUrl },
      }),
    );
  });

  it("gets the available native balance", async () => {
    jest.spyOn(wallet.getAccount(), "getBalance").mockResolvedValue(123n);
    await expect(wallet.getBalance()).resolves.toBe(123n);
  });

  it("transfers native NEAR and returns the transaction hash", async () => {
    const transfer = jest.spyOn(wallet.getAccount(), "transfer").mockResolvedValue({
      transaction: { hash: "native-transaction-hash" },
    } as never);

    await expect(wallet.nativeTransfer("receiver.testnet", "1000")).resolves.toBe(
      "native-transaction-hash",
    );
    expect(transfer).toHaveBeenCalledWith({ receiverId: "receiver.testnet", amount: 1000n });
  });

  it("rejects non-positive native transfers", async () => {
    await expect(wallet.nativeTransfer("receiver.testnet", "0")).rejects.toThrow(
      "greater than zero",
    );
  });

  it("reads NEP-141 metadata and balances at final finality", async () => {
    const callFunction = jest
      .spyOn(wallet.getProvider(), "callFunction")
      .mockResolvedValueOnce({ symbol: "USDC", decimals: 6 } as never)
      .mockResolvedValueOnce("1250000" as never);

    await expect(wallet.getNep141Metadata("usdc.testnet")).resolves.toEqual({
      symbol: "USDC",
      decimals: 6,
    });
    await expect(wallet.getNep141Balance("usdc.testnet")).resolves.toBe(1_250_000n);
    expect(callFunction).toHaveBeenNthCalledWith(
      2,
      "usdc.testnet",
      "ft_balance_of",
      { account_id: accountId },
      { finality: "final" },
    );
  });

  it("submits NEP-141 transfers with one yoctoNEAR", async () => {
    const callFunctionRaw = jest
      .spyOn(wallet.getAccount(), "callFunctionRaw")
      .mockResolvedValue({ transaction: { hash: "ft-transaction-hash" } } as never);

    await expect(
      wallet.transferNep141("usdc.testnet", "receiver.testnet", 1_250_000n),
    ).resolves.toBe("ft-transaction-hash");
    expect(callFunctionRaw).toHaveBeenCalledWith({
      contractId: "usdc.testnet",
      methodName: "ft_transfer",
      args: { receiver_id: "receiver.testnet", amount: "1250000" },
      gas: 30_000_000_000_000n,
      deposit: 1n,
    });
  });

  it("surfaces a NEP-141 recipient-storage receipt failure", async () => {
    jest
      .spyOn(wallet.getAccount(), "callFunctionRaw")
      .mockRejectedValue(new Error("Smart contract panicked: account is not registered"));

    await expect(
      wallet.transferNep141("usdc.testnet", "unregistered.testnet", 1_250_000n),
    ).rejects.toThrow("account is not registered");
  });

  it("submits arbitrary state-changing contract calls", async () => {
    const callFunctionRaw = jest
      .spyOn(wallet.getAccount(), "callFunctionRaw")
      .mockResolvedValue({ transaction: { hash: "call-transaction-hash" } } as never);

    await expect(
      wallet.callContract({
        contractId: "counter.testnet",
        methodName: "increment",
        args: { by: 2 },
        gas: 10n,
        deposit: 3n,
      }),
    ).resolves.toBe("call-transaction-hash");
    expect(callFunctionRaw).toHaveBeenCalledWith({
      contractId: "counter.testnet",
      methodName: "increment",
      args: { by: 2 },
      gas: 10n,
      deposit: 3n,
    });
  });

  it("surfaces an arbitrary contract receipt failure", async () => {
    jest
      .spyOn(wallet.getAccount(), "callFunctionRaw")
      .mockRejectedValue(new Error("Smart contract panicked: downstream receipt failed"));

    await expect(
      wallet.callContract({
        contractId: "counter.testnet",
        methodName: "increment",
        args: { by: 2 },
      }),
    ).rejects.toThrow("downstream receipt failed");
  });

  it("delegates x402 signing for its configured network", async () => {
    mockCreateSignedDelegateAction.mockResolvedValue("signed-delegate");
    const input = {
      x402Version: 2,
      paymentRequirements: {
        scheme: "exact",
        network: "near:testnet",
        asset: "usdc.testnet",
        amount: "1000",
        payTo: "merchant.testnet",
        maxTimeoutSeconds: 60,
        extra: {},
      },
    } satisfies NearSignedDelegateInput;

    await expect(wallet.createSignedDelegateAction(input)).resolves.toBe("signed-delegate");
    expect(mockCreateSignedDelegateAction).toHaveBeenCalledWith(input);
  });

  it("rejects x402 signing for a different NEAR network", async () => {
    const input = {
      x402Version: 2,
      paymentRequirements: {
        scheme: "exact",
        network: "near:mainnet",
        asset: "usdc.near",
        amount: "1000",
        payTo: "merchant.near",
        maxTimeoutSeconds: 60,
        extra: {},
      },
    } satisfies NearSignedDelegateInput;

    await expect(wallet.createSignedDelegateAction(input)).rejects.toThrow(
      "does not match wallet network near:testnet",
    );
    expect(mockCreateSignedDelegateAction).not.toHaveBeenCalled();
  });
});
