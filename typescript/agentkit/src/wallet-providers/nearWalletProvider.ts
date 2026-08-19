import { Account } from "@near-js/accounts";
import type { KeyPairString } from "@near-js/crypto";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import {
  createClientNearSigner,
  type ClientNearSigner,
  type NearSignedDelegateInput,
} from "@x402/near";

import { Network } from "../network";
import {
  getNearCaip2Network,
  NEAR_NETWORKS,
  NEAR_RPC_URLS,
  type NEAR_NETWORK_ID,
} from "../network/near";
import { WalletProvider } from "./walletProvider";

const DEFAULT_FUNCTION_CALL_GAS = 30_000_000_000_000n;
const ONE_YOCTO = 1n;

/** Configuration for a locally signed NEAR wallet. */
export interface NearWalletProviderConfig {
  /** NEAR account controlled by the configured full-access key. */
  accountId: string;
  /** Full-access NEAR secret key (`ed25519:...` or `secp256k1:...`). */
  secretKey: KeyPairString;
  /** AgentKit NEAR network ID. */
  networkId: NEAR_NETWORK_ID;
  /** Optional RPC override. */
  rpcUrl?: string;
}

/** Parameters for a state-changing NEAR contract call. */
export interface NearContractCall {
  contractId: string;
  methodName: string;
  args: Record<string, unknown>;
  gas?: bigint;
  deposit?: bigint;
}

/** Basic NEP-141 token metadata used by AgentKit actions. */
export interface Nep141Metadata {
  decimals: number;
  symbol: string;
}

/**
 * NEAR wallet provider backed by a local full-access key and JSON-RPC.
 *
 * Besides the base AgentKit wallet operations, this provider exposes NEP-141
 * helpers, arbitrary contract calls, and the signer interface required by
 * `@x402/near` for relayer-sponsored payments.
 */
export class NearWalletProvider extends WalletProvider implements ClientNearSigner {
  readonly #accountId: string;
  readonly #networkId: NEAR_NETWORK_ID;
  readonly #rpcUrl: string;
  readonly #provider: JsonRpcProvider;
  readonly #signer: KeyPairSigner;
  readonly #account: Account;
  readonly #x402Signer: ClientNearSigner;

  /**
   * Create a NEAR wallet provider.
   *
   * @param config - Account, key, network, and optional RPC configuration.
   */
  constructor(config: NearWalletProviderConfig) {
    super();

    this.#accountId = config.accountId;
    this.#networkId = config.networkId;
    this.#rpcUrl = config.rpcUrl ?? NEAR_RPC_URLS[config.networkId];
    this.#provider = new JsonRpcProvider({ url: this.#rpcUrl });
    this.#signer = KeyPairSigner.fromSecretKey(config.secretKey);
    this.#account = new Account(this.#accountId, this.#provider, this.#signer);

    const x402Network = getNearCaip2Network(config.networkId);
    this.#x402Signer = createClientNearSigner({
      accountId: this.#accountId,
      secretKey: config.secretKey,
      rpcUrls: { [x402Network]: this.#rpcUrl },
    });
  }

  /**
   * Get the underlying NEAR account client.
   *
   * @returns The account client.
   */
  getAccount(): Account {
    return this.#account;
  }

  /**
   * Get the underlying JSON-RPC provider.
   *
   * @returns The RPC provider.
   */
  getProvider(): JsonRpcProvider {
    return this.#provider;
  }

  /**
   * Get the signer used by the account.
   *
   * @returns The key-pair signer.
   */
  getSigner(): KeyPairSigner {
    return this.#signer;
  }

  /**
   * Get the configured RPC URL.
   *
   * @returns The RPC URL.
   */
  getRpcUrl(): string {
    return this.#rpcUrl;
  }

  /**
   * Get the NEAR account ID.
   *
   * @returns The account ID.
   */
  getAddress(): string {
    return this.#accountId;
  }

  /**
   * Get AgentKit network metadata.
   *
   * @returns The configured NEAR network.
   */
  getNetwork(): Network {
    return NEAR_NETWORKS[this.#networkId];
  }

  /**
   * Get the provider's analytics identifier.
   *
   * @returns The provider name.
   */
  getName(): string {
    return "near_wallet_provider";
  }

  /**
   * Get available native balance in yoctoNEAR.
   *
   * @returns Available native balance.
   */
  getBalance(): Promise<bigint> {
    return this.#account.getBalance();
  }

  /**
   * Transfer native NEAR in yoctoNEAR.
   *
   * @param to - Destination NEAR account ID.
   * @param value - Amount in yoctoNEAR.
   * @returns The transaction hash after optimistic execution succeeds.
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    const amount = BigInt(value);
    if (amount <= 0n) {
      throw new Error("Native transfer amount must be greater than zero");
    }

    const outcome = await this.#account.transfer({ receiverId: to, amount });
    return outcome.transaction.hash;
  }

  /**
   * Call a view method at final finality.
   *
   * @param contractId - Contract account ID.
   * @param methodName - View method name.
   * @param args - JSON arguments for the view method.
   * @returns The decoded contract result, if any.
   */
  async viewFunction<T>(
    contractId: string,
    methodName: string,
    args: Record<string, unknown>,
  ): Promise<T | undefined> {
    const result = await this.#provider.callFunction(contractId, methodName, args, {
      finality: "final",
    });
    return result as T | undefined;
  }

  /**
   * Submit a state-changing contract call.
   *
   * @param call - Contract, method, arguments, gas, and deposit.
   * @returns The transaction hash after optimistic execution succeeds.
   */
  async callContract(call: NearContractCall): Promise<string> {
    const gas = call.gas ?? DEFAULT_FUNCTION_CALL_GAS;
    const deposit = call.deposit ?? 0n;

    if (gas <= 0n) {
      throw new Error("Contract call gas must be greater than zero");
    }
    if (deposit < 0n) {
      throw new Error("Contract call deposit cannot be negative");
    }

    const outcome = await this.#account.callFunctionRaw({
      contractId: call.contractId,
      methodName: call.methodName,
      args: call.args,
      gas,
      deposit,
    });
    return outcome.transaction.hash;
  }

  /**
   * Read NEP-141 token metadata.
   *
   * @param tokenId - NEP-141 token contract ID.
   * @returns Token symbol and decimals.
   */
  async getNep141Metadata(tokenId: string): Promise<Nep141Metadata> {
    const metadata = await this.viewFunction<Record<string, unknown>>(tokenId, "ft_metadata", {});

    if (
      !metadata ||
      typeof metadata.symbol !== "string" ||
      typeof metadata.decimals !== "number" ||
      !Number.isInteger(metadata.decimals) ||
      metadata.decimals < 0 ||
      metadata.decimals > 255
    ) {
      throw new Error(`Invalid NEP-141 metadata returned by ${tokenId}`);
    }

    return {
      decimals: metadata.decimals,
      symbol: metadata.symbol,
    };
  }

  /**
   * Get a NEP-141 balance in the token's atomic units.
   *
   * @param tokenId - NEP-141 token contract ID.
   * @param accountId - Account to inspect; defaults to the wallet.
   * @returns Balance in atomic token units.
   */
  async getNep141Balance(tokenId: string, accountId = this.#accountId): Promise<bigint> {
    const balance = await this.viewFunction<unknown>(tokenId, "ft_balance_of", {
      account_id: accountId,
    });

    if (typeof balance !== "string" || !/^\d+$/.test(balance)) {
      throw new Error(`Invalid NEP-141 balance returned by ${tokenId}`);
    }

    return BigInt(balance);
  }

  /**
   * Transfer a NEP-141 token amount expressed in atomic units.
   *
   * @param tokenId - NEP-141 token contract ID.
   * @param receiverId - Destination NEAR account ID.
   * @param amount - Amount in atomic token units.
   * @returns The transaction hash after optimistic execution succeeds.
   */
  async transferNep141(tokenId: string, receiverId: string, amount: bigint): Promise<string> {
    if (amount <= 0n) {
      throw new Error("NEP-141 transfer amount must be greater than zero");
    }

    return this.callContract({
      contractId: tokenId,
      methodName: "ft_transfer",
      args: { receiver_id: receiverId, amount: amount.toString() },
      gas: DEFAULT_FUNCTION_CALL_GAS,
      deposit: ONE_YOCTO,
    });
  }

  /**
   * Create a NEP-366 signed delegate action for an x402 exact payment.
   *
   * The requirement must target the same network as this wallet. The
   * facilitator relays the returned delegate action and sponsors gas.
   *
   * @param input - x402 version and selected payment requirements.
   * @returns Base64-encoded Borsh signed delegate action.
   */
  async createSignedDelegateAction(input: NearSignedDelegateInput): Promise<string> {
    const expectedNetwork = getNearCaip2Network(this.#networkId);
    if (input.paymentRequirements.network !== expectedNetwork) {
      throw new Error(
        `x402 payment network ${input.paymentRequirements.network} does not match wallet network ${expectedNetwork}`,
      );
    }

    return this.#x402Signer.createSignedDelegateAction(input);
  }
}
