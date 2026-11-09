import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  Grid402CnpjSchema,
  Grid402CepSchema,
  Grid402ForexSchema,
  Grid402CryptoSchema,
  Grid402DnsSchema,
  Grid402SslSchema,
  Grid402AsnSchema,
  Grid402IndicatorsSchema,
  Grid402HolidaysSchema,
  Grid402WorkdaysSchema,
  Grid402VerifyProofSchema,
  Grid402SummarySchema,
} from "./schemas";
import { GRID402_DEFAULT_BASE_URL } from "./constants";

/**
 * Optional configuration for Grid402ActionProvider.
 */
export interface Grid402Config {
  baseUrl?: string;
  sandbox?: boolean;
  apiKey?: string;
}

/**
 * Grid402ActionProvider enables autonomous agents to access official Brazilian public,
 * fiscal, economic, and network infrastructure data with cryptographic secp256k1 proofs
 * and Base network x402 payment support.
 */
export class Grid402ActionProvider extends ActionProvider {
  private readonly baseUrl: string;
  private readonly sandbox: boolean;
  private readonly apiKey?: string;

  /**
   * Constructs a new Grid402ActionProvider.
   *
   * @param config - Optional configuration for base URL, sandbox mode, or API key
   */
  constructor(config?: Grid402Config) {
    super("grid402", []);
    this.baseUrl = config
      ? config.baseUrl
        ? config.baseUrl
        : GRID402_DEFAULT_BASE_URL
      : GRID402_DEFAULT_BASE_URL;
    this.sandbox = config ? Boolean(config.sandbox) : false;
    this.apiKey = config ? config.apiKey : undefined;
  }

  /**
   * Look up Brazilian corporate registry (CNPJ) from Federal Revenue.
   *
   * @param args - The input arguments containing the CNPJ tax ID
   * @returns Stringified JSON containing the company details
   */
  @CreateAction({
    name: "fetch_cnpj",
    description: `Query official Brazilian corporate registration data (CNPJ) from the Federal Revenue database.
Returns company legal name, trade name, active status, address, economic activities (CNAE), and corporate partners.`,
    schema: Grid402CnpjSchema,
  })
  async fetchCnpj(args: z.infer<typeof Grid402CnpjSchema>): Promise<string> {
    const cleanDigits = args.cnpj.replace(/[^0-9]/g, "");
    return this.executeQuery("/api/v1/cnpj", { cnpj: cleanDigits });
  }

  /**
   * Resolve Brazilian postal code (CEP) to street, neighborhood, city, state, and IBGE codes.
   *
   * @param args - The input arguments containing the postal code (CEP)
   * @returns Stringified JSON containing the resolved address
   */
  @CreateAction({
    name: "fetch_cep",
    description: `Resolve an 8-digit Brazilian postal code (CEP) to full address details, city, state, and IBGE geocodes.`,
    schema: Grid402CepSchema,
  })
  async fetchCep(args: z.infer<typeof Grid402CepSchema>): Promise<string> {
    const cleanDigits = args.code.replace(/[^0-9]/g, "");
    return this.executeQuery("/api/v1/cep", { code: cleanDigits });
  }

  /**
   * Fetch official foreign currency exchange rates to Brazilian Real (BRL).
   *
   * @param _args - Empty arguments object
   * @returns Stringified JSON containing real-time foreign currency exchange rates
   */
  @CreateAction({
    name: "fetch_forex",
    description: `Fetch real-time official foreign exchange rates for USD, EUR, and GBP relative to Brazilian Real (BRL).`,
    schema: Grid402ForexSchema,
  })
  async fetchForex(_args: z.infer<typeof Grid402ForexSchema>): Promise<string> {
    return this.executeQuery("/api/v1/forex", {});
  }

  /**
   * Fetch spot cryptocurrency market prices denominated in BRL and USD.
   *
   * @param _args - Empty arguments object
   * @returns Stringified JSON containing cryptocurrency spot market prices
   */
  @CreateAction({
    name: "fetch_crypto",
    description: `Fetch aggregated spot market prices for major crypto assets (BTC, ETH, SOL, USDC) in BRL and USD.`,
    schema: Grid402CryptoSchema,
  })
  async fetchCrypto(_args: z.infer<typeof Grid402CryptoSchema>): Promise<string> {
    return this.executeQuery("/api/v1/crypto", {});
  }

  /**
   * Query authoritative DNS records (A, AAAA, MX, TXT, NS, CNAME) for a given domain.
   *
   * @param args - The input arguments containing domain name
   * @returns Stringified JSON containing resolved DNS resource records
   */
  @CreateAction({
    name: "fetch_dns",
    description: `Perform authoritative DNS query on a domain to retrieve A, AAAA, MX, TXT, NS, and CNAME records.`,
    schema: Grid402DnsSchema,
  })
  async fetchDns(args: z.infer<typeof Grid402DnsSchema>): Promise<string> {
    return this.executeQuery("/api/v1/dns", { domain: args.domain });
  }

  /**
   * Inspect and audit TLS or SSL certificate for a target host.
   *
   * @param args - The input arguments containing target hostname
   * @returns Stringified JSON containing TLS or SSL certificate analysis
   */
  @CreateAction({
    name: "fetch_ssl",
    description: `Inspect TLS or SSL certificate parameters, validity dates, cipher suites, issuer, and SAN domains for a given host.`,
    schema: Grid402SslSchema,
  })
  async fetchSsl(args: z.infer<typeof Grid402SslSchema>): Promise<string> {
    return this.executeQuery("/api/v1/ssl", { host: args.host });
  }

  /**
   * Look up autonomous system (ASN) and BGP routing ownership for an IP address.
   *
   * @param args - The input arguments containing IP address
   * @returns Stringified JSON containing ASN routing and registry details
   */
  @CreateAction({
    name: "fetch_asn",
    description: `Look up Autonomous System Number (ASN), ISP entity, country code, and routing prefix for an IPv4 or IPv6 address.`,
    schema: Grid402AsnSchema,
  })
  async fetchAsn(args: z.infer<typeof Grid402AsnSchema>): Promise<string> {
    return this.executeQuery("/api/v1/asn", { ip: args.ip });
  }

  /**
   * Fetch official Brazilian macroeconomic indicators (SELIC, CDI, IPCA, IGP-M).
   *
   * @param _args - Empty arguments object
   * @returns Stringified JSON containing official macroeconomic indicator series
   */
  @CreateAction({
    name: "fetch_indicators",
    description: `Fetch official Brazilian macroeconomic and monetary indicators from Central Bank (BACEN) and IBGE, including SELIC, CDI, IPCA inflation, and IGP-M.`,
    schema: Grid402IndicatorsSchema,
  })
  async fetchIndicators(_args: z.infer<typeof Grid402IndicatorsSchema>): Promise<string> {
    return this.executeQuery("/api/v1/indicators", {});
  }

  /**
   * Query national and banking holidays in Brazil.
   *
   * @param args - The input arguments containing optional calendar year
   * @returns Stringified JSON containing list of national and banking holidays
   */
  @CreateAction({
    name: "fetch_holidays",
    description: `Query official Brazilian national holidays and ANBIMA banking holidays for financial calculations.`,
    schema: Grid402HolidaysSchema,
  })
  async fetchHolidays(args: z.infer<typeof Grid402HolidaysSchema>): Promise<string> {
    const params: Record<string, string> = {};
    if (args.year !== undefined) {
      params.year = String(args.year);
    }
    return this.executeQuery("/api/v1/holidays", params);
  }

  /**
   * Calculate Brazilian banking working days (dias uteis) between dates or project future settlement date.
   *
   * @param args - The input arguments containing startDate, optional endDate or days
   * @returns Stringified JSON containing calculated business days count or target date
   */
  @CreateAction({
    name: "calculate_workdays",
    description: `Calculate the number of Brazilian financial business days between two dates, or find the business day resulting from adding/subtracting N working days according to ANBIMA calendar.`,
    schema: Grid402WorkdaysSchema,
  })
  async calculateWorkdays(args: z.infer<typeof Grid402WorkdaysSchema>): Promise<string> {
    const params: Record<string, string> = {
      start_date: args.startDate,
    };
    if (args.endDate) {
      params.end_date = args.endDate;
    }
    if (args.days !== undefined) {
      params.days = String(args.days);
    }
    return this.executeQuery("/api/v1/workdays", params);
  }

  /**
   * Verify secp256k1 cryptographic oracle proof delivered with Grid402 responses.
   *
   * @param args - The input arguments containing response payload with _oracle_proof
   * @returns Stringified JSON containing verification result and recovered signer address
   */
  @CreateAction({
    name: "verify_oracle_proof",
    description: `Verify the authenticity and integrity of a Grid402 oracle response using secp256k1 digital signatures and recover the signer wallet address.`,
    schema: Grid402VerifyProofSchema,
  })
  async verifyOracleProof(args: z.infer<typeof Grid402VerifyProofSchema>): Promise<string> {
    try {
      const payloadString =
        typeof args.payload === "string" ? args.payload : JSON.stringify(args.payload);

      const targetUrl = new URL("/api/v1/verify", this.baseUrl);
      const response = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Grid402-CoinbaseAgentKit-Provider/1.0",
        },
        body: payloadString,
      });

      const responseJson = await response.json();
      return JSON.stringify(responseJson, null, 2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify(
        {
          error: "Failed to verify cryptographic proof",
          message,
        },
        null,
        2,
      );
    }
  }

  /**
   * Retrieve Grid402 status, operational uptime, and supported data catalog summary.
   *
   * @param _args - Empty arguments object
   * @returns Stringified JSON containing API operational metrics and catalog summary
   */
  @CreateAction({
    name: "get_summary",
    description: `Retrieve the status of Grid402 API, active endpoints, data freshness, and x402 payment configuration.`,
    schema: Grid402SummarySchema,
  })
  async getSummary(_args: z.infer<typeof Grid402SummarySchema>): Promise<string> {
    return this.executeQuery("/status", {});
  }

  /**
   * Grid402 data actions are network-agnostic and work across all environments.
   *
   * @param _network - Optional Network object
   * @returns Always returns true as actions are network-agnostic
   */
  supportsNetwork(_network?: Network): boolean {
    return true;
  }

  /**
   * Helper to execute GET queries against Grid402 endpoints.
   *
   * @param endpointPath - Path to the target endpoint
   * @param params - URL query parameters map
   * @returns Stringified JSON response from endpoint
   */
  private async executeQuery(
    endpointPath: string,
    params: Record<string, string>,
  ): Promise<string> {
    try {
      const targetUrl = new URL(endpointPath, this.baseUrl);
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          targetUrl.searchParams.set(key, value);
        }
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "Grid402-CoinbaseAgentKit-Provider/1.0",
      };

      if (this.sandbox) {
        headers["X-Payment"] = "demo";
      }

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(targetUrl.toString(), {
        method: "GET",
        headers,
      });

      const responseJson = await response.json();

      if (response.status === 200) {
        return JSON.stringify(responseJson, null, 2);
      }

      if (response.status === 402) {
        return JSON.stringify(
          {
            error: "Payment required (HTTP 402)",
            message:
              "Endpoint requires micro-settlement via x402 on Base network. Transfer the required USDC to oracle wallet or provide sandbox/demo header.",
            details: responseJson,
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          error: `HTTP error status: ${response.status}`,
          details: responseJson,
        },
        null,
        2,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify(
        {
          error: "Failed to execute request to Grid402",
          message,
        },
        null,
        2,
      );
    }
  }
}

/**
 * Factory function to create a new Grid402ActionProvider instance.
 *
 * @param config - Optional configuration object
 * @returns A new Grid402ActionProvider instance
 */
export const grid402ActionProvider = (config?: Grid402Config) => new Grid402ActionProvider(config);
