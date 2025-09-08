import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { GetBalanceSchema, TransferSchema, GetTokenAddressSchema } from "./schemas";
import {
  BaseTokenToAssetId,
  BaseSepoliaTokenToAssetId,
  TOKEN_ADDRESSES_BY_SYMBOLS,
} from "./constants";
import { getTokenDetails } from "./utils";
import { encodeFunctionData, Hex, getAddress, erc20Abi, parseUnits } from "viem";
import { EvmWalletProvider, LegacyCdpWalletProvider } from "../../wallet-providers";

/**
 * ERC20ActionProvider is an action provider for ERC20 tokens.
 */
export class ERC20ActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the ERC20ActionProvider.
   */
  constructor() {
    super("erc20", []);
  }

  /**
   * Gets the balance of an ERC20 token.
   *
   * @param walletProvider - The wallet provider to get the balance from.
   * @param args - The input arguments for the action.
   * @returns A message containing the balance.
   */
  @CreateAction({
    name: "get_balance",
    description: `
    This tool will get the balance of an ERC20 token for a given address. 
    It takes the following inputs:
    - tokenAddress: The contract address of the token to get the balance for
    - address: (Optional) The address to check the balance for. If not provided, uses the wallet's address
    Important notes:
    - Never assume token or address, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool to get the token address first
    `,
    schema: GetBalanceSchema,
  })
  async getBalance(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetBalanceSchema>,
  ): Promise<string> {
    const address = args.address || walletProvider.getAddress();
    const tokenDetails = await getTokenDetails(walletProvider, args.tokenAddress, args.address);

    if (!tokenDetails) {
      return `Error: Could not fetch token details for ${args.tokenAddress}`;
    }

    return `Balance of ${tokenDetails.name} (${args.tokenAddress}) at address ${address} is ${tokenDetails.formattedBalance}`;
  }

  /**
   * Transfers a specified amount of an ERC20 token to a destination onchain.
   *
   * @param walletProvider - The wallet provider to transfer the asset from.
   * @param args - The input arguments for the action.
   * @returns A message containing the transfer details.
   */
  @CreateAction({
    name: "transfer",
    description: `
    This tool will transfer (send) an ERC20 token from the wallet to another onchain address.

It takes the following inputs:
- amount: The amount to transfer in whole units (e.g. 10.5 USDC)
- tokenAddress: The contract address of the token to transfer
- destinationAddress: Where to send the funds (can be an onchain address, ENS 'example.eth', or Basename 'example.base.eth')
Important notes:
- Never assume token or destination addresses, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool to get the token address first
`,
    schema: TransferSchema,
  })
  async transfer(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TransferSchema>,
  ): Promise<string> {
    try {
      // Check token details
      const tokenAddress = getAddress(args.tokenAddress);
      const tokenDetails = await getTokenDetails(walletProvider, args.tokenAddress);
      if (!tokenDetails) {
        return `Error: Could not fetch token details for ${args.tokenAddress}. Please verify the token address is correct.`;
      }

      // Check token balance
      const amountInWei = parseUnits(String(args.amount), tokenDetails.decimals);
      if (tokenDetails.balance < amountInWei) {
        return `Error: Insufficient ${tokenDetails.name} (${args.tokenAddress}) token balance. Requested to send ${args.amount} of ${tokenDetails.name} (${args.tokenAddress}), but only ${tokenDetails.formattedBalance} is available.`;
      }

      // Guardrails to prevent loss of funds
      if (args.tokenAddress === args.destinationAddress) {
        return "Error: Transfer destination is the token contract address. Refusing transfer to prevent loss of funds.";
      }
      if (
        (await walletProvider
          .getPublicClient()
          .getCode({ address: args.destinationAddress as Hex })) !== "0x"
      ) {
        // If destination address is a contract, check if its an ERC20 token
        // This assumes if the contract implements name, balance and decimals functions, it is an ERC20 token
        const destinationTokenDetails = await getTokenDetails(
          walletProvider,
          args.destinationAddress,
        );
        if (destinationTokenDetails) {
          return "Error: Transfer destination is an ERC20 token contract. Refusing to transfer to prevent loss of funds.";
        }
        // If contract but not an ERC20 token (e.g a smart wallet), allow the transfer
      }

      // Check if we can do gasless transfer
      const isLegacyCdpWallet = walletProvider.getName() === "legacy_cdp_wallet_provider";
      const network = walletProvider.getNetwork();
      const canDoGasless =
        isLegacyCdpWallet &&
        ((network.networkId === "base-mainnet" && BaseTokenToAssetId.has(tokenAddress)) ||
          (network.networkId === "base-sepolia" && BaseSepoliaTokenToAssetId.has(tokenAddress)));

      if (canDoGasless) {
        // Cast to LegacyCdpWalletProvider to access erc20Transfer
        const cdpWallet = walletProvider as LegacyCdpWalletProvider;
        const assetId =
          network.networkId === "base-mainnet"
            ? BaseTokenToAssetId.get(tokenAddress)!
            : BaseSepoliaTokenToAssetId.get(tokenAddress)!;
        const hash = await cdpWallet.gaslessERC20Transfer(
          assetId,
          args.destinationAddress as Hex,
          BigInt(args.amount),
        );

        await walletProvider.waitForTransactionReceipt(hash);

        return `Transferred ${args.amount} of ${args.tokenAddress} to ${
          args.destinationAddress
        } using gasless transfer.\nTransaction hash: ${hash}`;
      }

      // Fallback to regular transfer
      const hash = await walletProvider.sendTransaction({
        to: args.tokenAddress as Hex,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [args.destinationAddress as Hex, amountInWei],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Transferred ${args.amount} of ${tokenDetails?.name} (${args.tokenAddress}) to ${
        args.destinationAddress
      }.\nTransaction hash for the transfer: ${hash}`;
    } catch (error) {
      return `Error transferring the asset: ${error}`;
    }
  }

  /**
   * Gets the contract address for a token symbol on the current network.
   *
   * @param walletProvider - The wallet provider to get the network from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token address or an error if not found.
   */
  @CreateAction({
    name: "get_erc20_token_address",
    description: `
    This tool will get the contract address for frequently used ERC20 tokens on different networks.
    It takes the following input:
    - symbol: The token symbol (e.g. USDC, EURC, CBBTC)
    `,
    schema: GetTokenAddressSchema,
  })
  async getTokenAddress(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTokenAddressSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const networkTokens = TOKEN_ADDRESSES_BY_SYMBOLS[network.networkId ?? ""];
    const tokenAddress = networkTokens?.[args.symbol];

    if (tokenAddress) {
      return `Token address for ${args.symbol} on ${network.networkId}: ${tokenAddress}`;
    }

    // Get available token symbols for the current network
    const availableSymbols = networkTokens ? Object.keys(networkTokens) : [];
    const availableSymbolsText =
      availableSymbols.length > 0
        ? ` Available token symbols on ${network.networkId}: ${availableSymbols.join(", ")}`
        : ` No token symbols are configured for ${network.networkId}`;

    return `Error: Token symbol "${args.symbol}" not found on ${network.networkId}.${availableSymbolsText}`;
  }

  /**
   * Checks if the ERC20 action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the ERC20 action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const erc20ActionProvider = () => new ERC20ActionProvider();
