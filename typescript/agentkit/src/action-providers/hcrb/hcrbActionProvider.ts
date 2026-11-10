import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  VerifyIbanSchema,
  VerifyLeiSchema,
  VerifyVatSchema,
  CheckCounterpartyHistorySchema,
  VerifyCoinbaseEasSchema,
  CreateB2bInvoiceSchema,
  HcrbConfig,
} from "./schemas";
import { DEFAULT_HCRB_API_URL } from "./constants";

/**
 * HcrbActionProvider equips Coinbase AgentKit AI agents with deterministic institutional
 * validation tools (ISO 7064 Mod 97-10 IBAN, LEI, VAT), Coinbase EAS attestation checks,
 * counterparty settlement audits on Base L2, and B2B invoice generation.
 */
export class HcrbActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiUrl: string;

  constructor(config: HcrbConfig = {}) {
    super("hcrb", []);
    this.apiUrl = config.apiUrl || DEFAULT_HCRB_API_URL;
  }

  /**
   * Checks if the provider supports the network (EVM / Base).
   */
  supportsNetwork(network: Network): boolean {
    if (network.protocolFamily !== "evm") return false;
    const netId = network.networkId.toLowerCase();
    return (
      netId.includes("base") ||
      netId === "8453" ||
      netId === "84532" ||
      netId === "eip155:8453" ||
      netId === "eip155:84532"
    );
  }

  /**
   * Validates an IBAN using deterministic ISO 7064 Mod 97-10 checksum math.
   */
  @CreateAction({
    name: "verify_iban",
    description: "Mathematically validate an International Bank Account Number (IBAN) using ISO 7064 Mod 97-10 checksum logic to prevent wire fraud and transfer bouncebacks",
    schema: VerifyIbanSchema,
  })
  async verifyIban(_walletProvider: EvmWalletProvider, args: z.infer<typeof VerifyIbanSchema>): Promise<string> {
    try {
      const res = await fetch(`${this.apiUrl}/v1/tools/iban-check/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { iban: args.iban } }),
      });

      const data = await res.json();
      return JSON.stringify({
        success: res.ok,
        iban: args.iban,
        result: data,
      });
    } catch (err: unknown) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Validates an LEI corporate identifier (ISO 17442).
   */
  @CreateAction({
    name: "verify_lei",
    description: "Verify a 20-character Legal Entity Identifier (LEI) for institutional corporate KYB and counterparty due diligence",
    schema: VerifyLeiSchema,
  })
  async verifyLei(_walletProvider: EvmWalletProvider, args: z.infer<typeof VerifyLeiSchema>): Promise<string> {
    try {
      const res = await fetch(`${this.apiUrl}/v1/tools/lei-check/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { lei: args.lei } }),
      });

      const data = await res.json();
      return JSON.stringify({
        success: res.ok,
        lei: args.lei,
        result: data,
      });
    } catch (err: unknown) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Validates a VAT identifier.
   */
  @CreateAction({
    name: "verify_vat",
    description: "Validate a European VAT identifier using Mod-97 checksum math for tax and cross-border invoicing compliance",
    schema: VerifyVatSchema,
  })
  async verifyVat(_walletProvider: EvmWalletProvider, args: z.infer<typeof VerifyVatSchema>): Promise<string> {
    try {
      const res = await fetch(`${this.apiUrl}/v1/tools/vat-mod97-check/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { vat: args.vat } }),
      });

      const data = await res.json();
      return JSON.stringify({
        success: res.ok,
        vat: args.vat,
        result: data,
      });
    } catch (err: unknown) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Audits a counterparty address for onchain settlement history on Base.
   */
  @CreateAction({
    name: "check_counterparty_history",
    description: "Check whether a target Ethereum or Base address has verified onchain USDC settlement history before transferring funds",
    schema: CheckCounterpartyHistorySchema,
  })
  async checkCounterpartyHistory(_walletProvider: EvmWalletProvider, args: z.infer<typeof CheckCounterpartyHistorySchema>): Promise<string> {
    try {
      const res = await fetch(`${this.apiUrl}/v1/tools/settlement-history-check/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { address: args.address } }),
      });

      const data = await res.json();
      return JSON.stringify({
        success: res.ok,
        address: args.address,
        history: data,
      });
    } catch (err: unknown) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Verifies Coinbase EAS attestation status on Base.
   */
  @CreateAction({
    name: "verify_coinbase_eas",
    description: "Verify if an address holds a Coinbase Verified Account EAS onchain attestation on Base for institutional KYC and sanctions compliance",
    schema: VerifyCoinbaseEasSchema,
  })
  async verifyCoinbaseEas(_walletProvider: EvmWalletProvider, args: z.infer<typeof VerifyCoinbaseEasSchema>): Promise<string> {
    try {
      const res = await fetch(`${this.apiUrl}/api/compliance/eas/${args.address}`);
      const data = await res.json();
      return JSON.stringify({
        success: res.ok,
        address: args.address,
        eas: data,
      });
    } catch (err: unknown) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Creates a B2B invoice on Base.
   */
  @CreateAction({
    name: "create_b2b_invoice",
    description: "Create an institution-grade B2B invoice with EIP-681 / x402 payment link, AP2 mandate, and instant Base USDC settlement",
    schema: CreateB2bInvoiceSchema,
  })
  async createB2bInvoice(walletProvider: EvmWalletProvider, args: z.infer<typeof CreateB2bInvoiceSchema>): Promise<string> {
    try {
      const merchantAddr = args.recipientAddress || walletProvider.getAddress();
      const res = await fetch(`${this.apiUrl}/api/invoice/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount_usdc: args.amountUsdc,
          merchant: merchantAddr,
          client_name: args.clientName,
          memo: args.memo || "Agentic Engineering Deliverable",
        }),
      });

      const data = await res.json();
      return JSON.stringify({
        success: res.ok,
        invoice: data,
      });
    } catch (err: unknown) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const hcrbActionProvider = (config?: HcrbConfig) => new HcrbActionProvider(config);
