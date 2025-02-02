import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import {
  ReadContractParameters,
  ReadContractReturnType,
  TransactionRequest,
  createPublicClient,
  http,
} from "viem";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../network/network";

interface PrivyWalletConfig {
  appId: string;
  appSecret: string;
  walletId?: string;
  networkId?: string;
}

interface PrivyWallet {
  id: string;
  address: string;
  chain_type: "ethereum" | "solana";
  created_at: number;
}

interface PrivyWalletListResponse {
  data: PrivyWallet[];
  next_cursor?: string;
}

/**
 * A wallet provider that uses Privy's server wallet API.
 */
export class PrivyWalletProvider extends EvmWalletProvider {
  private appId: string;
  private appSecret: string;
  private headers: Record<string, string>;
  private walletId?: string;
  private address?: string;
  private network: Network;
  private publicClient;

  private constructor(config: PrivyWalletConfig) {
    super();
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.headers = this.getHeaders(config);
    this.walletId = config.walletId;
    this.network = {
      protocolFamily: "evm",
      networkId: config.networkId || "84532",
      chainId: "84532",
    };
    this.publicClient = createPublicClient({
      chain: NETWORK_ID_TO_VIEM_CHAIN[this.network.networkId!],
      transport: http(),
    });
  }

  private getHeaders(config: PrivyWalletConfig) {
    const auth = Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64");
    return {
      Authorization: `Basic ${auth}`,
      "privy-app-id": this.appId,
      "Content-Type": "application/json",
    };
  }

  /**
   * Gets a wallet by ID
   */
  private static async getWallet(config: PrivyWalletConfig): Promise<PrivyWallet> {
    const auth = Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64");
    const headers = {
      Authorization: `Basic ${auth}`,
      "privy-app-id": config.appId,
      "Content-Type": "application/json",
    };

    const response = await fetch(`https://api.privy.io/v1/wallets/${config.walletId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get wallet: ${await response.text()}`);
    }

    const wallet: PrivyWallet = await response.json();

    if (!wallet) {
      throw new Error(`Wallet with ID ${config.walletId} not found`);
    }

    return wallet;
  }

  /**
   * Configures a new PrivyWalletProvider with a wallet
   */
  public static async configureWithWallet(config: PrivyWalletConfig): Promise<PrivyWalletProvider> {
    const provider = new PrivyWalletProvider(config);

    if (provider.walletId) {
      const wallet = await PrivyWalletProvider.getWallet({
        appId: provider.appId,
        appSecret: provider.appSecret,
        walletId: provider.walletId,
      });
      provider.address = wallet.address;
    } else {
      // Create new wallet
      const response = await fetch("https://api.privy.io/v1/wallets", {
        method: "POST",
        headers: provider.headers,
        body: JSON.stringify({
          chain_type: "ethereum",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create wallet: ${await response.text()}`);
      }

      const data = await response.json();
      provider.walletId = data.id;
      provider.address = data.address;
    }

    return provider;
  }

  async signMessage(message: string): Promise<`0x${string}`> {
    const response = await fetch(`https://api.privy.io/v1/wallets/${this.walletId}/rpc`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        chain_type: "ethereum",
        method: "personal_sign",
        params: {
          message,
          encoding: "utf-8",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sign message: ${await response.text()}`);
    }

    const data = await response.json();
    return data.signature as `0x${string}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(typedData: any): Promise<`0x${string}`> {
    const response = await fetch(`https://api.privy.io/v1/wallets/${this.walletId}/rpc`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        chain_type: "ethereum",
        method: "eth_signTypedData_v4",
        params: [typedData],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sign typed data: ${await response.text()}`);
    }

    const data = await response.json();
    return data.signature as `0x${string}`;
  }

  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const response = await fetch(`https://api.privy.io/v1/wallets/${this.walletId}/rpc`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        method: "eth_signTransaction",
        caip2: `eip155:${this.network.chainId}`,
        params: {
          transaction,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sign transaction: ${await response.text()}`);
    }

    const data = await response.json();
    return data.signature as `0x${string}`;
  }

  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const response = await fetch(`https://api.privy.io/v1/wallets/${this.walletId}/rpc`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        method: "eth_sendTransaction",
        caip2: `eip155:${this.network.chainId}`,
        params: {
          transaction,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send transaction: ${await response.text()}`);
    }

    const data = await response.json();
    return data.hash as `0x${string}`;
  }

  getAddress(): string {
    return this.address!;
  }

  getNetwork(): Network {
    return this.network;
  }

  getName(): string {
    return "privy_wallet_provider";
  }

  async getBalance(): Promise<bigint> {
    return this.publicClient.getBalance({
      address: this.address as `0x${string}`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return this.publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  async readContract(params: ReadContractParameters): Promise<ReadContractReturnType> {
    return this.publicClient.readContract(params);
  }

  async nativeTransfer(to: `0x${string}`, value: string): Promise<`0x${string}`> {
    const tx = await this.sendTransaction({
      to,
      value: BigInt(value),
    });

    const receipt = await this.waitForTransactionReceipt(tx);
    if (!receipt) {
      throw new Error("Transaction failed");
    }

    return receipt.transactionHash;
  }

  /**
   * Lists all available wallets for the given app credentials
   */
  static async listWallets(
    config: Pick<PrivyWalletConfig, "appId" | "appSecret">,
  ): Promise<PrivyWallet[]> {
    const auth = Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64");
    const headers = {
      Authorization: `Basic ${auth}`,
      "privy-app-id": config.appId,
      "Content-Type": "application/json",
    };

    const wallets: PrivyWallet[] = [];
    let nextCursor: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        chain_type: "ethereum",
        ...(nextCursor && { cursor: nextCursor }),
      });

      const response = await fetch(`https://api.privy.io/v1/wallets?${queryParams}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to list wallets: ${await response.text()}`);
      }

      const result: PrivyWalletListResponse = await response.json();
      wallets.push(...result.data);
      nextCursor = result.next_cursor;
    } while (nextCursor);

    return wallets;
  }
}
