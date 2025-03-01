import { amount, Chain, ChainAddress, ChainContext, Network, Signer, Wormhole } from "@wormhole-foundation/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import evm from "@wormhole-foundation/sdk/platforms/evm";

export interface SignerStuff<N extends Network, C extends Chain = Chain> {
  chain: ChainContext<N, C>;
  signer: Signer<N, C>;
  address: ChainAddress<C>;
}


/**
 * Gets a signer for a specific Wormhole chain
 * 
 * @param chain The Wormhole chain to get a signer for
 * @returns The signer for the chain
 */

export async function getSigner<N extends Network, C extends Chain>(chain: ChainContext<N, C>): Promise<SignerStuff<N, C>> {
  console.log(`[getSigner] Getting signer for chain: ${chain.chain}`);

  try {
    let signer: Signer;
    const platform = chain.platform.utils()._platform;

    // Get the private key from environment variables
    const privateKey = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!privateKey) {
      console.error(`[getSigner] No private key found in environment variables`);
      throw new Error('Private key not found in environment variables');
    }

    const formattedPk = privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`;

    console.log(`[getSigner] Private key available, creating signer`, platform);

    switch (platform) {
      case "Evm":
        signer = await evm.getSigner(
          await chain.getRpc(),
          formattedPk,
          {
            debug: true,
            maxGasLimit: amount.units(amount.parse("0.01", 18)),
          }
        );
        console.log(`[getSigner] Signer created for chain ${chain.chain}`);
        break;
      default:
        throw new Error("Unrecognized platform while getting signer: " + platform);
        break;
    }

    console.log(`[getSigner] Account address: ${signer.address} and chain opted for ${signer.chain}`);

    // Format the private key properly (ensure it has the 0x prefix)
    console.log(`[getSigner] Created custom signer for ${chain.chain}`);
    return {
      chain,
      signer: signer as Signer<N, C>,
      address: Wormhole.chainAddress(chain.chain, signer.address()),
    };
  } catch (error) {
    console.error(`[getSigner] Error creating signer for chain ${chain.chain}:`, error);
    throw error;
  }
}