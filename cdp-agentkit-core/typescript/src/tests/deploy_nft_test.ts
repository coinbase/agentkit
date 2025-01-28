import { Coinbase, SmartContract, Wallet } from "@coinbase/coinbase-sdk";

import { deployNft, DeployNftInput } from "../actions/cdp/deploy_nft";

const MOCK_NFT_BASE_URI = "https://www.test.xyz/metadata/";
const MOCK_NFT_NAME = "Test Token";
const MOCK_NFT_SYMBOL = "TEST";

describe("Deploy NFT Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      baseURI: MOCK_NFT_BASE_URI,
      name: MOCK_NFT_NAME,
      symbol: MOCK_NFT_SYMBOL,
    };

    const result = DeployNftInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("sould fail parsing empty input", () => {
    const emptyInput = {};
    const result = DeployNftInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Deploy NFT Action", () => {
  const CONTRACT_ADDRESS = "0x123456789abcdef";
  const NETWORK_ID = Coinbase.networks.BaseSepolia;
  const TRANSACTION_HASH = "0xghijkl987654321";
  const TRANSACTION_LINK = `https://etherscan.io/tx/${TRANSACTION_HASH}`;

  let mockSmartContract: jest.Mocked<SmartContract>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockSmartContract = {
      wait: jest.fn().mockResolvedValue({
        getContractAddress: jest.fn().mockReturnValue(CONTRACT_ADDRESS),
        getTransaction: jest.fn().mockReturnValue({
          getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
          getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
        }),
      }),
    } as unknown as jest.Mocked<SmartContract>;

    mockWallet = {
      deployNFT: jest.fn(),
      getNetworkId: jest.fn().mockReturnValue(NETWORK_ID),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.deployNFT.mockResolvedValue(mockSmartContract);
  });

  it("should successfully respond", async () => {
    const args = {
      name: MOCK_NFT_NAME,
      symbol: MOCK_NFT_SYMBOL,
      baseURI: MOCK_NFT_BASE_URI,
    };

    const response = await deployNft(mockWallet, args);

    expect(mockWallet.deployNFT).toHaveBeenCalledWith(args);
    expect(mockSmartContract.wait).toHaveBeenCalled();
    expect(response).toContain(`Deployed NFT Collection ${MOCK_NFT_NAME}`);
    expect(response).toContain(`to address ${CONTRACT_ADDRESS}`);
    expect(response).toContain(`on network ${NETWORK_ID}`);
    expect(response).toContain(`Transaction hash for the deployment: ${TRANSACTION_HASH}`);
    expect(response).toContain(`Transaction link for the deployment: ${TRANSACTION_LINK}`);
  });

  it("should fail with an error", async () => {
    const args = {
      baseURI: MOCK_NFT_BASE_URI,
      name: MOCK_NFT_NAME,
      symbol: MOCK_NFT_SYMBOL,
    };

    const error = new Error("An error has occurred");
    mockWallet.deployNFT.mockRejectedValue(error);

    const response = await deployNft(mockWallet, args);

    expect(mockWallet.deployNFT).toHaveBeenCalledWith(args);
    expect(response).toContain(`Error deploying NFT: ${error}`);
  });
});
