import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { GetBalanceSchema, MintSchema, TransferSchema } from "./schemas";
import { ERC721_ABI } from "./constants";
import { encodeFunctionData, Hex } from "viem";
import { Network } from "../../network";

/**
 * Erc721ActionProvider is an action provider for Erc721 contract interactions.
 */
export class Erc721ActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the Erc721ActionProvider class.
   */
  constructor() {
    super("erc721", []);
  }

  /**
   * Mints an NFT (ERC-721) to a specified destination address onchain.
   *
   * @param walletProvider - The wallet provider to mint the NFT from.
   * @param args - The input arguments for the action.
   * @returns A message containing the NFT mint details.
   */
  @CreateAction({
    name: "mint",
    description: `
This tool will mint an NFT (ERC-721) to a specified destination address onchain via a contract invocation. 
It takes the contract address of the NFT onchain and the destination address onchain that will receive the NFT as inputs. 
Do not use the contract address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
`,
    schema: MintSchema,
  })
  async mint(walletProvider: EvmWalletProvider, args: z.infer<typeof MintSchema>): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: ERC721_ABI,
        functionName: "mint",
        args: [args.destination as Hex],
      });

      const hash = await walletProvider.sendTransaction({
        to: args.contractAddress as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Successfully minted NFT ${args.contractAddress} to ${args.destination}`;
    } catch (error) {
      return `Error minting NFT ${args.contractAddress} to ${args.destination}: ${error}`;
    }
  }

  /**
   * Transfers an NFT (ERC721 token) to a destination address.
   *
   * @param walletProvider - The wallet provider to transfer the NFT from.
   * @param args - The input arguments for the action.
   * @returns A message containing the transfer details.
   */
  @CreateAction({
    name: "transfer",
    description: `
This tool will transfer an NFT (ERC721 token) from the wallet to another onchain address.

It takes the following inputs:
- contractAddress: The NFT contract address
- tokenId: The ID of the specific NFT to transfer
- destination: Onchain address to send the NFT

Important notes:
- Ensure you have ownership of the NFT before attempting transfer
- Ensure there is sufficient native token balance for gas fees
- The wallet must either own the NFT or have approval to transfer it
`,
    schema: TransferSchema,
  })
  async transfer(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TransferSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: ERC721_ABI,
        functionName: "transferFrom",
        args: [args.fromAddress as Hex, args.destination as Hex, BigInt(args.tokenId)],
      });

      const hash = await walletProvider.sendTransaction({
        to: args.contractAddress as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Successfully transferred NFT ${args.contractAddress} with tokenId ${args.tokenId} to ${args.destination}`;
    } catch (error) {
      return `Error transferring NFT ${args.contractAddress} with tokenId ${args.tokenId} to ${args.destination}: ${error}`;
    }
  }

  /**
   * Gets the NFT balance for a given address and contract.
   *
   * @param walletProvider - The wallet provider to check the balance with.
   * @param args - The input arguments for the action.
   * @returns A message containing the NFT balance details.
   */
  @CreateAction({
    name: "get_balance",
    description: `
This tool will check the NFT (ERC721 token) balance for a given address.

It takes the following inputs:
- contractAddress: The NFT contract address to check balance for
- address: (Optional) The address to check NFT balance for. If not provided, uses the wallet's address
`,
    schema: GetBalanceSchema,
  })
  async getBalance(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetBalanceSchema>,
  ): Promise<string> {
    try {
      const address = args.address || walletProvider.getAddress();

      const balance = await walletProvider.readContract({
        address: args.contractAddress as Hex,
        abi: ERC721_ABI,
        functionName: "balanceOf",
        args: [address as Hex],
      });

      return `Balance of NFTs for contract ${args.contractAddress} at address ${address} is ${balance}`;
    } catch (error) {
      return `Error getting NFT balance for contract ${args.contractAddress}: ${error}`;
    }
  }

  /**
   * Checks if the Erc721 action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Erc721 action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const erc721ActionProvider = () => new Erc721ActionProvider();
