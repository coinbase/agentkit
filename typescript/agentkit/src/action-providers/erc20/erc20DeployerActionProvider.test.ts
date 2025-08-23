// Provide a minimal mock for @coinbase/agentkit to define ActionProvider and other members.
jest.mock('@coinbase/agentkit', () => ({
  // Minimal stub class for ActionProvider
  ActionProvider: class {
    constructor() {}
  },
  // Stub for the CreateAction decorator
  CreateAction: () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {},
  // Other exports used by the module under test.
  EvmWalletProvider: class {},
  Network: {},
}));

import { erc20DeployerActionProvider } from "./erc20DeployerActionProvider";
import { EvmWalletProvider } from "@coinbase/agentkit";

describe("ERC20DeployerActionProvider - deployToken", () => {
  let actionProvider: ReturnType<typeof erc20DeployerActionProvider>;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    actionProvider = erc20DeployerActionProvider();
    mockWallet = {
      // Functions used in deployToken
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      // It is fine if other functions are not mocked as they are not used
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.ERC20_DEPLOYER_ADDRESS;
  });

  it("should deploy token successfully", async () => {
    // Set the required deployer address environment variable
    process.env.ERC20_DEPLOYER_ADDRESS = "0xDeployerAddress";

    const args = {
      name: "TestToken",
      symbol: "TTK",
      // Amount is provided as a string
      amount: "1000",
      mintAddress: "0x1234567890123456789012345678901234567890",
    };

    const txHash = "0x1234567890123456789012345678901234567892";
    const tokenAddress = "0x1234567890123456789012345678901234567891";

    // Mock sendTransaction to resolve with a transaction hash
    mockWallet.sendTransaction.mockResolvedValue(txHash);
    // Mock waitForTransactionReceipt to resolve with receipt logs containing the token address
    mockWallet.waitForTransactionReceipt.mockResolvedValue({ logs: [{ address: tokenAddress }] });

    const response = await actionProvider.deployToken(mockWallet, args);

    // Verify that walletProvider functions are called with the proper arguments
    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(txHash);

    // Verify that the response message contains correct details
    expect(response).toContain(
      `Successfully deployed token "TestToken" (TTK) with initial supply of 1000 to 0x1234567890123456789012345678901234567890`
    );
    expect(response).toContain(`Transaction hash: ${txHash}`);
    expect(response).toContain(`Token address: ${tokenAddress}`);
  });

  it("should return an error message if sendTransaction fails", async () => {
    process.env.ERC20_DEPLOYER_ADDRESS = "0xDeployerAddress";

    const args = {
      name: "TestToken",
      symbol: "TTK",
      amount: "1000",
      mintAddress: "0x1234567890123456789012345678901234567890",
    };

    const error = new Error("Transaction failed");
    // Simulate an error during transaction sending.
    mockWallet.sendTransaction.mockRejectedValue(error);

    const response = await actionProvider.deployToken(mockWallet, args);
    expect(response).toContain(`Error deploying token: ${error}`);
  });

  it("should return an error message if waitForTransactionReceipt fails", async () => {
    process.env.ERC20_DEPLOYER_ADDRESS = "0xDeployerAddress";

    const args = {
      name: "TestToken",
      symbol: "TTK",
      amount: "1000",
      mintAddress: "0x1234567890123456789012345678901234567890",
    };

    const txHash = "0xTransactionHash";
    const error = new Error("Receipt error");
    // First, sendTransaction resolves successfully.
    mockWallet.sendTransaction.mockResolvedValue(txHash);
    // Simulate an error during waiting for the transaction receipt.
    mockWallet.waitForTransactionReceipt.mockRejectedValue(error);

    const response = await actionProvider.deployToken(mockWallet, args);
    expect(response).toContain(`Error deploying token: ${error}`);
  });
});
