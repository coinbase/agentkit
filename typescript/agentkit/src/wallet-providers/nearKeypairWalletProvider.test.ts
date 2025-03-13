import { KeyPair } from "@near-js/crypto";

import { NEAR_TESTNET_NETWORK_ID } from "../network";
import { NearKeypairWalletProvider } from "./nearKeypairWalletProvider";

describe("Near Keypair Wallet", () => {

    const privateKey = "ed25519:4PqsZQyshimjoyHu9vHCQVb3GpFLXKUd5hx4RXrw6q8nbnEDR5repFcP58BEzYWgeA3VjsmuqToRRCmpWFQBbE7n";
    const accountId = "account.near";
    const rpcUrl = "https://near.dev";
    const networkId = NEAR_TESTNET_NETWORK_ID;
    const network = {
        chainId: undefined,
        protocolFamily: "near",
        networkId: "near-testnet"
    }

    let wallet: NearKeypairWalletProvider;
    let keypair: KeyPair;

    beforeEach(() => {
        keypair = KeyPair.fromString(privateKey);

        wallet = new NearKeypairWalletProvider(
            keypair,
            accountId,
            rpcUrl,
            networkId
        );
    });


    it("should initialize correctly", async () => {
        expect(wallet.getPublicKey()).toEqual(keypair.getPublicKey().toString());
        expect(wallet.getAddress()).toEqual(accountId);
        expect(wallet.getNetwork()).toEqual(network);
        expect(wallet.getName()).toEqual("near_keypair_wallet_provider");

        const account = await wallet.getAccount();
        expect(account.accountId).toEqual(accountId);

        const connection = await wallet.getConnection();
        expect(connection.networkId).toEqual("testnet");
        expect(connection.provider.connection.url).toEqual(rpcUrl);
        expect(connection.jsvmAccountId).toEqual(accountId);
    });
})


