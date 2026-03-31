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
import { TOKEN_ADDRESSES_BY_SYMBOLS } from "./constants";
import { getTokenDetails } from "./utils";
import { encodeFunctionData, Hex, getAddress, erc20Abi, parseUnits, formatUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";

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
    - Returns the token balance formatted according to the token's decimals (e.g., 1.5 USDC = 1500000 raw units)

    Error handling:
    - Returns error if the token address is invalid or not a contract
    - Returns error if the network doesn't support the token
    - Returns 0 balance if the address has never held the token
    `,
    schema: GetBalanceSchema,
  })
  async getBalance(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetBalanceSchema>,
  ): Promise<string> {
    const address = args.address || walletProvider.getAddress();
    const tokenDetails = await getTokenDetails(walletProvider, args.tokenAddress, address);

    if (!tokenDetails) {
      return `Error: Could not fetch token details for ${args.tokenAddress}. Please verify the token address is correct and the network supports this token.`;
    }

    return `Balance of ${tokenDetails.name} (${args.tokenAddress}) for ${address} is ${tokenDetails.formattedBalance} tokens`;
  }

  /**
   * Transfers an ERC20 token to a destination address.
   *
   * @param walletProvider - The wallet provider to transfer from.
   * @param args - The input arguments for the action.
   * @returns A message containing the transfer result.
   */
  @CreateAction({
    name: "transfer",
    description: `
    This tool will transfer an ERC20 token from the wallet to a destination address.
    It takes the following inputs:
    - tokenAddress: The contract address of the token to transfer
    - destination: The address to send the tokens to
    - amount: The amount of tokens to transfer (in human-readable format, e.g., "1.5" for 1.5 tokens)

    Important notes:
    - Never assume token addresses, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool to get the token address first
    - The wallet must have sufficient token balance for the transfer
    - Gas requirements: This action requires native token (ETH on Base) to pay for gas fees. Ensure the wallet has enough ETH to cover transaction costs
    - Transfers are irreversible once confirmed on-chain

    Error handling:
    - Returns error if the wallet has insufficient token balance
    - Returns error if the wallet has insufficient native token for gas
    - Returns error if the destination address is invalid
    - Returns error if the token contract rejects the transfer (e.g., paused contract)
    `,
    schema: TransferSchema,
  })
  async transfer(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TransferSchema>,
  ): Promise<string> {
    try {
      // Get token details for proper decimal handling
      const tokenDetails = await getTokenDetails(walletProvider, args.tokenAddress);
      if (!tokenDetails) {
        return `Error: Could not fetch token details for ${args.tokenAddress}. Please verify the token address is correct.`;
      }

      // Convert human-readable amount to token units
      const amountInTokenUnits = parseUnits(args.amount, tokenDetails.decimals);

      // Check balance before transfer
      const balance = await walletProvider.readContract({
        address: args.tokenAddress as Hex,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletProvider.getAddress() as Hex],
      });

      if ((balance as bigint) < amountInTokenUnits) {
        return `Error: Insufficient balance. You have ${formatUnits(balance as bigint, tokenDetails.decimals)} ${tokenDetails.name}, but tried to transfer ${args.amount} ${tokenDetails.name}.`;
      }

      const hash = await walletProvider.sendTransaction({
        to: args.tokenAddress as Hex,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [args.destination as Hex, amountInTokenUnits],
        }),
      });

      return `Successfully transferred ${args.amount} ${tokenDetails.name} (${args.tokenAddress}) to ${args.destination}.\nTransaction hash: ${hash}`;
    } catch (error) {
      return `Error transferring tokens: ${error}`;
    }
  }

  /**
   * Approves a spender to spend ERC20 tokens on behalf of the wallet.
   *
   * @param walletProvider - The wallet provider to approve from.
   * @param args - The input arguments for the action.
   * @returns A message containing the approval result.
   */
  @CreateAction({
    name: "approve",
    description: `
    This tool will approve a spender to spend ERC20 tokens on behalf of the wallet.
    It takes the following inputs:
    - tokenAddress: The contract address of the token to approve
    - spenderAddress: The address to approve for spending (e.g., a DEX router, lending protocol, or another contract)
    - amount: The amount of tokens to approve (in human-readable format, e.g., "1000" for 1000 tokens)

    When to use this tool:
    - Use BEFORE calling transfer if a contract needs to move tokens on your behalf (e.g., swapping on a DEX, depositing to a lending protocol)
    - Most DeFi protocols require approval before they can access your tokens
    - Without approval, the protocol cannot execute trades, deposits, or other operations using your tokens

    Important notes:
    - Never assume token addresses, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool to get the token address first
    - Approvals remain valid until changed or revoked (by approving 0)
    - Gas requirements: This action requires native token (ETH on Base) to pay for gas fees
    - For security, approve only the exact amount needed or use protocol-specific recommended amounts

    Error handling:
    - Returns error if the wallet has insufficient native token for gas
    - Returns error if the spender address is invalid
    - Returns error if the token contract rejects the approval (e.g., paused contract)
    - Returns error if the approval amount exceeds wallet balance (some tokens require this)
    `,
    schema: ApproveSchema,
  })
  async approve(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ApproveSchema>,
  ): Promise<string> {
    try {
      // Get token details for proper decimal handling
      const tokenDetails = await getTokenDetails(walletProvider, args.tokenAddress);
      if (!tokenDetails) {
        return `Error: Could not fetch token details for ${args.tokenAddress}. Please verify the token address is correct.`;
      }

      // Convert human-readable amount to token units
      const amountInTokenUnits = parseUnits(args.amount, tokenDetails.decimals);

      const hash = await walletProvider.sendTransaction({
        to: args.tokenAddress as Hex,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [args.spenderAddress as Hex, amountInTokenUnits],
        }),
      });

      return `Successfully approved ${args.amount} ${tokenDetails.name} (${args.tokenAddress}) for ${args.spenderAddress}.\nTransaction hash: ${hash}`;
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
    - spenderAddress: The address to check allowance for (e.g., a DEX router or protocol contract)

    When to use this tool:
    - Use BEFORE attempting a transfer to verify a contract has permission to spend your tokens
    - Use to check remaining approved amount before a transaction (e.g., "Do I have enough USDC approved for this swap?")
    - If allowance is insufficient, use the approve tool to increase it

    When NOT to use this tool:
    - For direct wallet-to-wallet transfers (use transfer directly without approval)
    - After a transfer has already failed with "insufficient allowance" error (just approve instead)

    Important notes:
    - Never assume token addresses, they have to be provided as inputs. If only token symbol is provided, use the get_token_address tool to get the token address first
    - Returns 0 if no approval has been granted
    - Returns the full approved amount even if part has been used (allowance decreases as spender uses tokens)

    Error handling:
    - Returns error if the token address is invalid or not a contract
    - Returns error if the spender address is invalid
    - Returns error if the network doesn't support reading this token's state
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
   * Gets the contract address for a token by its symbol.
   *
   * @param walletProvider - The wallet provider to get the token address from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token address.
   */
  @CreateAction({
    name: "get_token_address",
    description: `
    This tool will get the contract address for an ERC20 token by its symbol on the current network.
    It takes the following inputs:
    - symbol: The token symbol (e.g., "USDC", "DAI", "WETH")

    Important notes:
    - Only works for commonly used tokens with known addresses (USDC, USDT, DAI, WETH, etc.)
    - For obscure or new tokens, the user must provide the contract address directly
    - Always verify the returned address matches expected token (check on block explorer if unsure)

    Error handling:
    - Returns error if the symbol is not recognized on the current network
    - Returns error if the network is not supported by this tool
    `,
    schema: GetTokenAddressSchema,
  })
  async getTokenAddress(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTokenAddressSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const tokenAddresses = TOKEN_ADDRESSES_BY_SYMBOLS[network.networkId];

    if (!tokenAddresses) {
      return `Error: Network ${network.networkId} is not supported for token address lookup.`;
    }

    const tokenAddress = tokenAddresses[args.symbol.toUpperCase()];

    if (!tokenAddress) {
      return `Error: Token symbol ${args.symbol} is not supported on ${network.networkId}. Supported symbols: ${Object.keys(tokenAddresses).join(", ")}`;
    }

    return `Token address for ${args.symbol.toUpperCase()} on ${network.networkId} is ${tokenAddress}`;
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the action provider supports the network.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const erc20ActionProvider = () => new ERC20ActionProvider();
