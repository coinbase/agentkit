import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  CreateSecretSchema,
  ReadSecretSchema,
  SecretStatusSchema,
  NcryptedConfig,
} from "./schemas";
import { encrypt, decrypt, parseLink, EncryptedPayload } from "./crypto";

const DEFAULT_BASE_URL = "https://ncrypted.ai";
const CLIENT_HEADER = "agentkit/1";
const GONE_MESSAGE = "This secret has already been read, burned, or has expired.";

/**
 * NcryptedActionProvider lets an agent share secrets (passwords, API keys, private notes) as one-time,
 * end-to-end encrypted links instead of pasting them into chat or messages.
 *
 * Secrets are encrypted locally (AES-256-GCM); the decryption key only exists in the link's #fragment,
 * so the ncrypted service stores ciphertext only. A link can be opened exactly once.
 * The first 3 secrets per day are free; after that each costs 0.005 USDC on Base, paid via x402
 * from the agent's wallet. Reading a secret is always free.
 */
export class NcryptedActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPaymentUsdc: number;

  /**
   * Creates a new NcryptedActionProvider.
   *
   * @param config - Optional configuration (API origin and payment cap)
   */
  constructor(config: NcryptedConfig = {}) {
    super("ncrypted", []);
    this.baseUrl = (config.baseUrl ?? process.env.NCRYPTED_URL ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.maxPaymentUsdc = config.maxPaymentUsdc ?? 0.01;
  }

  /**
   * Creates a one-time secret link.
   *
   * @param walletProvider - The wallet that pays for the secret if the free tier is used up
   * @param args - The secret and options
   * @returns A message with the one-time link, or an error message
   */
  @CreateAction({
    name: "create_secret",
    description: `
This tool encrypts a sensitive value (password, API key, token, private note) and returns a one-time link.
The link can be opened exactly once, then the secret is destroyed. Use it whenever a credential must be shared
with a person or another agent, instead of putting the value in a message.

Inputs:
- secret: the sensitive value
- ttlSeconds (optional): expiry if never opened, 300 to 604800 seconds (default 86400)
- passphrase (optional): an extra secret the recipient must also know; send it through a different channel
- emailTo (optional): email the link to this address (paid secrets only)

Important notes:
- The first 3 secrets per day are free. After that each costs 0.005 USDC on Base, paid from the wallet.
- Never repeat the secret value in your reply. Share only the link, which is as sensitive as the secret.
`,
    schema: CreateSecretSchema,
  })
  async createSecret(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateSecretSchema>,
  ): Promise<string> {
    try {
      const { payload, key } = await encrypt(args.secret, args.passphrase);
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-ncrypted-client": CLIENT_HEADER,
      };
      // Email delivery needs a paid secret, so skip the free tier when it's requested.
      if (args.emailTo) headers["x-ncrypted-no-free"] = "1";

      const pay = wrapFetchWithPayment(fetch, this.createPaymentClient(walletProvider));
      const res = await pay(`${this.baseUrl}/api/v1/secrets`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...payload, ttl: args.ttlSeconds ?? 86400 }),
      });
      if (!res.ok) return `Error creating secret: ${await this.errorMessage(res)}`;

      const data = (await res.json()) as {
        id: string;
        url: string;
        expiresAt: string;
        receiptToken: string;
        free?: boolean;
      };
      const link = `${data.url}#${key}`;

      let emailed = false;
      if (args.emailTo) {
        const emailRes = await fetch(`${this.baseUrl}/api/v1/secrets/${data.id}/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${data.receiptToken}`,
            "x-ncrypted-client": CLIENT_HEADER,
          },
          body: JSON.stringify({ to: args.emailTo, link }),
        });
        if (!emailRes.ok) {
          return `Created a one-time link, but emailing it failed (${await this.errorMessage(emailRes)}). Link: ${link}`;
        }
        emailed = true;
      }

      return JSON.stringify({
        link,
        id: data.id,
        expiresAt: data.expiresAt,
        receiptToken: data.receiptToken,
        emailed,
        paid: !data.free,
        note: "The link opens exactly once. Share only the link, never the secret itself.",
      });
    } catch (error) {
      return `Error creating secret: ${error}`;
    }
  }

  /**
   * Reads (and destroys) a one-time secret.
   *
   * @param _walletProvider - Unused; reading is free
   * @param args - The link and optional passphrase
   * @returns The secret value, or an error message
   */
  @CreateAction({
    name: "read_secret",
    description: `
This tool opens an ncrypted one-time link (https://ncrypted.ai/s/{id}#{key}) and returns the secret.
Opening it destroys the secret permanently. Reading is free.

Inputs:
- link: the full link including the part after #
- passphrase (optional): required only if the sender set one

Important notes:
- Use the value only for the task at hand and do not repeat it in your reply.
`,
    schema: ReadSecretSchema,
  })
  async readSecret(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof ReadSecretSchema>,
  ): Promise<string> {
    try {
      const { origin, id, key } = parseLink(args.link);
      const res = await fetch(`${origin}/api/v1/secrets/${id}/reveal`, {
        method: "POST",
        headers: { "x-ncrypted-client": CLIENT_HEADER },
      });
      if (res.status === 404 || res.status === 410) return `Error reading secret: ${GONE_MESSAGE}`;
      if (!res.ok) return `Error reading secret: ${await this.errorMessage(res)}`;
      return await decrypt((await res.json()) as EncryptedPayload, key, args.passphrase);
    } catch (error) {
      return `Error reading secret: ${error}`;
    }
  }

  /**
   * Checks whether a secret created by this agent has been read.
   *
   * @param _walletProvider - Unused; status checks are free
   * @param args - The secret id and receipt token
   * @returns The status as JSON, or an error message
   */
  @CreateAction({
    name: "secret_status",
    description: `
This tool checks whether a one-time secret you created has been opened yet.
Returns pending, read, burned or expired. Free.

Inputs:
- id: the secret id returned by create_secret
- receiptToken: the receipt token returned by create_secret
`,
    schema: SecretStatusSchema,
  })
  async secretStatus(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof SecretStatusSchema>,
  ): Promise<string> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/secrets/${encodeURIComponent(args.id)}/status`,
        {
          headers: {
            authorization: `Bearer ${args.receiptToken}`,
            "x-ncrypted-client": CLIENT_HEADER,
          },
        },
      );
      if (!res.ok) return `Error checking secret status: ${await this.errorMessage(res)}`;
      return JSON.stringify(await res.json());
    } catch (error) {
      return `Error checking secret status: ${error}`;
    }
  }

  /**
   * Payments settle in USDC on Base mainnet, so the provider is offered there.
   *
   * @param network - The network to check support for
   * @returns True if the network is Base mainnet
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.networkId === "base-mainnet";

  /**
   * Creates an x402 client that pays from the agent's wallet, capped at maxPaymentUsdc per secret.
   *
   * @param walletProvider - The wallet provider to pay with
   * @returns The configured x402 client
   */
  private createPaymentClient(walletProvider: EvmWalletProvider): x402Client {
    const client = new x402Client();
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
    // Never pay more than maxPaymentUsdc for one secret, whatever the server asks (USDC has 6 decimals).
    const cap = BigInt(Math.round(this.maxPaymentUsdc * 1e6));
    client.registerPolicy((_version, requirements) =>
      requirements.filter(r => {
        const amount =
          (r as { amount?: string }).amount ??
          (r as { maxAmountRequired?: string }).maxAmountRequired;
        return amount !== undefined && BigInt(amount) <= cap;
      }),
    );
    return client;
  }

  /**
   * Extracts a readable error message from an ncrypted API response.
   *
   * @param res - The failed response
   * @returns The error message
   */
  private async errorMessage(res: Response): Promise<string> {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the status text
    }
    if (res.status === 402) {
      message = `Payment required. The free tier is used up and the wallet couldn't pay 0.005 USDC on Base (${message}).`;
    }
    return message;
  }
}

export const ncryptedActionProvider = (config?: NcryptedConfig) =>
  new NcryptedActionProvider(config);
