import { SmartContract, Wallet } from "@coinbase/coinbase-sdk";

import { deployContract, DeployContractInput } from "../actions/cdp/deploy_contract";

const MOCK_CONTRACT_NAME = "Test Contract";
const MOCK_SOLIDITY_VERSION = "0.8.0";
const MOCK_SOLIDITY_INPUT_JSON = "{}";
const MOCK_CONSTRUCTOR_ARGS = { arg1: "value1", arg2: "value2" };

describe("Deploy Contract Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      solidityVersion: MOCK_SOLIDITY_VERSION,
      solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
      contractName: MOCK_CONTRACT_NAME,
      constructorArgs: MOCK_CONSTRUCTOR_ARGS,
    };

    const result = DeployContractInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = DeployContractInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Deploy Contract Action", () => {
  const CONTRACT_ADDRESS = "0x123456789abcdef";
  const TRANSACTION_HASH = "0xghijkl987654321";
  const TRANSACTION_LINK = `https://etherscan.io/tx/${TRANSACTION_HASH}`;

  let mockSmartContract: jest.Mocked<SmartContract>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockSmartContract = {
      wait: jest.fn().mockResolvedValue({
        getContractAddress: jest.fn().mockReturnValue(CONTRACT_ADDRESS),
        getTransaction: jest.fn().mockReturnValue({
          getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
        }),
      }),
    } as unknown as jest.Mocked<SmartContract>;

    mockWallet = {
      deployContract: jest.fn(),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.deployContract.mockResolvedValue(mockSmartContract);
  });

  it("should successfully respond", async () => {
    const args = {
      solidityVersion: MOCK_SOLIDITY_VERSION,
      solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
      contractName: MOCK_CONTRACT_NAME,
      constructorArgs: MOCK_CONSTRUCTOR_ARGS,
    };

    const response = await deployContract(mockWallet, args);

    expect(mockWallet.deployContract).toHaveBeenCalledWith({
      solidityVersion: "0.8.0+commit.c7dfd78e",
      solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
      contractName: MOCK_CONTRACT_NAME,
      constructorArgs: MOCK_CONSTRUCTOR_ARGS,
    });
    expect(mockSmartContract.wait).toHaveBeenCalled();
    expect(response).toContain(
      `Deployed contract ${MOCK_CONTRACT_NAME} at address ${CONTRACT_ADDRESS}`,
    );
    expect(response).toContain(`Transaction link: ${TRANSACTION_LINK}`);
  });

  it("should fail with an error", async () => {
    const args = {
      solidityVersion: MOCK_SOLIDITY_VERSION,
      solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
      contractName: MOCK_CONTRACT_NAME,
      constructorArgs: MOCK_CONSTRUCTOR_ARGS,
    };

    const error = new Error("An error has occured");
    mockWallet.deployContract.mockRejectedValue(error);

    const response = await deployContract(mockWallet, args);

    expect(mockWallet.deployContract).toHaveBeenCalledWith({
      solidityVersion: "0.8.0+commit.c7dfd78e",
      solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
      contractName: MOCK_CONTRACT_NAME,
      constructorArgs: MOCK_CONSTRUCTOR_ARGS,
    });
    expect(response).toContain(`Error deploying contract: ${error}`);
  });
});
