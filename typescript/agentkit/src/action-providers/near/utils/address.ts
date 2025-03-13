import { keccak256 } from 'viem';

/**
 * Convert an uncompressed hex point to an EVM address
 * 
 * @param uncompressedHexPoint Uncompressed hex point (64 characters) as a string
 *
 * @returns EVM address as a string
 */
export function uncompressedHexPointToEvmAddress(uncompressedHexPoint) {
    const data = Buffer.from(uncompressedHexPoint.substring(2), 'hex');

    const hash = keccak256(data);

    // Evm address is last 20 bytes of hash (40 characters), prefixed with 0x
    return `0x${hash.slice(-40)}`;

}
