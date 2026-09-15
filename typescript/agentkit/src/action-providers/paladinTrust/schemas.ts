import { z } from "zod";

/**
 * Input schema for `check_token_risk`. Returns a composed-risk recommendation
 * for a token contract by querying the PaladinFi Trust Check API (preview
 * endpoint).
 */
export const CheckTokenRiskSchema = z
  .object({
    chainId: z
      .number()
      .int()
      .positive()
      .describe(
        "The chain ID of the network where the token lives. PaladinFi currently supports Base mainnet (8453) only.",
      ),
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The contract address of the token to evaluate"),
  })
  .describe(
    "Evaluate a token contract against PaladinFi's composed risk gate (OFAC SDN, GoPlus, Etherscan source verification, anomaly heuristics) via the free preview endpoint.",
  );
