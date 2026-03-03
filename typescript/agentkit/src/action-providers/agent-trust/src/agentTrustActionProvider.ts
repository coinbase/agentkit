import { ActionProvider, createAction, WalletProvider, Network } from "../../../agentkit";
import { z } from "zod";

/**
 * Input schema for the get_trust_score action.
 */
const GetTrustScoreSchema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("The Ethereum/Base wallet address to check"),
    fullReport: z.boolean().optional().default(false).describe("Whether to include a detailed breakdown of factors")
});

/**
 * AgentTrust Action Provider
 * 
 * Provides automated reputational scoring for wallets on the Base network.
 * Supports the x402 protocol for automated machine-to-machine payments.
 */
export class AgentTrustActionProvider extends ActionProvider {
    constructor() {
        super("agent-trust", []);
    }

    /**
     * Verify the trust score and reputation of a wallet address.
     * 
     * @param walletProvider - The wallet provider to use for x402 payments
     * @param args - The arguments for the action
     * @returns A string describing the trust score or an error message
     */
    @createAction({
        name: "get_trust_score",
        description: "Verify the trust score and reputation of a wallet address on Base network. Returns a score (0-100) and a letter grade (AAA-C).",
        schema: GetTrustScoreSchema,
    })
    async getTrustScore(walletProvider: WalletProvider, args: z.infer<typeof GetTrustScoreSchema>): Promise<string> {
        const baseUrl = 'https://agent-trust-score.web.app/api';
        const url = `${baseUrl}/score/${args.address}${args.fullReport ? '?full=true' : ''}`;

        try {
            let response = await fetch(url);

            // Handle x402 (Payment Required)
            if (response.status === 402) {
                const paymentReq = await response.json();
                const paymentOption = paymentReq.accepts[0];

                if (!paymentOption) {
                    return "Error: Received 402 but no valid payment options were provided by the API.";
                }

                // Execute automated payment
                // Amount is in micro-USDC (1,000,000 = 1 USDC)
                const txHash = await walletProvider.sendTransaction({
                    to: "0x833589fCD6aDb6E08f4c7af08495567719621132", // USDC on Base
                    value: BigInt(0),
                    data: this.encodeUSDCTransfer(paymentOption.payTo, paymentOption.maxAmountRequired)
                });

                // Retry with payment proof
                response = await fetch(url, {
                    headers: { 'x-transaction-hash': txHash }
                });
            }

            if (!response.ok) {
                return `AgentTrust API Error: ${response.statusText}`;
            }

            const data = await response.json();
            return `Trust Score for ${args.address}: ${data.score}/100 (Grade: ${data.grade}). ${data.label}. Factors reviewed: ${Object.keys(data.factors || {}).join(', ')}.`;

        } catch (error: any) {
            return `Failed to fetch trust score: ${error.message}`;
        }
    }

    private encodeUSDCTransfer(to: string, amount: string): string {
        const selector = "a9059cbb";
        const cleanTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
        const cleanAmount = BigInt(amount).toString(16).padStart(64, "0");
        return `0x${selector}${cleanTo}${cleanAmount}`;
    }

    supportsNetwork(network: Network): boolean {
        return (network.protocolFamily === "evm" && (network.chainId === "8453" || network.chainId === "84532"));
    }
}
