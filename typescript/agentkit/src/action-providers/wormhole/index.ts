import { z } from "zod";
import {
    ActionProvider,
    WalletProvider,
    Network,
    CreateAction,
} from "@coinbase/agentkit";
import {
    amount,
    Chain,
    chains,
    signSendWait,
    Wormhole,
    wormhole,
    UnsignedTransaction,
} from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import { getSigner } from "./helpers/signer";

const SupportedChains = [
    'Base',
    'Arbitrum',
    'Ethereum',
    'Polygon',
    'Optimism',
    'BaseSepolia',
    'ArbitrumSepolia',
    'PolygonSepolia',
    'OptimismSepolia',
] as const;

export const WormholeActionTransferSchema = z.object({
    sourceChain: z.enum(SupportedChains).describe("Source chain for the transfer (ethereum, base, arbitrum, optimism, polygon, or their Sepolia testnet versions)"),
    destinationChain: z.enum(SupportedChains).describe("Destination chain for the transfer (ethereum, base, arbitrum, optimism, polygon, or their Sepolia testnet versions)"),
    amount_value: z.string().describe('Amount of native token that will be transferred from source chain to destination chain')
});

export const WormholeActionRedeemSchema = z.object({
    sourceChain: z.enum(SupportedChains).describe("Source chain for the transfer (ethereum, base, arbitrum, optimism, polygon, or their Sepolia testnet versions)"),
    destinationChain: z.enum(SupportedChains).describe("Destination chain for the transfer (ethereum, base, arbitrum, optimism, polygon, or their Sepolia testnet versions)"),
    amount_value: z.string().describe('Amount of native token that will be transferred from source chain to destination chain'),
    transaction_id: z.string().describe('Transaction ID of the transaction by which the agent can redeem the token')
});

export class WormholeActionProvider extends ActionProvider<WalletProvider> {
    private wh!: Wormhole<"Testnet">;
    constructor() {
        super("wormhole-action", []);
        this.initializeWormhole();
    }

    private async initializeWormhole() {
        console.log("[WormholeAction] Initializing Wormhole SDK");
        try {
            const wh = await wormhole("Testnet", [
                evm,
            ]);
            console.log("[WormholeAction] Wormhole initialized successfully");
            this.wh = wh;
        } catch (error) {
            console.error("[WormholeAction] Error initializing Wormhole:", error);
            throw error;
        }
    }

    @CreateAction({
        name: "transfer_native_tokens",
        description: `Transfer native tokens from Source Chain to Destination Chain
        - Make sure to check for the source chain, Source chain should be supported by the agentkit.
        
        `,
        schema: WormholeActionTransferSchema,
    })
    async transferNativeTokenActivity(
        params: z.infer<typeof WormholeActionTransferSchema>
    ): Promise<string> {
        const { sourceChain, destinationChain, amount_value } = params;

        console.log(`[Wormhole] Starting transfer from ${sourceChain} to ${destinationChain} for amount ${amount_value}`);
        console.log(`[Wormhole] InitializeWormhole completed: ${this.wh ? 'Yes' : 'No'}`);

        try {
            console.log(`[Wormhole] Getting chain objects for ${sourceChain} and ${destinationChain}`);
            const srcChain = this.wh.getChain(sourceChain);
            const dstChain = this.wh.getChain(destinationChain);
            console.log(`[Wormhole] Successfully got chain objects`);

            console.log(`[Wormhole] Getting signers for source and destination chains`);
            const sender = await getSigner(srcChain);
            const receiver = await getSigner(dstChain);
            console.log(`[Wormhole] Signers obtained. Source chain: ${srcChain.chain}, Destination chain: ${dstChain.chain}`);

            const token = await srcChain.getNativeWrappedTokenId();
            console.log(`[Wormhole] Source Chain Token:`, token);
            
            const destTokenBridge = await dstChain.getTokenBridge();
            console.log(`[Wormhole] Destination Chain Token Bridge initialized`);

            try {
                const wrapped = await destTokenBridge.getWrappedAsset(token);
                console.log(
                    `Token already wrapped on ${dstChain.chain}. Skipping attestation.`,
                    wrapped
                );
            } catch (error) {
                console.log(
                    `No wrapped token found on ${dstChain.chain}. Please try again with other chain.`
                );

                throw new Error(`No wrapped token found on: ${dstChain.chain}.Please try again with other chain. `);
            }

            const sourceTokenBridge = await srcChain.getTokenBridge();
            const tokenId = Wormhole.tokenId(srcChain.chain, "native");

            const amt = amount.units(
                amount.parse(
                    amount_value,
                    srcChain.config.nativeTokenDecimals
                )
            );

            // Prepare the transfer details
            console.log(`[Wormhole] Preparing transfer details`);
            console.log(`[Wormhole] Token address: ${tokenId.address}`);
            console.log(`[Wormhole] Amount: ${amt}`);
            
            // Get the sender address from the signer - add robust error handling
            let senderAddress;
            try {
                // Check if getAddress is a function, otherwise use the address property
                if (typeof sender.address === 'function') {
                    senderAddress = await sender.address;
                } else if (sender.address) {
                    senderAddress = sender.address;
                    console.log(`[Wormhole] Using sender address property: ${senderAddress}`);
                } else {
                    throw new Error("Sender has no valid address method or property");
                }
                console.log(`[Wormhole] Sender address: ${senderAddress.toString()}`);
            } catch (error) {
                console.error(`[Wormhole] Error getting sender address:`, error);
                throw new Error(`Failed to get sender address: ${(error as any).message}`);
            }
            
            // Get the receiver address from the signer - also with robust error handling
            let receiverAddress;
            try {
                // Similar check for getAddress or address property
                if (typeof receiver.address === 'function') {
                    receiverAddress = await receiver.address;
                } else if (receiver.address) {
                    receiverAddress = receiver.address;
                    console.log(`[Wormhole] Using receiver address property: ${receiverAddress}`);
                } else {
                    throw new Error("Receiver has no valid address method or property");
                }
                console.log(`[Wormhole] Receiver address: ${receiverAddress.toString()}`);
            } catch (error) {
                console.error(`[Wormhole] Error getting receiver address:`, error);
                throw new Error(`Failed to get receiver address: ${(error as any).message}`);
            }

            // First, create the transfer with the correct chain context
            console.log(`[Wormhole] Creating token bridge transfer with proper context`);

            console.log(sender , receiver ,"sender and receiver")
            
            // This is the key fix - we need to use the correct chain context
            const transfer = sourceTokenBridge.transfer(
                sender.address.address,
                receiver.address,
                tokenId.address,
                amt
            );

            console.log(`[Wormhole] Transfer created, using signSendWait with source chain ${srcChain.chain}`);
            
            // Use the Wormhole SDK's signSendWait function to handle the transfer properly
            // This ensures the chain context is maintained correctly
            const txids = await signSendWait(srcChain, transfer, sender.signer);
            
            console.log(`[Wormhole] Transfer completed, transaction IDs:`, txids);
            
            if (!txids || txids.length === 0) {
                throw new Error("No transaction IDs returned from transfer");
            }
            
            const latestTxId = txids[txids.length - 1].txid;
            const explorer = `https://wormholescan.io/#/tx/${latestTxId}`;
            
            console.log(`[Wormhole] Transfer successful. Explorer URL: ${explorer}`);
            return `Transaction was successful. It will take some time to claim your balance. Your transaction Id is ${latestTxId} and you can check here ${explorer}`;

        } catch (error) {
            console.log("Error in transferring the native tokens", error);
            return `Error transferring tokens: ${(error as any).message}`
        }
    }


    @CreateAction({
        name: "redeem_native_tokens",
        description: `Redeem native token on the destination Chain by passing the transactionID.
        - Make sure to check for the source chain, Source chain should be supported by the agentkit.
        `,
        schema: WormholeActionRedeemSchema,
    })
    async redeemNativeTokenActivity(
        params: z.infer<typeof WormholeActionRedeemSchema>
    ): Promise<string> {
        const { sourceChain, destinationChain, amount_value, transaction_id } = params;

        console.log(`[Wormhole] Starting redemption from ${sourceChain} to ${destinationChain} for transaction ${transaction_id}`);

        try {
            console.log(`[Wormhole] Getting chain objects for ${sourceChain} and ${destinationChain}`);
            const srcChain = this.wh.getChain(sourceChain);
            const dstChain = this.wh.getChain(destinationChain);
            console.log(`[Wormhole] Successfully got chain objects`);

            console.log(`[Wormhole] Getting receiver signer for ${destinationChain}`);
            const receiver = await getSigner(dstChain);
            
            // Get the receiver address from the signer - with robust error handling
            let receiverAddress;
            try {
                // Check if getAddress is a function, otherwise use the address property
                if (typeof receiver.address === 'function') {
                    receiverAddress = await receiver.address;
                } else if (receiver.address) {
                    receiverAddress = receiver.address;
                    console.log(`[Wormhole] Using receiver address property: ${receiverAddress}`);
                } else {
                    throw new Error("Receiver has no valid address method or property");
                }
                console.log(`[Wormhole] Receiver address: ${receiverAddress.toString()}`);
            } catch (error) {
                console.error(`[Wormhole] Error getting receiver address:`, error);
                throw new Error(`Failed to get receiver address: ${(error as any).message}`);
            }

            console.log(`[Wormhole] Parsing transaction: ${transaction_id}`);
            const [whm] = await srcChain.parseTransaction(transaction_id);
            console.log('[Wormhole] Wormhole Messages:', whm);

            console.log(`[Wormhole] Getting VAA for the transfer`);
            const vaa = await this.wh.getVaa(
                // Wormhole Message ID
                whm,
                // Protocol:Payload name to use for decoding the VAA payload
                'TokenBridge:Transfer',
                // Timeout in milliseconds, depending on the chain and network, the VAA may take some time to be available
                600_000
            );

            if (vaa == null) {
                console.error("[Wormhole] Transfer is still in progress, please claim later");
                const explorer = `https://wormholescan.io/#/tx/${transaction_id}`;

                return `Transaction has not reached destination, please wait for more minutes. You can check the status here: ${explorer}`
            }

            console.log(`[Wormhole] VAA received, getting token bridge for destination chain`);
            const rcvTb = await dstChain.getTokenBridge();

            console.log(`[Wormhole] Preparing redemption transaction`);
            const redeem = rcvTb.redeem(receiver.address.address, vaa);
            console.log("[Wormhole] Redemption transaction prepared");

            console.log(`[Wormhole] Using signSendWait for redemption with destination chain ${dstChain.chain}`);
            
            // Use the Wormhole SDK's signSendWait function to handle the redemption properly
            // This ensures the chain context is maintained correctly
            const rcvTxids = await signSendWait(dstChain, redeem, receiver.signer);
            
            console.log(`[Wormhole] Redemption transactions sent, transaction IDs:`, rcvTxids);
            
            if (!rcvTxids || rcvTxids.length === 0) {
                throw new Error("No transaction IDs returned from redemption");
            }
            
            // Now check if the transfer is completed according to
            // the destination token bridge
            console.log(`[Wormhole] Checking if transfer is completed`);
            const finished = await rcvTb.isTransferCompleted(vaa);
            console.log('[Wormhole] Transfer completed:', finished);

            const latestTxId = rcvTxids[rcvTxids.length - 1].txid;
            const explorer = `https://wormholescan.io/#/tx/${latestTxId}`;

            console.log(`[Wormhole] Redemption successful. Explorer URL: ${explorer}`);
            return `Transaction was successful. It will take some time to claim your balance. Your transaction Id is ${latestTxId} and you can check here ${explorer}`;

        } catch (error) {
            console.log("[Wormhole] Error in redeeming tokens", error);
            return `Error transferring tokens: ${(error as any).message}`
        }
    }

    supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const wormholeActionProvider = () => new WormholeActionProvider();
