/**
 * RelayShield Action Provider
 *
 * Counterparty and content screening for agents, paid per call over x402.
 *
 * @module relayshield
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import {
  ScreenWalletSchema,
  CheckTokenSecuritySchema,
  CheckNftSecuritySchema,
  ScreenUrlSchema,
} from "./schemas";
import { RELAYSHIELD_API_BASE, SUPPORTED_NETWORKS, ENDPOINTS } from "./constants";

/**
 * RelayShieldActionProvider screens counterparties and content before an agent acts on them.
 *
 * @description
 * Each action calls a RelayShield pay-as-you-go endpoint, which answers with an
 * HTTP 402 challenge. The agent's own wallet settles the payment in USDC, so no
 * account or API key is needed. Payment settles on Base or Solana.
 */
export class RelayShieldActionProvider extends ActionProvider<WalletProvider> {
  /**
   * Constructor for the RelayShieldActionProvider.
   */
  constructor() {
    super("relayshield", []);
  }

  /**
   * Screens a wallet address for known malicious association.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param args - The address to screen
   * @returns A JSON string with the risk level and any risk flags
   */
  @CreateAction({
    name: "screen_wallet",
    description: `
This tool screens a counterparty wallet address for known scam, exploit, drainer or sanctions-list association before your agent transacts with it.

It takes a single wallet address. EVM (0x followed by 40 hex characters), Solana (base58), TON (EQ.../UQ...) and Bitcoin addresses are all accepted, and the chain is detected from the address format, so do not ask the user which chain it is on.

Call this before sending funds to, swapping with, or otherwise transacting with an address the agent has not dealt with before. It returns a risk level and the specific risk flags that fired.

Absence of a risk flag is not proof that an address is safe, only that nothing is currently known against it. Treat a clean result as the absence of evidence rather than evidence of absence, and say so when reporting it to the user.

Each call costs ${ENDPOINTS.walletRisk.priceUsd} USDC, paid automatically from the agent's wallet.
`,
    schema: ScreenWalletSchema,
  })
  async screenWallet(
    walletProvider: WalletProvider,
    args: z.infer<typeof ScreenWalletSchema>,
  ): Promise<string> {
    return this.callRelayShield(walletProvider, ENDPOINTS.walletRisk.path, {
      address: args.address,
    });
  }

  /**
   * Checks a token contract for security risks.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param args - The token contract address and its chain id
   * @returns A JSON string with the token's risk assessment
   */
  @CreateAction({
    name: "check_token_security",
    description: `
This tool checks an ERC-20 style token contract for security risks such as honeypot behaviour, mintable supply, blacklist functions, proxy upgradeability and trading restrictions.

It takes the token contract address and the chain id it is deployed on, as a decimal string, for example '1' for Ethereum mainnet, '8453' for Base, '56' for BNB Chain. Do not pass the token symbol as the contract address. If you do not know the contract address, ask the user rather than guessing, since two tokens can share a symbol.

Call this before buying or swapping into a token the agent has not traded before.

Each call costs ${ENDPOINTS.tokenSecurity.priceUsd} USDC, paid automatically from the agent's wallet.
`,
    schema: CheckTokenSecuritySchema,
  })
  async checkTokenSecurity(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckTokenSecuritySchema>,
  ): Promise<string> {
    return this.callRelayShield(walletProvider, ENDPOINTS.tokenSecurity.path, {
      contract_address: args.contractAddress,
      chain_id: args.chainId,
    });
  }

  /**
   * Checks an NFT collection for security risks.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param args - The NFT contract address and its chain id
   * @returns A JSON string with the collection's risk assessment
   */
  @CreateAction({
    name: "check_nft_security",
    description: `
This tool checks an NFT collection contract for security risks such as fake or copied collections, malicious transfer restrictions, and privileged owner functions.

It takes the collection contract address and the chain id it is deployed on, as a decimal string, for example '1' for Ethereum mainnet, '8453' for Base.

Call this before buying an NFT from a collection the agent has not dealt with before.

Each call costs ${ENDPOINTS.nftSecurity.priceUsd} USDC, paid automatically from the agent's wallet.
`,
    schema: CheckNftSecuritySchema,
  })
  async checkNftSecurity(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckNftSecuritySchema>,
  ): Promise<string> {
    return this.callRelayShield(walletProvider, ENDPOINTS.nftSecurity.path, {
      contract_address: args.contractAddress,
      chain_id: args.chainId,
    });
  }

  /**
   * Screens a URL for phishing or malware.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param args - The URL to screen
   * @returns A JSON string with the URL verdict and the signals behind it
   */
  @CreateAction({
    name: "screen_url",
    description: `
This tool screens a URL for phishing or malware before the agent follows it, renders it, or passes it on to the user.

It takes one full URL including the scheme, for example https://example.com/claim. It returns a verdict together with the specific signals that fired.

Call this for any link that arrived from an untrusted source, in particular one that asks for a wallet connection, a signature or a seed phrase.

Each call costs ${ENDPOINTS.scanUrl.priceUsd} USDC, paid automatically from the agent's wallet.
`,
    schema: ScreenUrlSchema,
  })
  async screenUrl(
    walletProvider: WalletProvider,
    args: z.infer<typeof ScreenUrlSchema>,
  ): Promise<string> {
    return this.callRelayShield(walletProvider, ENDPOINTS.scanUrl.path, { url: args.url });
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if x402 payment can settle on this network
   */
  supportsNetwork(network: Network): boolean {
    return SUPPORTED_NETWORKS.includes(network.networkId as (typeof SUPPORTED_NETWORKS)[number]);
  }

  /**
   * Builds an x402 client bound to the agent's wallet.
   *
   * @param walletProvider - The wallet provider to sign payments with
   * @returns An x402 client with the matching payment scheme registered
   */
  private async createX402Client(walletProvider: WalletProvider): Promise<x402Client> {
    const client = new x402Client();

    if (walletProvider instanceof EvmWalletProvider) {
      const account = walletProvider.toSigner();
      const signer = {
        ...account,
        readContract: (args: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: args.address,
            abi: args.abi as never,
            functionName: args.functionName as never,
            args: args.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer });
    } else if (walletProvider instanceof SvmWalletProvider) {
      const signer = await walletProvider.toSigner();
      registerExactSvmScheme(client, { signer });
    }

    return client;
  }

  /**
   * Calls a RelayShield endpoint, paying the 402 challenge from the agent's wallet.
   *
   * Errors are returned as a string rather than thrown, so the model can report
   * the failure to the user instead of the run aborting. The message always
   * states that the check did not complete, because a screening tool that looks
   * like it returned "nothing found" when it actually failed is worse than one
   * that plainly says it could not answer.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param path - The endpoint path to call
   * @param body - The JSON request body
   * @returns The endpoint response as a JSON string, or an error message
   */
  private async callRelayShield(
    walletProvider: WalletProvider,
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    try {
      const client = await this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      const response = await fetchWithPayment(`${RELAYSHIELD_API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        return `RelayShield check did NOT complete: HTTP ${response.status} from ${path}. This is not a clean result. Response: ${text}`;
      }

      return text;
    } catch (error) {
      return `RelayShield check did NOT complete: ${error}. This is not a clean result, and the screened item should be treated as unverified.`;
    }
  }
}

/**
 * Factory function to create a new RelayShieldActionProvider instance.
 *
 * @returns A new RelayShieldActionProvider instance
 */
export const relayshieldActionProvider = () => new RelayShieldActionProvider();
