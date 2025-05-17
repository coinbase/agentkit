import { z } from "zod";
import { toBytes } from "viem";
import { getTransactionLastResult } from "@near-js/utils";

import { Network, NEAR_PROTOCOL_FAMILY, NEAR_NETWORK_ID } from "../../network";
import { NEARWalletProvider } from "../../wallet-providers/nearWalletProvider";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";

import {
  generateAddress,
  deriveChildPublicKey,
  getRootPublicKey,
  getMpcAccountIdByNetwork,
  MpcContract,
  AddressType,
  SignArgs,
} from "./utils";
import {
  GetCrossChainAddressInput,
  GetCrossChainPublicKeyInput,
  SignPayloadInput,
} from "./schemas";
import { DEFAULT_KEY_VERSION, DEFAULT_PATH, SUPPORTED_NETWORKS } from "./constants";
import { MPCSignature } from "./types";

/**
 * The NearActionProvider class provides actions for the NEAR protocol family
 */
export class NearActionProvider extends ActionProvider<NEARWalletProvider> {
  /**
   * Creates an instance of NearActionProvider
   */
  constructor() {
    super("near", []);
  }

  /**
   * Returns the cross chain address for the given account id, network id, path and address type
   *
   * @param walletProvider - The wallet provider
   * @param args - The get cross chain address input arguments
   *
   * @returns The cross chain address
   */
  @CreateAction({
    name: "get_cross_chain_address",
    description: `
This tool computes a cross chain address of a particular type using the derivation path, network, NEAR account id and the type of address, returning the result in hex string format.

The derived address is compatible with ECDSA and can be used to interact with contracts or perform transactions on the specified chain.

# Inputs:
- account_id (string and optional): The NEAR account id. Default is the wallet's default address.
- network_id (string and optional): The NEAR network, either near- mainnet or near - testnet. Default is "near - mainnet".
- path (string and optional): The derivation path. Default is "account - 1".
- address type (string): The type of address based on the target chain and type of address for networks like Bitcoin (e.g., "evm" or "bitcoin - mainnet - legacy").

# Output:
- Returns the ECDSA-compatible address (string) for the specific address type.
`,
    schema: GetCrossChainAddressInput,
  })
  async getCrossChainAddress(
    walletProvider: NEARWalletProvider,
    args: z.infer<typeof GetCrossChainAddressInput>,
  ): Promise<string> {
    const accountId = args.accountId || (await walletProvider.getAccount()).accountId;
    const networkId = (args.networkId || walletProvider.getNetwork().networkId) as NEAR_NETWORK_ID;
    const path = (args.path || DEFAULT_PATH) as string;
    const addressType = args.addressType as AddressType;
    const rootPublicKey = getRootPublicKey(networkId);

    const generatedAddress = generateAddress(rootPublicKey, accountId, path, addressType);

    return `Generated cross chain address of type ${addressType} for account id ${accountId}, network ${networkId} and derivation path ${path} is ${generatedAddress.address}`;
  }

  /**
   * Returns the cross chain public key for the given account id, network id and path.
   *
   * @param walletProvider - The wallet provider
   * @param args - The get cross chain public key input arguments
   *
   * @returns The cross chain public key
   */
  @CreateAction({
    name: "get_cross_chain_public_key",
    description: `
This tool computes a public key using the chain signature key derivation function, a given derivation path, network and a NEAR account id, returning the result in hex string format. 

The resulted public key is the key the user can sign for via chain signatures and can be further converted into a valid ECDSA address for any supported chain.

# Inputs:
- account_id (string and optional): The NEAR account id. Default is the wallet's default address.
- network_id (string and optional): The NEAR network, either "near-mainnet" or "near-testnet". Default is "near-mainnet".
- path (string and optional): The derivation path. Default is "account-1".

# Output:
- Returns a public key (hex string) that can be converted into a valid ECDSA address for supported chains.
`,
    schema: GetCrossChainPublicKeyInput,
  })
  async getCrossChainPublicKey(
    walletProvider: NEARWalletProvider,
    args: z.infer<typeof GetCrossChainPublicKeyInput>,
  ): Promise<string> {
    const accountId = args.accountId || (await walletProvider.getAccount()).accountId;
    const networkId = (args.networkId || walletProvider.getNetwork().networkId) as NEAR_NETWORK_ID;
    const path = (args.path || DEFAULT_PATH) as string;
    const rootPublicKey = getRootPublicKey(networkId);

    const publicKey = deriveChildPublicKey(rootPublicKey, accountId, path);

    return `Computed public key for account id ${accountId}, network ${networkId} and derivation path ${path} is ${publicKey}`;
  }

  /**
   * Signs the given payload using the MPC contract.
   *
   * @param walletProvider - The wallet provider
   * @param args - The sign payload input arguments
   * @returns The signature result
   */
  @CreateAction({
    name: "sign_payload",
    description: `
This tool signs a payload using the derivation path and produces a signed transaction in hex string format.

The payload can represent transaction data or a message, which is signed using chain signatures.

# Inputs:
- network_id (string and optional): The NEAR network, either "near-mainnet" or "near-testnet". Default is "near-mainnet".
- path (string): The derivation path.
- payload (string): The transaction data or message to be signed.

# Output:
- Returns a signed transaction (hex string) that can be used on NEAR or other supported chains that include EVM Chains and Bitcoin.
`,
    schema: SignPayloadInput,
  })
  async signPayload(
    walletProvider: NEARWalletProvider,
    args: z.infer<typeof SignPayloadInput>,
  ): Promise<string> {
    const path = (args.path || DEFAULT_PATH) as string;
    const keyVersion = (args.keyVersion || DEFAULT_KEY_VERSION) as number;
    const payload = args.payload as string;

    const networkId = (args.networkId || walletProvider.getNetwork().networkId) as NEAR_NETWORK_ID;

    const connection = await walletProvider.getConnection();
    const mpcAccountId = getMpcAccountIdByNetwork(networkId);

    const signatureRequestArgs: SignArgs = {
      payload: Array.from(toBytes(payload)),
      path,
      key_version: keyVersion,
    };

    const mpcContractInstance = new MpcContract(connection, mpcAccountId);
    const signAction = await mpcContractInstance.getSignAction(signatureRequestArgs);

    const result = await walletProvider.signAndSendTransaction({
      receiverId: mpcAccountId,
      actions: [signAction],
    });

    const signature = getTransactionLastResult(result) as MPCSignature;

    const { s, recovery_id: recoveryId, big_r } = signature;

    return `The signature result is big_r: ${big_r.affine_point}, big_s: ${s.scalar} and recovery_id: ${recoveryId}`;
  }

  // Define if the action provider supports the given network
  supportsNetwork = (network: Network) =>
    network.protocolFamily === NEAR_PROTOCOL_FAMILY &&
    SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const nearActionProvider = () => new NearActionProvider();
