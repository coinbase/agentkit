import { z } from "zod";
import { toBytes } from "viem";
import { getTransactionLastResult } from '@near-js/utils';

import { Network, NEAR_PROTOCOL_FAMILY, NEAR_NETWORK_ID } from "../../network";
import { NEARWalletProvider } from "../../wallet-providers/nearWalletProvider";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";

import { GET_CROSS_CHAIN_ADDRESS_DESCRIPTION, GET_CROSS_CHAIN_PUBLIC_KEY_DESCRIPTION, SIGN_PAYLOAD_DESCRIPTION } from "./descriptions";
import { generateAddress, deriveChildPublicKey, getRootPublicKey, getMpcAccountIdByNetwork, MpcContract, AddressType } from './utils'
import { GetCrossChainAddressInput, GetCrossChainPublicKeyInput, SignPayloadInput } from "./schemas"
import { DEFAULT_KEY_VERSION, DEFAULT_PATH, SUPPORTED_NETWORKS } from "./constants"

export class NearActionProvider extends ActionProvider<NEARWalletProvider> {
    constructor() {
        super("near", []);
    }

    // Define if the action provider supports the given network
    supportsNetwork = (network: Network) => network.protocolFamily === NEAR_PROTOCOL_FAMILY && SUPPORTED_NETWORKS.includes(network.networkId!);

    @CreateAction({
        name: "get_cross_chain_address",
        description: GET_CROSS_CHAIN_ADDRESS_DESCRIPTION,
        schema: GetCrossChainAddressInput,
    })
    async getCrossChainAddress(walletProvider: NEARWalletProvider, args: z.infer<typeof GetCrossChainAddressInput>): Promise<string> {
        const accountId = args.accountId || (await walletProvider.getAccount()).accountId;
        const networkId = args.networkId || (walletProvider.getNetwork().networkId) as NEAR_NETWORK_ID;
        const path = args.path || DEFAULT_PATH;
        const addressType = args.addressType as AddressType;
        const rootPublicKey = getRootPublicKey(networkId);

        const generatedAddress = generateAddress({
            publicKey: rootPublicKey,
            accountId,
            path,
            addressType
        })

        return `Generated cross chain address of type ${addressType} for account id ${accountId}, network ${networkId} and derivation path ${path} is ${generatedAddress.address}`
    }

    @CreateAction({
        name: "get_cross_chain_public_key",
        description: GET_CROSS_CHAIN_PUBLIC_KEY_DESCRIPTION,
        schema: GetCrossChainPublicKeyInput,
    })
    async getCrossChainPublicKey(walletProvider: NEARWalletProvider, args: z.infer<typeof GetCrossChainPublicKeyInput>): Promise<string> {
        const accountId = args.accountId || (await walletProvider.getAccount()).accountId;
        const networkId = args.networkId || (walletProvider.getNetwork().networkId) as NEAR_NETWORK_ID;
        const path = args.path || DEFAULT_PATH;
        const rootPublicKey = getRootPublicKey(networkId);

        const publicKey = deriveChildPublicKey(
            rootPublicKey,
            accountId,
            path
        )

        return `Computed public key for account id ${accountId}, network ${networkId} and derivation path ${path} is ${publicKey}`
    }

    @CreateAction({
        name: "sign_payload",
        description: SIGN_PAYLOAD_DESCRIPTION,
        schema: SignPayloadInput,
    })
    async signPayload(walletProvider: NEARWalletProvider, args: z.infer<typeof SignPayloadInput>): Promise<string> {
        const path = args.path || DEFAULT_PATH;
        const keyVersion = args.keyVersion || DEFAULT_KEY_VERSION;
        const payload = args.payload;

        const networkId = args.networkId || (walletProvider.getNetwork().networkId) as NEAR_NETWORK_ID;

        const connection = await walletProvider.getConnection();
        const mpcAccountId = getMpcAccountIdByNetwork(networkId);

        const signatureRequestArgs = {
            payload: Array.from(toBytes(payload)),
            path,
            key_version: keyVersion
        };

        const mpcContractInstance = new MpcContract(connection, mpcAccountId);
        const signAction = await mpcContractInstance.getSignAction(signatureRequestArgs);

        const result = await walletProvider.signAndSendTransaction({
            receiverId: mpcAccountId,
            actions: [signAction]
        })

        const signature = getTransactionLastResult(result) as MPCSignature

        const { s, recovery_id: recoveryId, big_r } = signature;

        return `The signature result is big_r: ${big_r.affine_point}, big_s: ${s.scalar} and recovery_id: ${recoveryId}`;
    }
}

export const nearActionProvider = () => new NearActionProvider();

export interface MPCSignature {
    big_r: {
        affine_point: string
    }
    s: {
        scalar: string
    }
    recovery_id: number
}
