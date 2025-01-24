import { Wallet, Address } from "@coinbase/coinbase-sdk";
import { z } from "zod";

import { CdpAction } from "./cdp_action";

const ADDRESS_REPUTATION_PROMPT = `
This tool checks the reputation of an address on a given network. It takes:

- network: The network to check the address on (e.g. "base-mainnet")
- address: The Ethereum address to check

Important notes:
- This tool will not work on base-sepolia, you can default to using base-mainnet instead
- The wallet's default address and its network may be used if not provided
`;

/**
 * Input schema for address reputation check.
 */
export const AddressReputationInput = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The Ethereum address to check"),
    network: z.string().describe("The network to check the address on"),
  })
  .strip()
  .describe("Input schema for address reputation check");

/**
 * Check the reputation of an address.
 *
 * @param wallet - The wallet instance
 * @param args - The input arguments for the action
 * @returns A string containing reputation data or error message
 */
export async function checkAddressReputation(
  args: z.infer<typeof AddressReputationInput>,
): Promise<string> {
  try {
    const address = new Address(args.network, args.address);
    const reputation = await address.reputation();
    return reputation.toString();
  } catch (error) {
    return `Error checking address reputation: ${error}`;
  }
}

/**
 * Address reputation check action.
 */
export class AddressReputationAction implements CdpAction<typeof AddressReputationInput> {
  public name = "address_reputation";
  public description = ADDRESS_REPUTATION_PROMPT;
  public argsSchema = AddressReputationInput;
  public func = checkAddressReputation;
}
