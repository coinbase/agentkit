/**
 * Checks if a chain ID corresponds to a testnet network supported by Across
 *
 * @param chainId - The blockchain network chain ID
 * @returns true if the chain ID corresponds to a testnet network supported by Across, false otherwise
 */
export function isAcrossSupportedTestnet(chainId: number): boolean {
  // List of testnet chain IDs
  const testnetChainIds = [
    11155111, // Sepolia
    84532, // Base Sepolia
    421614, // Arbitrum Sepolia
    11155420, // Optimism Sepolia
    919, // Mode Sepolia
    80002, // Polygon Amoy
    168587773, // Blast Sepolia
    4202, // Lisk Sepolia
    37111, // Lens Sepolia
    1301, // Unichain Sepolia
  ];

  return testnetChainIds.includes(chainId);
}
