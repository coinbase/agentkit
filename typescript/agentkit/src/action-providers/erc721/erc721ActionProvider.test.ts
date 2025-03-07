import { encodeFunctionData } from "viem";
import { erc721ActionProvider } from "./erc721ActionProvider";
import { ERC721_ABI } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";

describe("ERC721 Action Provider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_CONTRACT = "0x1234567890123456789012345678901234567890";
  const MOCK_DESTINATION = "0x9876543210987654321098765432109876543210";
  const MOCK_TOKEN_ID = "123";

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = erc721ActionProvider();

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm" }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      call: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockWallet.sendTransaction.mockResolvedValue("0xmockhash" as `0x${string}`);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
  });

  describe("mint", () => {
    it("should successfully mint an NFT", async () => {
      const args = {
        contractAddress: MOCK_CONTRACT,
        destination: MOCK_DESTINATION,
      };

      const response = await actionProvider.mint(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_CONTRACT,
        data: encodeFunctionData({
          abi: ERC721_ABI,
          functionName: "mint",
          args: [MOCK_DESTINATION],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith("0xmockhash");
      expect(response).toBe(`Successfully minted NFT ${MOCK_CONTRACT} to ${MOCK_DESTINATION}`);
    });

    it("should handle mint errors", async () => {
      const error = new Error("Mint failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const args = {
        contractAddress: MOCK_CONTRACT,
        destination: MOCK_DESTINATION,
      };

      const response = await actionProvider.mint(mockWallet, args);
      expect(response).toBe(`Error minting NFT ${MOCK_CONTRACT} to ${MOCK_DESTINATION}: ${error}`);
    });
  });

  describe("transfer", () => {
    it("should successfully transfer an NFT", async () => {
      const args = {
        contractAddress: MOCK_CONTRACT,
        destination: MOCK_DESTINATION,
        tokenId: MOCK_TOKEN_ID,
        fromAddress: MOCK_ADDRESS,
      };

      const response = await actionProvider.transfer(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_CONTRACT,
        data: encodeFunctionData({
          abi: ERC721_ABI,
          functionName: "transferFrom",
          args: [MOCK_ADDRESS, MOCK_DESTINATION, BigInt(MOCK_TOKEN_ID)],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith("0xmockhash");
      expect(response).toBe(
        `Successfully transferred NFT ${MOCK_CONTRACT} with tokenId ${MOCK_TOKEN_ID} to ${MOCK_DESTINATION}`,
      );
    });

    it("should handle transfer errors", async () => {
      const error = new Error("Transfer failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const args = {
        contractAddress: MOCK_CONTRACT,
        destination: MOCK_DESTINATION,
        tokenId: MOCK_TOKEN_ID,
        fromAddress: MOCK_ADDRESS,
      };

      const response = await actionProvider.transfer(mockWallet, args);
      expect(response).toBe(
        `Error transferring NFT ${MOCK_CONTRACT} with tokenId ${MOCK_TOKEN_ID} to ${MOCK_DESTINATION}: ${error}`,
      );
    });
  });

  describe("getBalance", () => {
    const MOCK_BALANCE = 1;

    beforeEach(() => {
      mockWallet.readContract.mockResolvedValue(MOCK_BALANCE);
      mockWallet.getAddress.mockReturnValue(MOCK_ADDRESS);
    });

    it("should successfully get the NFT balance", async () => {
      const args = {
        contractAddress: MOCK_CONTRACT,
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.getBalance(mockWallet, args);
      expect(mockWallet.readContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACT,
        abi: ERC721_ABI,
        functionName: "balanceOf",
        args: [MOCK_ADDRESS],
      });
      expect(response).toBe(
        `Balance of NFTs for contract ${MOCK_CONTRACT} at address ${MOCK_ADDRESS} is 1`,
      );
    });

    it("should handle get balance errors", async () => {
      const error = new Error("Get balance failed");
      mockWallet.readContract.mockRejectedValue(error);

      const args = {
        contractAddress: MOCK_CONTRACT,
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.getBalance(mockWallet, args);
      expect(mockWallet.readContract).toHaveBeenCalledWith({
        address: MOCK_CONTRACT,
        abi: ERC721_ABI,
        functionName: "balanceOf",
        args: [MOCK_ADDRESS],
      });
      expect(response).toBe(`Error getting NFT balance for contract ${MOCK_CONTRACT}: ${error}`);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM networks", () => {
      const result = actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "any" });
      expect(result).toBe(true);
    });

    it("should return false for non-EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "bitcoin",
        networkId: "any",
      });
      expect(result).toBe(false);
    });
  });
});
