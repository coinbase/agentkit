import { clusterApiUrl, Keypair } from "@solana/web3.js";
import { SolanaKeypairWalletProvider } from "./solanaKeypairWalletProvider";
import {
  SOLANA_DEVNET_GENESIS_BLOCK_HASH,
  SOLANA_MAINNET_GENESIS_BLOCK_HASH,
  SOLANA_NETWORKS,
  SOLANA_TESTNET_GENESIS_BLOCK_HASH,
} from "../network/svm";

describe("Solana Keypair Wallet", () => {
  it("should initialize correctly via convenience getters", async () => {
    const keypair = Keypair.generate();

    let wallet = await SolanaKeypairWalletProvider.fromRpcUrl(
      clusterApiUrl("devnet"),
      keypair.secretKey,
    );
    expect(wallet.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_DEVNET_GENESIS_BLOCK_HASH]);

    wallet = await SolanaKeypairWalletProvider.fromRpcUrl(
      clusterApiUrl("testnet"),
      keypair.secretKey,
    );
    expect(wallet.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_TESTNET_GENESIS_BLOCK_HASH]);

    wallet = await SolanaKeypairWalletProvider.fromRpcUrl(
      clusterApiUrl("mainnet-beta"),
      keypair.secretKey,
    );
    expect(wallet.getNetwork()).toEqual(SOLANA_NETWORKS[SOLANA_MAINNET_GENESIS_BLOCK_HASH]);
    expect(wallet.getAddress()).toEqual(keypair.publicKey.toBase58());
  });

  it("should error when the network genesis hash is unknown", async () => {
    expect(
      () =>
        new SolanaKeypairWalletProvider({
          keypair: Keypair.generate().secretKey,
          rpcUrl: clusterApiUrl("mainnet-beta"),
          genesisHash: "0x123",
        }),
    ).toThrowError("Unknown network with genesis hash");
  });
});
