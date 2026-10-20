import { z } from "zod";
import { keccak256, recoverTypedDataAddress, type Hex } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  x402Client,
  wrapFetchWithPayment,
  type PaymentPolicy,
  type PaymentRequirements,
} from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { TOKEN_ADDRESSES_BY_SYMBOLS } from "../erc20/constants";
import {
  ListFeedsSchema,
  QueryFeedSchema,
  VerifyAttestationSchema,
  PayperbyteConfig,
} from "./schemas";
import {
  PAYLOAD_ATTESTATION_TYPES,
  PINNED_ATTESTATION_DOMAIN,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_PAYMENT_USDC,
  SUPPORTED_NETWORKS,
  USDC_BY_CAIP2_NETWORK,
} from "./constants";

interface AttestationDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

const USDC_DECIMALS = 6;

interface FeedCatalogEntry {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  priceAtomic: string;
  price: string;
  publisher: string;
  disclaimerCategory: string;
  method: string[];
}

interface FeedCatalog {
  protocol: string;
  version: string;
  networks: string[];
  facilitator: string;
  asset: string;
  feeds: FeedCatalogEntry[];
}

/**
 * PayperbyteActionProvider provides actions for discovering and querying PayPerByte's x402 data
 * feeds, and for offline-verifying the EIP-712 BYTE Library attestation each response carries.
 *
 * This provider is standalone: it does not depend on, or need to be registered with, the
 * built-in X402ActionProvider — it wires its own x402 payment client directly, the same way
 * DtelecomActionProvider does for its own paid endpoints.
 *
 * Scope, stated plainly: verification here proves authenticity and tamper-evidence of the exact
 * bytes served — that the claimed publisher signed exactly this response body. It is evidence
 * toward authenticity, not a certification, and it says nothing about whether the underlying
 * data is correct.
 */
export class PayperbyteActionProvider extends ActionProvider<WalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPaymentUsdc: number;
  private readonly attestationDomain: AttestationDomain;
  private readonly trustedPublishers: string[] | null;

  /**
   * Creates a new instance of PayperbyteActionProvider.
   *
   * @param config - Optional configuration: baseUrl, maxPaymentUsdc spend cap, an
   * attestationDomain migration override (consensus-critical, do not set casually), and a
   * trustedPublishers allowlist for verification.
   */
  constructor(config: PayperbyteConfig = {}) {
    super("payperbyte", []);
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.maxPaymentUsdc = config.maxPaymentUsdc ?? DEFAULT_MAX_PAYMENT_USDC;
    // Domain name and version are never overridable — only chainId/verifyingContract can be,
    // and only for a deliberate, coordinated migration. See constants.ts's INTEROP CONTRACT note.
    this.attestationDomain = {
      name: PINNED_ATTESTATION_DOMAIN.name,
      version: PINNED_ATTESTATION_DOMAIN.version,
      chainId: config.attestationDomain?.chainId ?? PINNED_ATTESTATION_DOMAIN.chainId,
      verifyingContract:
        config.attestationDomain?.verifyingContract ?? PINNED_ATTESTATION_DOMAIN.verifyingContract,
    };
    this.trustedPublishers = config.trustedPublishers
      ? config.trustedPublishers.map(a => a.toLowerCase())
      : null;
  }

  /**
   * Lists the PayPerByte feed catalog. Free, unauthenticated — no payment, no wallet needed.
   *
   * @param _walletProvider - Unused but required by the action interface.
   * @param _args - Empty arguments object.
   * @returns A JSON string with the feed catalog (id, description, price, publisher per feed).
   */
  @CreateAction({
    name: "payperbyte_list_feeds",
    description:
      "List the PayPerByte feed catalog: feed ids, descriptions, and USDC prices. Free, no " +
      "payment made. Use payperbyte_query_feed with a feedId from this list to actually fetch data.",
    schema: ListFeedsSchema,
  })
  async listFeeds(
    _walletProvider: WalletProvider,
    _args: z.infer<typeof ListFeedsSchema>,
  ): Promise<string> {
    try {
      const catalog = await this.fetchCatalog();
      return JSON.stringify(
        {
          success: true,
          protocol: catalog.protocol,
          version: catalog.version,
          networks: catalog.networks,
          feeds: catalog.feeds.map(f => ({
            id: f.id,
            name: f.name,
            description: f.description,
            priceUsdc: this.atomicToUsdc(f.priceAtomic),
            publisher: f.publisher,
            disclaimerCategory: f.disclaimerCategory,
          })),
        },
        null,
        2,
      );
    } catch (error) {
      return this.handleError(error, `${this.baseUrl}/feeds`);
    }
  }

  /**
   * Queries one PayPerByte feed with an x402 payment (USDC on Base). Enforces maxPaymentUsdc:
   * fetches the catalog first to check the feed's listed price before ever attempting payment,
   * and refuses without paying if the price exceeds the configured cap.
   *
   * @param walletProvider - The wallet provider used to pay for the feed.
   * @param args - feedId (from payperbyte_list_feeds) and optional query params.
   * @returns A JSON string with the response body and its X-BYTE-Attestation header, verbatim.
   */
  @CreateAction({
    name: "payperbyte_query_feed",
    description:
      "Query a PayPerByte feed by id, paying via x402 (USDC on Base). Refuses without paying if " +
      "the feed's price exceeds the configured cap. Returns the response body and its " +
      "X-BYTE-Attestation header verbatim — pass both to payperbyte_verify_attestation before " +
      "acting on the data.",
    schema: QueryFeedSchema,
  })
  async queryFeed(
    walletProvider: WalletProvider,
    args: z.infer<typeof QueryFeedSchema>,
  ): Promise<string> {
    try {
      if (!(walletProvider instanceof EvmWalletProvider)) {
        return JSON.stringify(
          {
            error: true,
            message: "Unsupported wallet provider",
            details: "payperbyte_query_feed requires an EvmWalletProvider on Base or Base Sepolia.",
          },
          null,
          2,
        );
      }

      const network = walletProvider.getNetwork();
      if (!this.supportsNetwork(network)) {
        return JSON.stringify(
          {
            error: true,
            message: "Unsupported network",
            details:
              `PayPerByte feeds are only available on ${SUPPORTED_NETWORKS.join(" or ")}; ` +
              `the current wallet network is ${network.networkId}.`,
          },
          null,
          2,
        );
      }

      const catalog = await this.fetchCatalog();
      const feed = catalog.feeds.find(f => f.id === args.feedId);
      if (!feed) {
        return JSON.stringify(
          {
            error: true,
            message: "Unknown feed id",
            details: `"${args.feedId}" is not in the catalog. Call payperbyte_list_feeds for valid ids.`,
            availableFeedIds: catalog.feeds.map(f => f.id),
          },
          null,
          2,
        );
      }

      const priceUsdc = this.atomicToUsdc(feed.priceAtomic);
      if (priceUsdc > this.maxPaymentUsdc) {
        return JSON.stringify(
          {
            error: true,
            message: "Feed price exceeds the configured spend cap",
            details:
              `Feed "${feed.id}" costs $${priceUsdc.toFixed(4)} USDC, which exceeds the ` +
              `configured maxPaymentUsdc cap of $${this.maxPaymentUsdc.toFixed(4)}. No payment was made.`,
            feedId: feed.id,
            priceUsdc,
            maxPaymentUsdc: this.maxPaymentUsdc,
          },
          null,
          2,
        );
      }

      const client = this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      const url = this.buildFeedUrl(feed.endpoint, args.queryParams);
      // The catalog price check above is a cheap first gate, but the CATALOG is not the
      // authoritative price — the server's actual 402 challenge is. registerPolicy() (set up
      // in createX402Client) enforces the real cap at the protocol level: it filters the
      // server's offered PaymentRequirements down to Base-network, USDC, <=maxPaymentUsdc
      // options, so a bare client can't be made to pay whatever a 402 response happens to
      // quote. If every offered option gets filtered out, @x402/core throws a specific,
      // identifiable error — caught and classified below rather than surfaced as a raw throw.
      let response: Response;
      try {
        response = await fetchWithPayment(url, { method: "GET" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("filtered out by policies") ||
          message.includes("No network/scheme registered")
        ) {
          return JSON.stringify(
            {
              error: true,
              message: "402 quote exceeds cap, or is not USDC on Base",
              details:
                `The server's 402 payment challenge for "${feed.id}" did not offer any option ` +
                `that is USDC on Base (mainnet or Sepolia) within the maxPaymentUsdc cap of ` +
                `$${this.maxPaymentUsdc.toFixed(4)}. No payment was made.`,
              feedId: feed.id,
              maxPaymentUsdc: this.maxPaymentUsdc,
              noPaymentMade: true,
            },
            null,
            2,
          );
        }
        throw error;
      }

      // Read as text FIRST — the attestation hash is computed over the exact response
      // bytes, so we must not JSON.parse-then-restringify (that can change whitespace
      // and key order and silently break hash verification).
      const body = await response.text();
      const attestationHeader = response.headers.get("x-byte-attestation");
      let attestation: unknown = null;
      if (attestationHeader) {
        try {
          attestation = JSON.parse(attestationHeader);
        } catch {
          attestation = { raw: attestationHeader, parseError: true };
        }
      }

      const paymentResponseHeader =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
      let paymentProof: Record<string, unknown> | null = null;
      if (paymentResponseHeader) {
        try {
          paymentProof = JSON.parse(atob(paymentResponseHeader));
        } catch {
          paymentProof = { raw: paymentResponseHeader };
        }
      }

      if (response.status !== 200) {
        return JSON.stringify(
          {
            success: false,
            message: `Request failed with status ${response.status}. Payment was not settled.`,
            feedId: feed.id,
            url,
            status: response.status,
            body,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          success: true,
          feedId: feed.id,
          url,
          status: response.status,
          body,
          attestation,
          paymentProof,
          note:
            "Call payperbyte_verify_attestation with this body and attestation before treating " +
            "the data as authentic — this response has not been verified yet.",
        },
        null,
        2,
      );
    } catch (error) {
      return this.handleError(error, `${this.baseUrl}/feeds/${args.feedId}`);
    }
  }

  /**
   * Offline verification of a BYTE Library X-BYTE-Attestation receipt. Makes no network call.
   * Fails closed: any mismatch, malformed input, or recovery error returns verified:false with a
   * reason, never throws — even if called with unvalidated input that bypassed the schema layer
   * (safeParse'd here explicitly, then the whole body is wrapped in try/catch as a backstop).
   *
   * SECURITY NOTE: recovery uses the PINNED attestationDomain (constants.ts / provider config),
   * never the attestation's own claimed `domain` object. Recovering against an attacker-supplied
   * domain would let a forged attestation "verify" against its own self-consistent-but-wrong
   * domain — checked and rejected before recovery ever runs.
   *
   * @param _walletProvider - Unused but required by the action interface.
   * @param args - The exact response body string and the parsed attestation object.
   * @returns A JSON string verdict: {verified, reason, recoveredSigner, publisherTrusted, ...}.
   */
  @CreateAction({
    name: "payperbyte_verify_attestation",
    description:
      "Offline-verify a BYTE Library X-BYTE-Attestation receipt against the exact response body " +
      "it was computed over. Pins the EIP-712 domain to the real BYTE Library domain (rejects " +
      "any attestation claiming a different domain, before recovery). Recomputes keccak256(body), " +
      "checks it against the attested payloadHash and payloadLength, recovers the EIP-712 signer, " +
      "and checks the attestation has not expired. Fails closed on any mismatch or malformed " +
      "input. A valid result proves a key signed the exact bytes under the real domain — it does " +
      "NOT by itself prove that key is a legitimate PayPerByte publisher unless trustedPublishers " +
      "was configured; evidence toward authenticity and tamper-evidence, never a claim the data " +
      "itself is correct.",
    schema: VerifyAttestationSchema,
  })
  async verifyAttestation(_walletProvider: WalletProvider, args: unknown): Promise<string> {
    try {
      const parsed = VerifyAttestationSchema.safeParse(args);
      if (!parsed.success) {
        return JSON.stringify(
          {
            verified: false,
            reason: `invalid input: ${parsed.error.message}`,
          },
          null,
          2,
        );
      }
      const { body, attestation } = parsed.data;

      // Pin ALL FOUR domain fields to the trusted domain and reject any mismatch BEFORE
      // recovery. Do not use attestation.domain for anything past this point.
      const domain = this.attestationDomain;
      const domainMismatches: string[] = [];
      if (attestation.domain.name !== domain.name) {
        domainMismatches.push(`name "${attestation.domain.name}" != "${domain.name}"`);
      }
      if (attestation.domain.version !== domain.version) {
        domainMismatches.push(`version "${attestation.domain.version}" != "${domain.version}"`);
      }
      if (attestation.domain.chainId !== domain.chainId) {
        domainMismatches.push(`chainId ${attestation.domain.chainId} != ${domain.chainId}`);
      }
      if (
        attestation.domain.verifyingContract.toLowerCase() !==
        domain.verifyingContract.toLowerCase()
      ) {
        domainMismatches.push(
          `verifyingContract "${attestation.domain.verifyingContract}" != "${domain.verifyingContract}"`,
        );
      }
      if (domainMismatches.length > 0) {
        return JSON.stringify(
          {
            verified: false,
            reason:
              "domain mismatch — this attestation was not signed under the trusted BYTE Library " +
              `domain: ${domainMismatches.join("; ")}`,
          },
          null,
          2,
        );
      }

      const bodyBytes = new TextEncoder().encode(body);
      const recomputedHash = keccak256(bodyBytes);

      if (recomputedHash.toLowerCase() !== attestation.payloadHash.toLowerCase()) {
        return JSON.stringify(
          {
            verified: false,
            reason:
              "recomputed keccak256(body) does not match the attested payloadHash — the body is " +
              "not what was signed (tampered, truncated, or the wrong body was passed)",
            recomputedHash,
            attestedHash: attestation.payloadHash,
          },
          null,
          2,
        );
      }

      if (bodyBytes.length !== attestation.payloadLength) {
        return JSON.stringify(
          {
            verified: false,
            reason:
              `body byte length ${bodyBytes.length} does not match the attested payloadLength ` +
              `${attestation.payloadLength}`,
          },
          null,
          2,
        );
      }

      let recovered: `0x${string}`;
      try {
        recovered = await recoverTypedDataAddress({
          domain: {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract as Hex,
          },
          types: PAYLOAD_ATTESTATION_TYPES,
          primaryType: "PayloadAttestation",
          message: {
            publisher: attestation.publisher as Hex,
            payloadHash: attestation.payloadHash as Hex,
            payloadLength: BigInt(attestation.payloadLength),
            deadline: BigInt(attestation.deadline),
          },
          signature: attestation.signature as Hex,
        });
      } catch (error) {
        return JSON.stringify(
          {
            verified: false,
            reason: `signature recovery failed — malformed or invalid signature: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
          null,
          2,
        );
      }

      if (recovered.toLowerCase() !== attestation.publisher.toLowerCase()) {
        return JSON.stringify(
          {
            verified: false,
            reason: "the recovered signer does not match the claimed publisher field",
            recoveredSigner: recovered,
            claimedPublisher: attestation.publisher,
          },
          null,
          2,
        );
      }

      const publisherTrusted = this.trustedPublishers
        ? this.trustedPublishers.includes(recovered.toLowerCase())
        : null;
      const publisherTrustNote =
        publisherTrusted === null
          ? "No trustedPublishers list is configured: this proves a key signed the exact bytes " +
            "under the real BYTE Library domain, not that the key belongs to a legitimate " +
            "PayPerByte publisher. Check recoveredSigner yourself, or configure " +
            "trustedPublishers to enforce an allowlist."
          : undefined;

      if (publisherTrusted === false) {
        return JSON.stringify(
          {
            verified: false,
            hashMatch: true,
            signerMatch: true,
            recoveredSigner: recovered,
            publisherTrusted: false,
            reason: `recovered signer ${recovered} is not in the configured trustedPublishers allowlist`,
          },
          null,
          2,
        );
      }

      const nowS = Math.floor(Date.now() / 1000);
      if (attestation.deadline <= nowS) {
        return JSON.stringify(
          {
            verified: false,
            hashMatch: true,
            signerMatch: true,
            expired: true,
            recoveredSigner: recovered,
            publisherTrusted,
            reason:
              `attestation deadline ${attestation.deadline} (unix-s) has passed (now ${nowS}) — ` +
              "the hash and signature are valid, but this is a point-in-time record of what the " +
              "publisher signed, not a standing claim about the present. Re-fetch before acting on it.",
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          verified: true,
          publisher: attestation.publisher,
          recoveredSigner: recovered,
          publisherTrusted,
          deadline: attestation.deadline,
          reason:
            "the recomputed hash matches the attested payloadHash, the EIP-712 signature recovers " +
            "to the claimed publisher under the pinned BYTE Library domain, and the attestation " +
            "has not expired" +
            (publisherTrustNote ? `. ${publisherTrustNote}` : ""),
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          verified: false,
          reason: `unexpected error during verification: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        null,
        2,
      );
    }
  }

  /**
   * Checks if the action provider supports the given network. Only Base mainnet and Base
   * Sepolia — PayPerByte feeds settle in USDC on Base.
   *
   * @param network - The network to check support for.
   * @returns True if the network is supported.
   */
  supportsNetwork = (network: Network) =>
    (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId!);

  /**
   * Fetches the free, unauthenticated feed catalog.
   *
   * @returns The parsed feed catalog.
   */
  private async fetchCatalog(): Promise<FeedCatalog> {
    const response = await fetch(`${this.baseUrl}/feeds`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch feed catalog: HTTP ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as FeedCatalog;
  }

  /**
   * Converts a USDC amount in atomic units (6 decimals) to a whole-unit number.
   *
   * @param priceAtomic - The price in atomic units, as returned by the catalog (e.g. "5000").
   * @returns The price in whole USDC (e.g. 0.005).
   */
  private atomicToUsdc(priceAtomic: string): number {
    return Number(priceAtomic) / 10 ** USDC_DECIMALS;
  }

  /**
   * Builds the full feed URL, appending optional query-string parameters.
   *
   * @param endpoint - The feed's endpoint path (or full URL) from the catalog.
   * @param queryParams - Optional query-string parameters to append.
   * @returns The full URL to request.
   */
  private buildFeedUrl(endpoint: string, queryParams: Record<string, string> | null): string {
    const base = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return base;
    }
    const url = new URL(base);
    Object.entries(queryParams).forEach(([key, value]) => url.searchParams.append(key, value));
    return url.toString();
  }

  /**
   * Creates an x402 client configured with the wallet's signer, for the exact-EVM payment
   * scheme, restricted to Base networks with a policy that enforces the USDC + spend-cap check
   * against the server's ACTUAL 402 quote (not just the catalog's advertised price — the
   * catalog is a cheap pre-check, this is the protocol-level enforcement that can't be
   * bypassed by a server quoting something different than the catalog).
   *
   * @param walletProvider - The EVM wallet provider to pay with.
   * @returns A configured x402Client.
   */
  private createX402Client(walletProvider: EvmWalletProvider): x402Client {
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
    // Restrict the scheme itself to Base networks (rather than the default eip155:* wildcard),
    // so a non-Base 402 quote fails at scheme resolution instead of relying solely on the policy.
    registerExactEvmScheme(client, {
      signer,
      networks: Object.keys(USDC_BY_CAIP2_NETWORK) as `${string}:${string}`[],
    });
    client.registerPolicy(this.buildCapPolicy());
    return client;
  }

  /**
   * Builds the payment policy that enforces this provider's maxPaymentUsdc cap against the
   * x402 client's real, protocol-level payment requirements (server's 402 quote), independent
   * of and in addition to the catalog price pre-check in queryFeed.
   *
   * @returns A PaymentPolicy that filters out any requirement that isn't USDC on a supported
   * Base network within the configured cap.
   */
  private buildCapPolicy(): PaymentPolicy {
    return (_x402Version: number, requirements: PaymentRequirements[]) =>
      requirements.filter(r => {
        const networkId = USDC_BY_CAIP2_NETWORK[r.network];
        if (!networkId) {
          return false; // not a supported Base network
        }
        const usdcAddress = TOKEN_ADDRESSES_BY_SYMBOLS[networkId]?.USDC;
        if (!usdcAddress || r.asset.toLowerCase() !== usdcAddress.toLowerCase()) {
          return false; // not USDC
        }
        // The declared PaymentRequirements type is v2-only (`amount`), but a v1-shaped 402
        // quote carries the price as `maxAmountRequired` instead (PaymentRequirementsV1 in
        // @x402/core) -- fall back the same way the built-in x402 provider's
        // validatePaymentLimit call site does, so v1 quotes aren't always filtered out as NaN.
        const rWithV1Fields = r as PaymentRequirements & {
          maxAmountRequired?: string;
          price?: string;
        };
        const amountStr = rWithV1Fields.maxAmountRequired ?? r.amount ?? rWithV1Fields.price;
        if (!amountStr) {
          return false; // no usable amount field at all
        }
        const usdc = this.atomicToUsdc(amountStr);
        // Explicitly reject NaN/Infinity/negative amounts rather than relying on JS's
        // "NaN <= cap is false" behavior alone -- a negative amount (e.g. "-1") would
        // otherwise pass "negative <= cap" and be KEPT.
        return Number.isFinite(usdc) && usdc >= 0 && usdc <= this.maxPaymentUsdc;
      });
  }

  /**
   * Formats a caught error into the provider's standard error JSON shape.
   *
   * @param error - The error to format.
   * @param url - The URL that was being accessed when the error occurred.
   * @returns A JSON string with the error details.
   */
  private handleError(error: unknown, url: string): string {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify(
      {
        error: true,
        message: `Error making request to ${url}`,
        details: message,
      },
      null,
      2,
    );
  }
}

export const payperbyteActionProvider = (config?: PayperbyteConfig) =>
  new PayperbyteActionProvider(config);
