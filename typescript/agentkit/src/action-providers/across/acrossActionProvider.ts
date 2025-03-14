import { z } from "zod";
import {
  parseUnits,
  Hex,
  createWalletClient,
  http,
  Chain,
  formatUnits,
  PublicClient,
  createPublicClient,
} from "viem";
import { ActionProvider } from "../actionProvider";
import { CHAIN_ID_TO_NETWORK_ID, Network, NETWORK_ID_TO_VIEM_CHAIN } from "../../network";
import { CreateAction } from "../actionDecorator";
import { BridgeTokenSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { isTestnet } from "./utils";
import { privateKeyToAccount } from "viem/accounts";
import { abi as ERC20_ABI } from "../erc20/constants";
/**
 * Configuration options for the SafeWalletProvider.
 */
export interface AcrossActionProviderConfig {
  /**
   * Private key of the signer that (co-)owns the Safe.
   */
  privateKey: string;
  /**
   * Network ID, for example "base-sepolia" or "ethereum-mainnet".
   */
  networkId?: string;
}

/**
 * AcrossActionProvider provides actions for cross-chain bridging via Across Protocol.
 */
export class AcrossActionProvider extends ActionProvider<EvmWalletProvider> {
  #privateKey: string;
  #chain: Chain;
  #publicClient: PublicClient;
  /**
   * Constructor for the AcrossActionProvider.
   *
   * @param config - The configuration options for the AcrossActionProvider.
   */
  constructor(config: AcrossActionProviderConfig) {
    super("across", []);
    this.#privateKey = config.privateKey;
    const account = privateKeyToAccount(this.#privateKey as Hex);
    if (!account) throw new Error("Invalid private key");

    this.#chain = NETWORK_ID_TO_VIEM_CHAIN[config.networkId || "base-sepolia"];
    if (!this.#chain) throw new Error(`Unsupported network: ${config.networkId}`);

    this.#publicClient = createPublicClient({
      chain: this.#chain,
      transport: http(),
    });
  }

  /**
   * Bridges a token from one chain to another using Across Protocol.
   *
   * @param walletProvider - The wallet provider to use for the transaction.
   * @param args - The input arguments for the action.
   * @returns A message containing the bridge details.
   */
  @CreateAction({
    name: "bridge_token",
    description: `
    This tool will bridge tokens from the current chain to another chain using the Across Protocol.
    
    It takes the following inputs:
    - destinationChainId: The chain ID of the destination chain
    - inputTokenSymbol: The symbol of the token to bridge (e.g., 'ETH', 'WETH', 'USDC')
    - amount: The amount of tokens to bridge in whole units (e.g. 1.5 WETH, 10 USDC)
    - recipient: (Optional) The recipient address on the destination chain (defaults to sender)
    - maxSplippage: (Optional) The maximum slippage percentage (defaults to 1.5%)
    Important notes:
    - Ensure sufficient balance of the input token before bridging
    `,
    schema: BridgeTokenSchema,
  })
  async bridgeToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BridgeTokenSchema>,
  ): Promise<string> {
    try {
      // Use dynamic import to get the Across SDK
      const acrossModule = await import("@across-protocol/app-sdk");
      const createAcrossClient = acrossModule.createAcrossClient;

      // Create wallet client
      const account = privateKeyToAccount(this.#privateKey as Hex);
      const walletClient = createWalletClient({
        account,
        chain: this.#chain,
        transport: http(),
      });

      // Get recipient address if provided, otherwise use sender
      const recipient = (args.recipient || walletProvider.getAddress()) as Hex;

      // Get destination chain
      const destinationNetworkId = CHAIN_ID_TO_NETWORK_ID[Number(args.destinationChainId)];
      const destinationChain = NETWORK_ID_TO_VIEM_CHAIN[destinationNetworkId];
      if (!destinationChain) {
        throw new Error(`Unsupported destination chain: ${args.destinationChainId}`);
      }

      // Create Across client
      const acrossClient = createAcrossClient({
        //integratorId: INTEGRATOR_ID,
        chains: [this.#chain, destinationChain],
        useTestnet: isTestnet(this.#chain.id),
      });

      // Get chain details to find token information
      const chainDetails = await acrossClient.getSupportedChains({});
      const originChainDetails = chainDetails.find(chain => chain.chainId === this.#chain.id);

      if (!originChainDetails) {
        throw new Error(`Origin chain ${this.#chain.id} not supported by Across Protocol`);
      }

      // Find token by symbol on the origin chain
      const inputTokens = originChainDetails.inputTokens;
      if (!inputTokens || inputTokens.length === 0) {
        throw new Error(`No input tokens available on chain ${this.#chain.id}`);
      }
      const tokenInfo = inputTokens.find(
        token => token.symbol.toUpperCase() === args.inputTokenSymbol.toUpperCase(),
      );
      if (!tokenInfo) {
        throw new Error(
          `Token ${args.inputTokenSymbol} not found on chain ${this.#chain.id}. Available tokens: ${inputTokens.map(t => t.symbol).join(", ")}`,
        );
      }

      // Get token address and decimals to parse the amount
      const inputToken = tokenInfo.address as Hex;
      const decimals = tokenInfo.decimals;
      const inputAmount = parseUnits(args.amount, decimals);

      // Check balance
      const isNative = args.inputTokenSymbol.toUpperCase() === "ETH";
      if (isNative) {
        // Check native ETH balance
        const ethBalance = await this.#publicClient.getBalance({
          address: account.address,
        });
        if (ethBalance < inputAmount) {
          throw new Error(
            `Insufficient balance. Requested to bridge ${formatUnits(inputAmount, decimals)} ${args.inputTokenSymbol} but balance is only ${formatUnits(ethBalance, decimals)} ${args.inputTokenSymbol}`,
          );
        }
      } else {
        // Check ERC20 token balance
        const tokenBalance = (await this.#publicClient.readContract({
          address: inputToken,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        })) as bigint;
        if (tokenBalance < inputAmount) {
          throw new Error(
            `Insufficient balance. Requested to bridge ${formatUnits(inputAmount, decimals)} ${args.inputTokenSymbol} but balance is only ${formatUnits(tokenBalance, decimals)} ${args.inputTokenSymbol}`,
          );
        }
      }

      // Get available routes
      const routeInfo = await acrossClient.getAvailableRoutes({
        originChainId: this.#chain.id,
        destinationChainId: destinationChain.id,
        originToken: inputToken,
      });

      // Select the appropriate route for native ETH or ERC20 token
      let route;
      for (let i = 0; i < routeInfo.length; i++) {
        if (routeInfo[i].isNative === isNative) {
          route = routeInfo[i];
          break;
        }
      }

      if (!route) {
        throw new Error(
          `No routes available from chain ${this.#chain.name} to chain ${destinationChain.name} for token ${args.inputTokenSymbol}`,
        );
      }

      // Get quote
      const quote = await acrossClient.getQuote({
        route,
        inputAmount: inputAmount,
        recipient,
      });

      // Convert units to readable format
      const formattedInfo = {
        minDeposit: formatUnits(quote.limits.minDeposit, decimals),
        maxDeposit: formatUnits(quote.limits.maxDeposit, decimals),
        inputAmount: formatUnits(quote.deposit.inputAmount, decimals),
        outputAmount: formatUnits(quote.deposit.outputAmount, decimals),
      };

      // Check if input amount is within valid deposit range
      if (quote.deposit.inputAmount < quote.limits.minDeposit) {
        throw new Error(
          `Input amount ${formattedInfo.inputAmount} ${args.inputTokenSymbol} is below the minimum deposit of ${formattedInfo.minDeposit} ${args.inputTokenSymbol}`,
        );
      }
      if (quote.deposit.inputAmount > quote.limits.maxDeposit) {
        throw new Error(
          `Input amount ${formattedInfo.inputAmount} ${args.inputTokenSymbol} exceeds the maximum deposit of ${formattedInfo.maxDeposit} ${args.inputTokenSymbol}`,
        );
      }

      // Check if output amount is within acceptable slippage limits
      const actualSlippagePercentage =
        ((Number(formattedInfo.inputAmount) - Number(formattedInfo.outputAmount)) /
          Number(formattedInfo.inputAmount)) *
        100;
      if (actualSlippagePercentage > args.maxSplippage) {
        throw new Error(
          `Output amount has high slippage of ${actualSlippagePercentage.toFixed(2)}%, which exceeds the maximum allowed slippage of ${args.maxSplippage}%. ` +
            `Input: ${formattedInfo.inputAmount} ${args.inputTokenSymbol}, Output: ${formattedInfo.outputAmount} ${args.inputTokenSymbol}`,
        );
      }

      // Approve ERC20 token if needed
      let approvalTxHash;
      if (!isNative) {
        const approvalAmount = quote.deposit.inputAmount;
        approvalTxHash = await walletClient.writeContract({
          address: inputToken,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [quote.deposit.spokePoolAddress, approvalAmount],
        });
        await this.#publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
      }

      // Simulate the deposit transaction
      const { request } = await acrossClient.simulateDepositTx({
        walletClient: walletClient,
        deposit: quote.deposit,
      });

      // Execute the deposit transaction
      const transactionHash = await walletClient.writeContract(request);

      return `
Successfully deposited tokens:
- From: Chain ${this.#chain.id} (${this.#chain.name})
- To: Chain ${destinationChain.id} (${destinationChain.name})
- Token: ${args.inputTokenSymbol} (${inputToken})
- Input Amount: ${formattedInfo.inputAmount} ${args.inputTokenSymbol}
- Output Amount: ${formattedInfo.outputAmount} ${args.inputTokenSymbol}
- Recipient: ${recipient}
${!isNative ? `- Transaction Hash for approval: ${approvalTxHash}\n` : ""}
- Transaction Hash for deposit: ${transactionHash}
        `;
    } catch (error) {
      // Handle SDK-specific errors
      return `Error with Across SDK: ${error}`;
    }
  }

  /**
   * Checks if the Across action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Across action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => {
    // Across only supports EVM-compatible chains
    return network.protocolFamily === "evm";
  };
}

export const acrossActionProvider = (config: AcrossActionProviderConfig) =>
  new AcrossActionProvider(config);
