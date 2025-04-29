import { z } from "zod";
import { parseUnits, Hex, createWalletClient, http, formatUnits, encodeFunctionData } from "viem";
import { ActionProvider } from "../actionProvider";
import { CHAIN_ID_TO_NETWORK_ID, Network, NETWORK_ID_TO_VIEM_CHAIN, getChain } from "../../network";
import { CreateAction } from "../actionDecorator";
import { BridgeTokenSchema, CheckDepositStatusSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { isAcrossSupportedTestnet } from "./utils";
import { privateKeyToAccount } from "viem/accounts";
import { abi as ERC20_ABI } from "../erc20/constants";
/**
 * Configuration options for the SafeWalletProvider.
 */
export interface AcrossActionProviderConfig {
  /**
   * Private key of the wallet provider
   */
  privateKey: string;
}

/**
 * AcrossActionProvider provides actions for cross-chain bridging via Across Protocol.
 */
export class AcrossActionProvider extends ActionProvider<EvmWalletProvider> {
  #privateKey: string;
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
    - destinationChainId: The chain ID of the destination chain (e.g. 8453 for base-mainnet)
    - inputTokenSymbol: The symbol of the token to bridge (e.g. 'ETH', 'USDC')
    - amount: The amount of tokens to bridge in whole units (e.g. 1.5 WETH, 10 USDC)
    - recipient: (Optional) The recipient address on the destination chain (defaults to sender)
    - maxSplippage: (Optional) The maximum slippage percentage (defaults to 1.5%)

    Important notes:
    - Origin chain is the currently connected chain of the wallet provider 
    - Supports cross-chain transfers between EVM-compatible chains for both mainnets and test networks
    - Testnet deposits are not refunded if not filled on destination chain
    - Ensure sufficient balance of the input token before bridging
    - Returns deposit ID that can be used to check the status of the deposit
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

      // Get recipient address if provided, otherwise use sender
      const address = walletProvider.getAddress() as Hex;
      const recipient = (args.recipient || address) as Hex;

      // Get origin chain
      const originChain = getChain(walletProvider.getNetwork().chainId as string);
      if (!originChain) {
        throw new Error(`Unsupported origin chain: ${walletProvider.getNetwork()}`);
      }

      // Get destination chain
      const destinationNetworkId = CHAIN_ID_TO_NETWORK_ID[Number(args.destinationChainId)];
      const destinationChain = NETWORK_ID_TO_VIEM_CHAIN[destinationNetworkId];
      if (!destinationChain) {
        throw new Error(`Unsupported destination chain: ${args.destinationChainId}`);
      }

      // Sanity checks
      if (originChain.id === destinationChain.id) {
        throw new Error("Origin and destination chains cannot be the same");
      }
      const useTestnet = isAcrossSupportedTestnet(originChain.id);
      if (useTestnet !== isAcrossSupportedTestnet(destinationChain.id)) {
        throw new Error(`Cross-chain transfers between ${originChain.name} and ${destinationChain.name} are not supported.
           Origin and destination chains must either be both testnets or both mainnets.`);
      }

      // Create wallet client
      const account = privateKeyToAccount(this.#privateKey as Hex);
      if (account.address !== walletProvider.getAddress()) {
        throw new Error("Private key does not match wallet provider address");
      }
      const walletClient = createWalletClient({
        account,
        chain: originChain,
        transport: http(),
      });

      // Create Across client
      const acrossClient = createAcrossClient({
        chains: [originChain, destinationChain],
        useTestnet,
      });

      // Get chain details to find token information
      const chainDetails = await acrossClient.getSupportedChains({});
      const originChainDetails = chainDetails.find(chain => chain.chainId === originChain.id);

      if (!originChainDetails) {
        throw new Error(`Origin chain ${originChain.id} not supported by Across Protocol`);
      }

      // Find token by symbol on the origin chain
      const inputTokens = originChainDetails.inputTokens;
      if (!inputTokens || inputTokens.length === 0) {
        throw new Error(`No input tokens available on chain ${originChain.id}`);
      }
      const tokenInfo = inputTokens.find(
        token => token.symbol.toUpperCase() === args.inputTokenSymbol.toUpperCase(),
      );
      if (!tokenInfo) {
        throw new Error(
          `Token ${args.inputTokenSymbol} not found on chain ${originChain.id}. Available tokens: ${inputTokens.map(t => t.symbol).join(", ")}`,
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
        const ethBalance = await walletProvider.getBalance();
        if (ethBalance < inputAmount) {
          throw new Error(
            `Insufficient balance. Requested to bridge ${formatUnits(inputAmount, decimals)} ${args.inputTokenSymbol} but balance is only ${formatUnits(ethBalance, decimals)} ${args.inputTokenSymbol}`,
          );
        }
      } else {
        // Check ERC20 token balance
        const tokenBalance = (await walletProvider.readContract({
          address: inputToken,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        if (tokenBalance < inputAmount) {
          throw new Error(
            `Insufficient balance. Requested to bridge ${formatUnits(inputAmount, decimals)} ${args.inputTokenSymbol} but balance is only ${formatUnits(tokenBalance, decimals)} ${args.inputTokenSymbol}`,
          );
        }
      }

      // Get available routes
      const routeInfo = await acrossClient.getAvailableRoutes({
        originChainId: originChain.id,
        destinationChainId: destinationChain.id,
        originToken: inputToken,
      });

      // Select the appropriate route for native ETH or ERC20 token
      const route = routeInfo.find(route => route.isNative === isNative);
      if (!route) {
        throw new Error(
          `No routes available from chain ${originChain.name} to chain ${destinationChain.name} for token ${args.inputTokenSymbol}`,
        );
      }

      // Get quote
      const quote = await acrossClient.getQuote({
        route,
        inputAmount,
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

      //Approve ERC20 token if needed
      let approvalTxHash;
      if (!isNative) {
        approvalTxHash = await walletProvider.sendTransaction({
          to: inputToken,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [quote.deposit.spokePoolAddress, quote.deposit.inputAmount],
          }),
        });
        await walletProvider.waitForTransactionReceipt(approvalTxHash);
      }

      // Simulate the deposit transaction
      const { request } = await acrossClient.simulateDepositTx({
        walletClient: walletClient,
        deposit: quote.deposit,
      });

      // Execute the deposit transaction
      const transactionHash = await walletClient.writeContract(request);

      // Wait for tx to be mined
      const { depositId } = await acrossClient.waitForDepositTx({
        transactionHash,
        originChainId: originChain.id,
      });

      return `
Successfully deposited tokens:
- From: Chain ${originChain.id} (${originChain.name})
- To: Chain ${destinationChain.id} (${destinationChain.name})
- Token: ${args.inputTokenSymbol} (${inputToken})
- Input Amount: ${formattedInfo.inputAmount} ${args.inputTokenSymbol}
- Output Amount: ${formattedInfo.outputAmount} ${args.inputTokenSymbol}
- Recipient: ${recipient}
${!isNative ? `- Transaction Hash for approval: ${approvalTxHash}\n` : ""}
- Transaction Hash for deposit: ${transactionHash}
- Deposit ID: ${depositId}
        `;
    } catch (error) {
      return `Error with Across SDK: ${error}`;
    }
  }

  /**
   * Checks the status of a bridge deposit via Across Protocol.
   *
   * @param walletProvider - The wallet provider to use for the transaction.
   * @param args - The input arguments for the action.
   * @returns A message containing the deposit status details.
   */
  @CreateAction({
    name: "check_deposit_status",
    description: `
    This tool will check the status of a cross-chain bridge deposit on the Across Protocol.
    
    It takes the following inputs:
    - originChainId: The chain ID of the origin chain (defaults to the current chain)
    - depositId: The ID of the deposit to check (returned by the bridge deposit transaction)
    `,
    schema: CheckDepositStatusSchema,
  })
  async checkDepositStatus(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckDepositStatusSchema>,
  ): Promise<string> {
    const originChainId = Number(args.originChainId) || Number(walletProvider.getNetwork().chainId);

    if (isAcrossSupportedTestnet(originChainId)) {
      throw new Error(
        "Checking deposit status on testnets is currently not supported by the Across API",
      );
    }

    try {
      const response = await fetch(
        `https://app.across.to/api/deposit/status?originChainId=${originChainId}&depositId=${args.depositId}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        throw new Error(`Across API request failed with status ${response.status}`);
      }

      const apiData = await response.json();

      // Get chain names
      const originChainName = getChain(String(apiData.originChainId))?.name || "Unknown Chain";
      const destinationChainName =
        getChain(String(apiData.destinationChainId))?.name || "Unknown Chain";

      // Create structured response
      const structuredResponse = {
        status: apiData.status || "unknown",
        depositTxInfo: apiData.depositTxHash
          ? {
              txHash: apiData.depositTxHash,
              chainId: apiData.originChainId,
              chainName: originChainName,
            }
          : null,
        fillTxInfo: apiData.fillTx
          ? {
              txHash: apiData.fillTx,
              chainId: apiData.destinationChainId,
              chainName: destinationChainName,
            }
          : null,
        depositRefundTxInfo: apiData.depositRefundTxHash
          ? {
              txHash: apiData.depositRefundTxHash,
              chainId: apiData.originChainId,
              chainName: originChainName,
            }
          : null,
      };

      return JSON.stringify(structuredResponse, null, 2);
    } catch (error) {
      return `Error checking deposit status: ${error}`;
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
