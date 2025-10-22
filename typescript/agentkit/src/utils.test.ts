import { encodeFunctionData } from "viem";
import { EvmWalletProvider } from "./wallet-providers";
import { approve } from "./utils";

const MOCK_TOKEN_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_SPENDER_ADDRESS = "0x9876543210987654321098765432109876543210";
const MOCK_AMOUNT = BigInt("1000000000000000000");
const MOCK_TX_HASH = "0xabcdef1234567890";
const MOCK_RECEIPT = { status: 1, blockNumber: 1234567 };

describe("utils", () => {
  describe("approve", () => {
    let mockWallet: jest.Mocked<EvmWalletProvider>;

    beforeEach(() => {
      mockWallet = {
        sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
        waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      } as unknown as jest.Mocked<EvmWalletProvider>;
    });

    it("should successfully approve tokens", async () => {
      const response = await approve(
        mockWallet,
        MOCK_TOKEN_ADDRESS,
        MOCK_SPENDER_ADDRESS,
        MOCK_AMOUNT,
      );

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: MOCK_TOKEN_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: [
            {
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              name: "approve",
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
              type: "function",
            },
          ],
          functionName: "approve",
          args: [MOCK_SPENDER_ADDRESS as `0x${string}`, MOCK_AMOUNT],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toBe(
        `Successfully approved ${MOCK_SPENDER_ADDRESS} to spend ${MOCK_AMOUNT} tokens`,
      );
    });

    it("should handle approval errors", async () => {
      const error = new Error("Failed to approve");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const response = await approve(
        mockWallet,
        MOCK_TOKEN_ADDRESS,
        MOCK_SPENDER_ADDRESS,
        MOCK_AMOUNT,
      );

      expect(response).toBe(`Error approving tokens: ${error}`);
    });
  });
});
