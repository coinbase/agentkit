import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  GetBalanceSchema,
  TransferSchema,
  GetTokenAddressSchema,
  ApproveSchema,
  AllowanceSchema,
} from "./schemas";
import {
  BaseTokenToAssetId,
  BaseSepoliaTokenToAssetId,
  TOKEN_ADDRESSES_BY_SYMBOLS,
} from "./constants";
import { getTokenDetails } from "./utils";
import { encodeFunctionData, Hex, getAddress, erc20Abi, parseUnits, formatUnits } from "viem";
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
- destinationAddress: The address to send the funds to
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
   * Approves a spender to transfer a specified amount of tokens.
   *
   * @param walletProvider - The wallet provider to approve from.
   * @param args - The input arguments for the action.
   * @returns A message containing the approval details.
   */
  @CreateAction({
    name: "approve",
    description: `
This tool will approve a spender to transfer ERC20 tokens from the wallet.

It takes the following inputs:
- amount: The amount to approve in whole units (e.g. 100 for 100 USDC)
- tokenAddress: The contract address of the token to approve
- spenderAddress: The spender address to approve

Important notes:
- This will overwrite any existing allowance
- To revoke an allowance, set the amount to 0
- Ensure you trust the spender address before approving
- Never assume token addresses, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool to get the token address first
`,
    schema: ApproveSchema,
  })
  async approve(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ApproveSchema>,
  ): Promise<string> {
    try {
      // Get token details for better error messages and validation
      const tokenAddress = getAddress(args.tokenAddress);
      const tokenDetails = await getTokenDetails(walletProvider, args.tokenAddress);
      if (!tokenDetails) {
        return `Error: Could not fetch token details for ${args.tokenAddress}. Please verify the token address is correct.`;
      }

      // Convert amount to wei using token decimals
      const amountInWei = parseUnits(String(args.amount), tokenDetails.decimals);

      const hash = await walletProvider.sendTransaction({
        to: tokenAddress as Hex,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [args.spenderAddress as Hex, amountInWei],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Approved ${args.amount} ${tokenDetails.name} (${args.tokenAddress}) for spender ${args.spenderAddress}.\nTransaction hash: ${hash}`;
    } catch (error) {
      return `Error approving tokens: ${error}`;
    }
  }
  /**
   * Checks the allowance for a spender of an ERC20 token.
   *
   * @param walletProvider - The wallet provider to check the allowance from.
   * @param args - The input arguments containing tokenAddress and spender.
   * @returns A message containing the allowance amount for the spender.
   */
  @CreateAction({
    name: "get_allowance",
    description: `
This tool will get the allowance amount for a spender of an ERC20 token.

It takes the following inputs:
- tokenAddress: The contract address of the token to check allowance for
- spenderAddress: The address to check allowance for

Important notes:
- Never assume token addresses, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool to get the token address first
`,
    schema: AllowanceSchema,
  })
  async getAllowance(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AllowanceSchema>,
  ): Promise<string> {
    try {
      // Get token details for proper formatting
      const tokenDetails = await getTokenDetails(walletProvider, args.tokenAddress);
      if (!tokenDetails) {
        return `Error: Could not fetch token details for ${args.tokenAddress}. Please verify the token address is correct.`;
      }

      const allowance = await walletProvider.readContract({
        address: args.tokenAddress as Hex,
        abi: erc20Abi,
        functionName: "allowance",
        args: [walletProvider.getAddress() as Hex, args.spenderAddress as Hex],
      });

      // Format the allowance using token decimals
      const formattedAllowance = formatUnits(allowance as bigint, tokenDetails.decimals);

      return `Allowance for ${args.spenderAddress} to spend ${tokenDetails.name} (${args.tokenAddress}) is ${formattedAllowance} tokens`;
    } catch (error) {
      return `Error checking allowance: ${error}`;
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
