import Safe from "@safe-global/protocol-kit";
import { PublicClient } from "viem";

/**
 * Initializes or reinitializes a Safe client if needed
 *
 * @param currentClient - The current Safe client instance
 * @param safeAddress - The target Safe address
 * @param provider - The provider for initializing the client
 * @param signer - The signer for initializing the client
 * @returns The initialized Safe client
 */
export const initializeClientIfNeeded = async (
  currentClient: Safe | null,
  safeAddress: string,
  provider: PublicClient["transport"],
  signer: string,
): Promise<Safe> => {
  // If no client exists, initialize new one
  if (!currentClient) {
    return await Safe.init({
      provider,
      signer,
      safeAddress,
    });
  }

  // If client exists but for different Safe address, reinitialize
  const currentAddress = await currentClient.getAddress();
  if (currentAddress.toLowerCase() !== safeAddress.toLowerCase()) {
    return await Safe.init({
      provider,
      signer,
      safeAddress,
    });
  }

  // Return existing client if it's for the same Safe
  return currentClient;
};
