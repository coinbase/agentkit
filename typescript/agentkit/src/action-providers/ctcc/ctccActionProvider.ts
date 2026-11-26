import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { CheckTokenControlSchema } from "./schemas";
import { CtccClient } from "@cinqueport/ctcc-x402";

export class CtccActionProvider extends ActionProvider<EvmWalletProvider> {
  private endpoint: string;

  constructor(endpoint = "https://cinqueport.net/check") {
    super("ctcc", []);
    this.endpoint = endpoint;
  }

  @CreateAction({
    name: "check_token_control",
    description: `
    Deterministic smart-contract authority and control inspection for Base Mainnet (eip155:8453).
    Discovers bytecode presence, ERC-20 metadata, owner addresses, pause states, and EIP-1967 proxy pointers
    via $0.01 USDC x402 v2 micropayments. Returns structured observable facts with zero subjective bias.
    `,
    schema: CheckTokenControlSchema,
  })
  async checkTokenControl(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckTokenControlSchema>,
  ): Promise<string> {
    try {
      const client = new CtccClient({
        endpoint: this.endpoint,
        signer: walletProvider,
        cacheTtlMs: 300000,
      });

      const observations = await client.checkTokenControl(args.contractAddress);
      return JSON.stringify(observations, null, 2);
    } catch (err: any) {
      return JSON.stringify({
        error: err.message,
        contract_address: args.contractAddress,
        disclaimer: "CTCC inspection failed. Verify contract address or agent wallet funds.",
      });
    }
  }

  supportsNetwork = (network: Network) => {
    const chainId = String(network.chainId);
    return chainId === "8453" || chainId === "eip155:8453";
  };
}

export const ctccActionProvider = (endpoint?: string) => new CtccActionProvider(endpoint);
