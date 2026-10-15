import { encodeFunctionData } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { AZZLE_TASK_REGISTRY_ABI } from "./constants";
import { azzleActionProvider } from "./azzleActionProvider";

const REGISTRY = "0x1111111111111111111111111111111111111111";
const HASH = "0x1234567890123456789012345678901234567890123456789012345678901234";

function wallet(chainId = "8453"): jest.Mocked<EvmWalletProvider> {
  return {
    getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", chainId }),
    sendTransaction: jest.fn().mockResolvedValue(HASH),
    waitForTransactionReceipt: jest.fn().mockResolvedValue({ logs: [] }),
  } as unknown as jest.Mocked<EvmWalletProvider>;
}

describe("AzzleActionProvider", () => {
  const provider = azzleActionProvider();

  it("only supports Base mainnet", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" })).toBe(false);
  });

  it("posts AZL-wei tasks through an AgentKit EVM wallet", async () => {
    const mockWallet = wallet();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const response = await provider.postAzzleTask(mockWallet, {
      taskRegistry: REGISTRY,
      totalAmountAzlWei: "1000000000000000000",
      deadline,
    });

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: REGISTRY,
      data: encodeFunctionData({
        abi: AZZLE_TASK_REGISTRY_ABI,
        functionName: "post",
        args: [1000000000000000000n, BigInt(deadline)],
      }),
    });
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(HASH);
    expect(response).toContain("Posted AZZLE task");
  });

  it("refuses a non-Base wallet before sending", async () => {
    const mockWallet = wallet("1");
    const response = await provider.claimAzzleTask(mockWallet, {
      taskRegistry: REGISTRY,
      taskId: "1",
    });

    expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    expect(response).toContain("require Base mainnet");
  });
});
