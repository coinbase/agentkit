import { Buffer } from "node:buffer";
import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { encodeFunctionData, erc20Abi } from "viem";
import {
  ScrapeWebpageSchema,
  DigestWebpageSchema,
  AuditWebpageSchema,
  SearchWebSchema,
  SearchTwitterSchema,
  GetTwitterProfileSchema,
  X402ScraperConfig,
} from "./schemas";

export const DEFAULT_WORKER_URL = "https://x402-scraper-engine.gejoe-tt.workers.dev";
export const DEFAULT_TREASURY = "0x4107f297256E00F32873f45F50A35a902c1c2034";
export const USDC_BASE_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const DEFAULT_MAX_USDC = 0.5;

/**
 * Autonomous HTTP 402 Web Scraper, Digest & Intelligence Action Provider for Coinbase AgentKit.
 * Empowers AI agents to scrape clean Markdown, synthesize executive digests, conduct security audits,
 * search the live web, and monitor Twitter/X sentiment on Base L2 via autonomous micropayments.
 */
export class X402ScraperActionProvider extends ActionProvider<EvmWalletProvider> {
  public readonly workerUrl: string;
  public readonly treasuryAddress: string;
  public readonly maxPaymentUsdc: number;

  /**
   * Constructs a new X402ScraperActionProvider instance.
   *
   * @param config - Optional configuration settings.
   */
  constructor(config: X402ScraperConfig = {}) {
    super("x402_scraper", []);
    this.workerUrl = (config.workerUrl || DEFAULT_WORKER_URL).replace(/\/$/, "");
    this.treasuryAddress = config.treasuryAddress || DEFAULT_TREASURY;
    this.maxPaymentUsdc = config.maxPaymentUsdc ?? DEFAULT_MAX_USDC;
  }

  /**
   * Verifies if the network is supported (Base Mainnet / EVM).
   *
   * @param network - The target network.
   * @returns True if network protocol family is EVM.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";

  /**
   * Scrapes any public webpage and extracts clean, token-efficient Markdown for LLM contexts.
   *
   * @param walletProvider - The EVM wallet provider to sign settlement.
   * @param args - Scrape webpage arguments.
   * @returns Clean markdown and page metadata.
   */
  @CreateAction({
    name: "scrape_webpage",
    description: `Scrapes any public webpage and extracts clean, token-efficient Markdown for LLM prompts.
Includes title, description, markdown body, word count, and token estimate.
Includes 2 free trial requests, then automatically micro-settles 0.005 USDC on Base L2.`,
    schema: ScrapeWebpageSchema,
  })
  async scrapeWebpage(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScrapeWebpageSchema>,
  ): Promise<string> {
    return this.executeWithPayment("/v1/scrape", { url: args.url }, walletProvider);
  }

  /**
   * Synthesizes an executive summary, key takeaways, and structured entities via Edge Llama-3.
   *
   * @param walletProvider - The EVM wallet provider to sign settlement.
   * @param args - Digest webpage arguments.
   * @returns Synthesized digest with bullet points and key takeaways.
   */
  @CreateAction({
    name: "digest_webpage",
    description: `Extracts executive summaries, key takeaways, and structured entities from any webpage using Edge Llama-3.
Format options: 'executive', 'bullets', 'technical'.
Includes 2 free trial requests, then automatically micro-settles 0.025 USDC on Base L2.`,
    schema: DigestWebpageSchema,
  })
  async digestWebpage(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DigestWebpageSchema>,
  ): Promise<string> {
    return this.executeWithPayment(
      "/v1/digest",
      { url: args.url, format: args.format },
      walletProvider,
    );
  }

  /**
   * Audits website security, phishing risks, credibility signals, and smart contract links.
   *
   * @param walletProvider - The EVM wallet provider to sign settlement.
   * @param args - Audit webpage arguments.
   * @returns Security audit score, risk flags, and technical hygiene breakdown.
   */
  @CreateAction({
    name: "audit_webpage",
    description: `Audits website security, phishing risks, domain credibility signals, SSL status, and smart contract signals.
Returns risk score (0-100), severity flags, and hygiene breakdown.
Includes 2 free trial requests, then automatically micro-settles 0.080 USDC on Base L2.`,
    schema: AuditWebpageSchema,
  })
  async auditWebpage(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AuditWebpageSchema>,
  ): Promise<string> {
    return this.executeWithPayment("/v1/audit", { url: args.url }, walletProvider);
  }

  /**
   * Searches the live web across multiple engines and extracts synthesized clean Markdown.
   *
   * @param walletProvider - The EVM wallet provider to sign settlement.
   * @param args - Search web arguments.
   * @returns Synthesized live search results with citations and titles.
   */
  @CreateAction({
    name: "search_web",
    description: `Searches the live web across multiple search engines and returns clean synthesized Markdown with citations.
Includes 2 free trial requests, then automatically micro-settles 0.050 USDC on Base L2.`,
    schema: SearchWebSchema,
  })
  async searchWeb(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SearchWebSchema>,
  ): Promise<string> {
    return this.executeWithPayment(
      "/v1/search",
      { query: args.query, numResults: args.numResults },
      walletProvider,
    );
  }

  /**
   * Searches Twitter/X for keywords, cashtags (e.g. $BASE), sentiment, and recent tweets.
   *
   * @param walletProvider - The EVM wallet provider to sign settlement.
   * @param args - Search Twitter arguments.
   * @returns Matching recent tweets with engagement metrics and sentiment indicators.
   */
  @CreateAction({
    name: "search_twitter",
    description: `Searches Twitter/X for keywords, cashtags (e.g. $BASE, $ETH), sentiment, and recent tweets.
Includes 2 free trial requests, then automatically micro-settles 0.050 USDC on Base L2.`,
    schema: SearchTwitterSchema,
  })
  async searchTwitter(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SearchTwitterSchema>,
  ): Promise<string> {
    return this.executeWithPayment(
      "/v1/twitter/search",
      { query: args.query, maxResults: args.maxResults },
      walletProvider,
    );
  }

  /**
   * Fetches a Twitter/X user profile bio, followers count, verification status, and recent timeline.
   *
   * @param walletProvider - The EVM wallet provider to sign settlement.
   * @param args - Get Twitter profile arguments.
   * @returns Verified profile metrics, bio, follower count, and recent tweets.
   */
  @CreateAction({
    name: "get_twitter_profile",
    description: `Fetches a Twitter/X user profile bio, followers count, verification status, and recent timeline.
Includes 2 free trial requests, then automatically micro-settles 0.030 USDC on Base L2.`,
    schema: GetTwitterProfileSchema,
  })
  async getTwitterProfile(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTwitterProfileSchema>,
  ): Promise<string> {
    return this.executeWithPayment(
      "/v1/twitter/profile",
      { handle: args.handle },
      walletProvider,
    );
  }

  /**
   * Executes HTTP request with dual-rail autonomous x402 payment handling.
   *
   * Rail A: EIP-712 gasless TransferWithAuthorization via PayAI facilitator.
   * Rail B: Fallback direct on-chain ERC-20 transfer receipt via walletProvider.sendTransaction.
   *
   * @param path - API path.
   * @param body - Request body.
   * @param walletProvider - EVM wallet provider.
   * @returns Stringified result or structured error.
   */
  private async executeWithPayment(
    path: string,
    body: Record<string, unknown>,
    walletProvider?: EvmWalletProvider,
  ): Promise<string> {
    const targetUrl = `${this.workerUrl}${path}`;

    try {
      // Step 1: Initial probe (consumes free trial grace tier if available)
      const probeRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "agentkit-x402-scraper/1.4.1",
        },
        body: JSON.stringify(body),
      });

      if (probeRes.ok) {
        const data = await probeRes.json();
        return JSON.stringify(data, null, 2);
      }

      if (probeRes.status !== 402) {
        const errText = await probeRes.text();
        return JSON.stringify(
          { error: `Service returned HTTP ${probeRes.status}`, details: errText },
          null,
          2,
        );
      }

      // Step 2: Parse HTTP 402 Payment Required
      if (!walletProvider) {
        return JSON.stringify({
          error: "HTTP 402 Payment Required: Free trial exhausted and no EVM wallet provider supplied.",
          status: 402,
        });
      }

      const paymentHeader =
        probeRes.headers.get("payment-required") ||
        probeRes.headers.get("PAYMENT-REQUIRED");
      let paymentRequirements: Record<string, unknown> | null = null;

      if (paymentHeader) {
        try {
          paymentRequirements = JSON.parse(
            Buffer.from(paymentHeader, "base64").toString("utf-8"),
          );
        } catch {
          // fallback to JSON challenge body
        }
      }

      if (!paymentRequirements) {
        try {
          paymentRequirements = (await probeRes.json()) as Record<string, unknown>;
        } catch {
          // ignore
        }
      }

      const atomicAmount = Number(
        (paymentRequirements?.payment as Record<string, unknown>)?.amount ||
          paymentRequirements?.maxAmountRequired ||
          paymentRequirements?.amount ||
          5000,
      );
      const usdcAmount = atomicAmount / 1_000_000;

      if (usdcAmount > this.maxPaymentUsdc) {
        return JSON.stringify({
          error: `Payment requirement of ${usdcAmount} USDC exceeds configured ceiling of ${this.maxPaymentUsdc} USDC`,
          status: 402,
        });
      }

      const payerAddress = (await walletProvider.getAddress()) as `0x${string}`;
      const recipientAddress = (this.treasuryAddress ||
        (paymentRequirements?.payment as Record<string, unknown>)?.recipient ||
        DEFAULT_TREASURY) as `0x${string}`;

      // Step 3: Dual-Rail Autonomous Settlement
      // Rail A: Gasless EIP-712 signature (PayAI / CDP facilitation)
      try {
        const now = Math.floor(Date.now() / 1000);
        const validAfter = now - 60;
        const validBefore = now + 3600;
        const nonce = `0x${Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join("")}`;

        const typedData = {
          domain: {
            name: "USD Coin",
            version: "2",
            chainId: 8453,
            verifyingContract: USDC_BASE_CONTRACT,
          },
          types: {
            TransferWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
            ],
          },
          primaryType: "TransferWithAuthorization",
          message: {
            from: payerAddress,
            to: recipientAddress,
            value: BigInt(atomicAmount),
            validAfter: BigInt(validAfter),
            validBefore: BigInt(validBefore),
            nonce,
          },
        };

        const signature = await walletProvider.signTypedData(typedData as unknown as Parameters<typeof walletProvider.signTypedData>[0]);

        if (signature) {
          const signaturePayload = Buffer.from(
            JSON.stringify({
              x402Version: 2,
              scheme: "exact",
              network: "eip155:8453",
              asset: USDC_BASE_CONTRACT,
              payer: payerAddress,
              recipient: recipientAddress,
              amount: String(atomicAmount),
              signature,
              authorization: {
                from: payerAddress,
                to: recipientAddress,
                value: String(atomicAmount),
                validAfter: String(validAfter),
                validBefore: String(validBefore),
                nonce,
              },
            }),
          ).toString("base64");

          const signedRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "agentkit-x402-scraper/1.4.1",
              "PAYMENT-SIGNATURE": signaturePayload,
              "payment-signature": signaturePayload,
            },
            body: JSON.stringify(body),
          });

          if (signedRes.ok) {
            const data = await signedRes.json();
            return JSON.stringify(data, null, 2);
          }
        }
      } catch {
        // Fall through to Rail B direct transaction
      }

      // Rail B: Direct on-chain ERC-20 transfer fallback
      const txData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipientAddress, BigInt(atomicAmount)],
      });

      const txHash = await walletProvider.sendTransaction({
        to: USDC_BASE_CONTRACT as `0x${string}`,
        data: txData,
      });

      const retryRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "agentkit-x402-scraper/1.4.1",
          "X-Payment-Receipt": txHash,
        },
        body: JSON.stringify(body),
      });

      if (retryRes.ok) {
        const data = await retryRes.json();
        return JSON.stringify(data, null, 2);
      }

      const retryError = await retryRes.text();
      return JSON.stringify(
        {
          error: `Payment submitted (tx: ${txHash}), but endpoint returned HTTP ${retryRes.status}`,
          details: retryError,
        },
        null,
        2,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: "Failed to execute x402 request", details: message }, null, 2);
    }
  }
}

/**
 * Factory function for creating an X402ScraperActionProvider.
 *
 * @param config - Optional configuration parameters.
 * @returns Configured X402ScraperActionProvider instance.
 */
export const x402ScraperActionProvider = (config?: X402ScraperConfig) =>
  new X402ScraperActionProvider(config);
