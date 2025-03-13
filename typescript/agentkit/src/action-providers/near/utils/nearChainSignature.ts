import { baseDecode } from '@near-js/utils';
import { ec as EC } from 'elliptic';
import { sha3_256 } from 'js-sha3';


import { uncompressedHexPointToEvmAddress } from './address';
import { NEAR_MAINNET_NETWORK_ID, NEAR_NETWORK_ID, NEAR_TESTNET_NETWORK_ID } from '../../../network';
import { MPC_SIGNER_MAINNET, MPC_SIGNER_TESTNET, ROOT_PUBLIC_KEY_MAINNET, ROOT_PUBLIC_KEY_TESTNET } from '../constants';

function najPublicKeyStrToUncompressedHexPoint(najPublicKeyStr: string): string {
    const decodedKey = baseDecode(najPublicKeyStr.split(':')[1]!);
    return '04' + Buffer.from(decodedKey).toString('hex');
}

export function deriveChildPublicKey(
    parentUncompressedPublicKeyHex: string,
    accountId: string,
    path: string = '',
): string {
    const ec = new EC('secp256k1');
    const scalarHex = sha3_256(
        `near-mpc-recovery v0.1.0 epsilon derivation:${accountId},${path}`,
    );

    const x = parentUncompressedPublicKeyHex.substring(2, 66);
    const y = parentUncompressedPublicKeyHex.substring(66);

    // Create a point object from X and Y coordinates
    const oldPublicKeyPoint = ec.curve.point(x, y);

    // Multiply the scalar by the generator point G
    const scalarTimesG = ec.g.mul(scalarHex);

    // Add the result to the old public key point
    const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG);
    const newX = newPublicKeyPoint.getX().toString('hex').padStart(64, '0');
    const newY = newPublicKeyPoint.getY().toString('hex').padStart(64, '0');
    return '04' + newX + newY;
}

export enum AddressType {
    EVM = 'evm',
    BITCOIN_MAINNET_LEGACY = 'bitcoin-mainnet-legacy',
    BITCOIN_MAINNET_SEGWIT = 'bitcoin-mainnet-segwit',
    BITCOIN_TESTNET_LEGACY = 'bitcoin-testnet-legacy',
    BITCOIN_TESTNET_SEGWIT = 'bitcoin-testnet-segwit',
}

type GenerateAddressParams = {
    publicKey: string;
    accountId: string;
    path: string;
    addressType: AddressType;
}

export function generateAddress({ publicKey, accountId, path, addressType }: GenerateAddressParams) {
    let childPublicKey = deriveChildPublicKey(
        najPublicKeyStrToUncompressedHexPoint(publicKey),
        accountId,
        path,
    );

    if (!addressType)
        throw new Error('addressType is required');

    let address;

    switch (addressType) {
        case AddressType.EVM:
            address = uncompressedHexPointToEvmAddress(childPublicKey);
            break;
        case AddressType.BITCOIN_MAINNET_LEGACY:
            throw new Error(`Unsupported address type: ${addressType}`);
        case AddressType.BITCOIN_MAINNET_SEGWIT:
            throw new Error(`Unsupported address type: ${addressType}`);
        case AddressType.BITCOIN_TESTNET_LEGACY:
            throw new Error(`Unsupported address type: ${addressType}`);
        case AddressType.BITCOIN_TESTNET_SEGWIT:
            throw new Error(`Unsupported address type: ${addressType}`);
        default:
            throw new Error(`Unsupported address type: ${addressType}`);
    }

    return {
        address,
        publicKey: childPublicKey
    };
}

export function getRootPublicKey(network: NEAR_NETWORK_ID): string {
    switch (network) {
        case NEAR_TESTNET_NETWORK_ID:
            return ROOT_PUBLIC_KEY_TESTNET;
        case NEAR_MAINNET_NETWORK_ID:
            return ROOT_PUBLIC_KEY_MAINNET;
        default:
            throw new Error(`Unsupported network: ${network}`);
    }
}

export function getMpcAccountIdByNetwork(network: NEAR_NETWORK_ID): string {
    switch (network) {
        case NEAR_TESTNET_NETWORK_ID:
            return MPC_SIGNER_TESTNET;
        case NEAR_MAINNET_NETWORK_ID:
            return MPC_SIGNER_MAINNET;
        default:
            throw new Error(`Unsupported network: ${network}`);
    }
}
