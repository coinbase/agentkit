import { SmartContract, Wallet } from "@coinbase/coinbase-sdk";

import { deployToken, DeployTokenInput } from "../actions/cdp/deploy_token";

const MOCK_TOKEN_NAME = "Test Token";
const MOCK_TOKEN_SYMBOL = "TEST";
const MOCK_TOKEN_SUPPLY = 100;

describe("Deploy Token Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      name: MOCK_TOKEN_NAME,
      symbol: MOCK_TOKEN_SYMBOL,
      totalSupply: MOCK_TOKEN_SUPPLY,
    };

    const result = DeployTokenInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = DeployTokenInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Deploy Token Action", () => {
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
      deployToken: jest.fn(),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.deployToken.mockResolvedValue(mockSmartContract);
  });

  it("should successfully respond", async () => {
    const args = {
      name: MOCK_TOKEN_NAME,
      symbol: MOCK_TOKEN_SYMBOL,
      totalSupply: MOCK_TOKEN_SUPPLY,
    };

    const response = await deployToken(mockWallet, args);

    expect(mockWallet.deployToken).toHaveBeenCalledWith(args);
    expect(mockSmartContract.wait).toHaveBeenCalled();
    expect(response).toContain(
      `Deployed ERC20 token contract ${MOCK_TOKEN_NAME} (${MOCK_TOKEN_SYMBOL})`,
    );
    expect(response).toContain(`with total supply of ${MOCK_TOKEN_SUPPLY}`);
    expect(response).toContain(`tokens at address ${CONTRACT_ADDRESS}`);
    expect(response).toContain(`Transaction link: ${TRANSACTION_LINK}`);
  });

  it("should fail with an error", async () => {
    const args = {
      name: MOCK_TOKEN_NAME,
      symbol: MOCK_TOKEN_SYMBOL,
      totalSupply: MOCK_TOKEN_SUPPLY,
    };

    const error = new Error("An error has occurred");
    mockWallet.deployToken.mockRejectedValue(error);

    const response = await deployToken(mockWallet, args);

    expect(mockWallet.deployToken).toHaveBeenCalledWith(args);
    expect(response).toContain(`Error deploying token: ${error}`);
  });
});
