// Import the implementation modules. The package barrel's emitted declarations
// currently fail tsd on an unrelated agent0-sdk CJS/ESM mismatch.
import { expectAssignable } from "tsd";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../network/network";
import { ViemWalletProvider } from "../wallet-providers/viemWalletProvider";
import { createWalletClient, http, type Chain, type LocalAccount, type PublicClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const account = privateKeyToAccount(generatePrivateKey());

// Same shape as a project passing its own wallet client into ViemWalletProvider.
const client = createWalletClient({
  account,
  chain: foundry,
  transport: http(),
});

const walletProvider = new ViemWalletProvider(client);

expectAssignable<PublicClient>(walletProvider.getPublicClient());
expectAssignable<LocalAccount>(walletProvider.toSigner());

// Templates pass this Chain into the project's createWalletClient.
const chain: Chain = NETWORK_ID_TO_VIEM_CHAIN["base-mainnet"];

const _clientFromExportedChain = createWalletClient({
  account,
  chain,
  transport: http(),
});
