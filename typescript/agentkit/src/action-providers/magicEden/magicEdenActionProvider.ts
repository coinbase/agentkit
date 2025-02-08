// TODO: Improve type safety
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { BidSchema, BuySchema, ListSchema, SellSchema } from "./schemas";
import { Network } from "../../network";
import { ME_EVM_BASE_URL } from "./constants";
import { submitTransaction, getWethAddress, toMagicEdenChain } from "./utils";
import { mainnet, base, arbitrum, polygon } from "viem/chains";

/**
 * MagicEdenActionProvider provides functionality to interact with Magic Eden's marketplace.
 */
export class MagicEdenActionProvider extends ActionProvider {
  /**
   * Constructor for the MagicEdenActionProvider class.
   */
  constructor() {
    super("magicEden", []);
  }

  /**
   * Bids on an NFT (ERC721) or collection on the Magic Eden marketplace.
   *
   * @param walletProvider - The wallet provider for executing the bid.
   * @param args - Input parameters conforming to the BidSchema.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "bid",
    description: `
This tool places a bid (NFT offer) on an NFT (ERC721) on Magic Eden.

**Options:**
1. **Specific NFT Bid:**  
   - Provide the \`token\` in the format 'collectionAddress:tokenId'.  
   - *Do not* provide a collection.
2. **Collection Bid:**  
   - Provide the \`collection\` address.

**Required Inputs:**
- \`weiPrice\`: Bid amount in wei.
- \`expirationTime\`: Bid expiration time (epoch).
- \`apiKey\`: Your Magic Eden API key.

  **Note:** Tokens HAVE to be in the format 'collectionAddress:tokenId'. If you just get the collectionAddress, then assume it is not
  a token.
    `,
    schema: BidSchema,
  })
  public async bidMagicEden(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BidSchema>,
  ): Promise<string> {
    const address = walletProvider.getAddress();
    const chainId = walletProvider.getNetwork().chainId!;
    const chainName = toMagicEdenChain(Number(chainId));

    const requestBody = {
      maker: address,
      source: "magiceden.io",
      params: [
        {
          weiPrice: args.weiPrice,
          orderbook: "reservoir",
          orderKind: "payment-processor-v2",
          currency: getWethAddress(Number(chainId)),
          ...(args.token && args.token.trim() !== "" ? { token: args.token } : {}),
          ...(!args.token && args.collection && args.collection.trim() !== ""
            ? { collection: args.collection }
            : {}),
          expirationTime: args.expirationTime,
          options: {
            "payment-processor-v2": {
              useOffChainCancellation: true,
            },
          },
        },
      ],
    };

    return this.executeMagicEdenRequest(
      "execute/bid/v5",
      requestBody,
      args.apiKey,
      walletProvider,
      chainName,
      "bid",
    );
  }

  /**
   * Buys an NFT from the Magic Eden marketplace.
   *
   * @param walletProvider - The wallet provider for executing the buy.
   * @param args - Input parameters conforming to the BuySchema.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "buy",
    description: `
  This tool will buy an NFT (ERC-721) from the Magic Eden marketplace.
  
  You have two options for purchasing:
    
  1. **Specific NFT Purchase:**  
     - Provide the \`token\` (in the format 'collectionAddress:tokenId').  
     - *Do not* provide a quantity.  
     - The purchase will target that exact NFT.
     - If you are given this format, do not ask for a collection or quantity. Buy the specific token.
  
  2. **Floor Purchase:**  
     - Provide the \`collection\` address.  
     - Provide a \`quantity\` indicating how many tokens to buy (or omit quantity to buy the first token off the floor).
  
  Also required is:
  - \`apiKey\`: The Magic Eden API key
  
  **Note:** Do not supply both a token and a collection as arguments. You must deduce if it is a collection or token by the format.
   Tokens HAVE to be in the format 'collectionAddress:tokenId'. Collections do not contain the semi colon. 
   If a token is provided, the purchase is for that specific NFT.
    `,
    schema: BuySchema,
  })
  public async buyMagicEden(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BuySchema>,
  ): Promise<string> {
    console.log("args ", args);
    const address = walletProvider.getAddress();
    const chainId = walletProvider.getNetwork().chainId!;
    const chainName = toMagicEdenChain(Number(chainId));

    const itemPayload = {
      fillType: "trade",
      ...(args.token && args.token.trim() !== "" ? { token: args.token } : {}),
      ...(!args.token && args.collection && args.collection.trim() !== ""
        ? { collection: args.collection }
        : {}),
      ...(!args.token && args.collection && args.quantity ? { quantity: args.quantity } : {}),
    };

    const requestBody = {
      taker: address,
      relayer: address,
      source: "magiceden.io",
      items: [itemPayload],
    };
    console.log("requestBody ", requestBody);

    return this.executeMagicEdenRequest(
      "execute/buy/v7",
      requestBody,
      args.apiKey,
      walletProvider,
      chainName,
      "buy",
    );
  }

  /**
   * Lists an NFT for sale on the Magic Eden marketplace.
   *
   * @param walletProvider - The wallet provider for executing the list.
   * @param args - Input parameters conforming to the ListSchema.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "list",
    description: `
  This tool will list an NFT (ERC-721) for sale on the Magic Eden marketplace.
  You must provide the specific NFT token (in the format 'collectionAddress:tokenId'),
  the listing price in wei, and your Magic Eden API key.
  The expiration time is optional.
    
  Example input:
  - token: "0x423caa2c3882d17c351bcf0c5ce5efe4fb4b3498:5799"
  - weiPrice: "3000000000000000"
  - (optional) expirationTime: "1738894926"
  - apiKey: "<your API key>"
    `,
    schema: ListSchema,
  })
  public async listMagicEden(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ListSchema>,
  ): Promise<string> {
    const address = walletProvider.getAddress();
    const chainId = walletProvider.getNetwork().chainId!;
    const chainName = toMagicEdenChain(Number(chainId));

    const paramsPayload = {
      token: args.token,
      weiPrice: args.weiPrice,
      orderbook: "reservoir",
      orderKind: "payment-processor-v2",
      ...(args.expirationTime ? { expirationTime: args.expirationTime } : {}),
    };

    const requestBody = {
      maker: address,
      source: "magiceden.io",
      params: [paramsPayload],
    };

    return this.executeMagicEdenRequest(
      "execute/list/v5",
      requestBody,
      args.apiKey,
      walletProvider,
      chainName,
      "list",
    );
  }

  /**
   * Accepts an offer (sells an NFT) on the Magic Eden marketplace.
   *
   * @param walletProvider - The wallet provider for executing the sell.
   * @param args - Input parameters conforming to the SellSchema.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "sell",
    description: `
    This tool will accept an offer (sell your NFT) on the Magic Eden marketplace.
    
    You can either:
      - Accept a bid made directly on your NFT,
      - Or sell into the highest collection bid.
    
    **Required:**
    - Provide the NFT token in the format 'collectionAddress:tokenId'.
    - Provide your Magic Eden API key.
    
    No additional details (such as price or quantity) are required.
        `,
    schema: SellSchema,
  })
  public async sellMagicEden(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SellSchema>,
  ): Promise<string> {
    const address = walletProvider.getAddress();
    const chainId = walletProvider.getNetwork().chainId!;
    const chainName = toMagicEdenChain(Number(chainId));

    const requestBody = {
      taker: address,
      relayer: address,
      source: "magiceden.io",
      items: [
        {
          token: args.token,
        },
      ],
    };

    return this.executeMagicEdenRequest(
      "execute/sell/v7",
      requestBody,
      args.apiKey,
      walletProvider,
      chainName,
      "sell",
    );
  }

  /**
   * Determines if the provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if supported, false otherwise.
   */
  public supportsNetwork = (network: Network): boolean =>
    Number(network.chainId) === mainnet.id ||
    Number(network.chainId) === base.id ||
    Number(network.chainId) === arbitrum.id ||
    Number(network.chainId) === polygon.id;

  /**
   * Executes a Magic Eden API request by performing common steps:
   * - Logging and sending the HTTP request.
   * - Handling errors from the API.
   * - Iterating through response steps and processing transactions and signatures.
   *
   * @param endpoint - The API endpoint (e.g., "execute/bid/v5" or "execute/buy/v7").
   * @param requestBody - The JSON payload to send.
   * @param apiKey - The Magic Eden API key.
   * @param walletProvider - The wallet provider.
   * @param chainName - The Magic Eden chain name.
   * @param actionLabel - A label for the action (used in log and error messages).
   * @returns A success message or error string.
   */
  private async executeMagicEdenRequest(
    endpoint: string,
    requestBody: any,
    apiKey: string,
    walletProvider: EvmWalletProvider,
    chainName: string,
    actionLabel: string,
  ): Promise<string> {
    try {
      const response = await fetch(`${ME_EVM_BASE_URL}/${chainName}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage =
          result?.errors && result.errors.length
            ? result.errors.map((e: any) => e.message).join(", ")
            : result?.message || `HTTP error! status: ${response.status}`;
        throw new Error(`Magic Eden API error: ${errorMessage}`);
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(`Magic Eden API errors: ${JSON.stringify(result.errors)}`);
      }

      // Process each step in the API response.
      for (const step of result.steps) {
        if (!step.items || step.items.length === 0) continue;

        // Process each item in the step.
        for (const [index, item] of step.items.entries()) {
          if (item.status !== "incomplete") {
            console.log(` - Item ${index} already complete.`);
            continue;
          }
          if (step.kind === "transaction") {
            await this.handleTransactionItem(walletProvider, step, item);
          } else if (step.kind === "signature") {
            const signatureResult = await this.handleSignatureItem(
              walletProvider,
              chainName,
              step,
              item,
            );
            if (signatureResult) {
              return signatureResult;
            }
          } else {
            console.log(
              ` - Unsupported step kind "${step.kind}" for step "${step.action}" – skipping.`,
            );
          }
        }
      }

      return `Successfully placed ${actionLabel} with the following response steps processed: ${JSON.stringify(
        result,
      )}`;
    } catch (error) {
      return `Error placing ${actionLabel}: ${error}`;
    }
  }

  /**
   * Handles a transaction step item by submitting the transaction.
   *
   * @param walletProvider - The wallet provider to execute the transaction.
   * @param step - The current step object from the API response.
   * @param item - The item within the step to process.
   */
  private async handleTransactionItem(
    walletProvider: EvmWalletProvider,
    step: any,
    item: any,
  ): Promise<void> {
    const txData = item.data;
    console.log(` - Sending transaction for "${step.action}":`, txData);

    try {
      const txHash = await submitTransaction(
        walletProvider,
        txData.to,
        txData.from,
        txData.data,
        txData.value,
      );
      await walletProvider.waitForTransactionReceipt(txHash);
    } catch (txError) {
      throw new Error(`Failed to execute transaction for "${step.action}": ${txError}`);
    }
  }

  /**
   * Handles a signature step item by signing the data and posting the signature if required.
   *
   * @param walletProvider - The wallet provider to sign the data.
   * @param chainName - The chain name for constructing the post endpoint.
   * @param step - The current step object from the API response.
   * @param item - The item within the step to process.
   * @returns A success message if the signature post is executed, otherwise void.
   */
  private async handleSignatureItem(
    walletProvider: EvmWalletProvider,
    chainName: string,
    step: any,
    item: any,
  ): Promise<string | void> {
    if (!item.data.sign) {
      return;
    }

    const signData = item.data.sign;
    console.log(` - Signing typed data for "${step.action}":`, signData);

    let signature: string;
    try {
      signature = await walletProvider.signTypedData({
        domain: signData.domain,
        types: signData.types,
        message: signData.value,
        primaryType: signData.primaryType,
      });
    } catch (signError) {
      throw new Error(`Failed to sign data for "${step.action}": ${signError}`);
    }

    if (item.data.post) {
      const postEndpoint = `${ME_EVM_BASE_URL}/${chainName}/${item.data.post.endpoint}?signature=${signature}`;

      try {
        const postResponse = await fetch(postEndpoint, {
          method: item.data.post.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data.post.body),
        });

        if (!postResponse.ok) {
          throw new Error(`Post response status ${postResponse.status}`);
        }

        const postResult = await postResponse.json();
        return `Successfully placed bid: ${JSON.stringify(postResult)}`;
      } catch (postError) {
        throw new Error(`Failed to post signature for "${step.action}": ${postError}`);
      }
    }
  }
}

export const magicEdenActionProvider = (): MagicEdenActionProvider => new MagicEdenActionProvider();
