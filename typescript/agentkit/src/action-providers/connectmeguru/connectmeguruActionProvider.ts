import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { SearchEsimSchema, PurchaseEsimSchema, CheckOrderStatusSchema } from "./schemas";
import { CONNECTMEGURU_BASE_URL } from "./constants";

export interface ConnectMeGuruConfig {
  patToken?: string;
  baseUrl?: string;
}

/**
 * Extract human-readable message from an unknown error.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  const str = String(error);
  if (str === "[object Object]") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return str;
}

/**
 * ConnectMeGuruActionProvider provides actions for autonomous global travel eSIM search and purchase.
 *
 * Supports searching 3,000+ data plans across 190+ countries, non-custodial crypto checkout
 * using USDT on Polygon, Arbitrum One, and TRON, and instant eSIM profile delivery (QR code and LPA string).
 */
export class ConnectMeGuruActionProvider extends ActionProvider {
  private readonly patToken: string;
  private readonly baseUrl: string;

  /**
   * Creates a new ConnectMeGuruActionProvider instance.
   *
   * @param config - Optional configuration containing Personal Access Token or custom base URL.
   */
  constructor(config?: ConnectMeGuruConfig) {
    super("connectmeguru", []);
    this.patToken = config?.patToken || process.env.CMG_PAT_TOKEN || "";
    this.baseUrl = (config?.baseUrl || process.env.CMG_BASE_URL || CONNECTMEGURU_BASE_URL).replace(/\/$/, "");
  }

  /**
   * Search for available travel eSIM data packages for a destination country.
   *
   * @param args - Search arguments containing the destination country.
   * @returns JSON string containing list of available eSIM plans with prices and durations.
   */
  @CreateAction({
    name: "search_esim_plans",
    description: `Search for available international travel eSIM data plans and pricing across 190+ countries.
Takes the destination country name or ISO code and returns a list of package codes, data caps (GB), validity duration (days), and retail prices in USD/USDT.`,
    schema: SearchEsimSchema,
  })
  async searchEsimPlans(args: z.infer<typeof SearchEsimSchema>): Promise<string> {
    try {
      const url = `${this.baseUrl}/products/search?country=${encodeURIComponent(args.country)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Error searching eSIM plans: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Purchase an eSIM plan and generate a non-custodial USDT payment invoice.
   *
   * @param args - Purchase arguments including packageCode, customerEmail, network, and currency.
   * @returns JSON string containing payment invoice, exact USDT amount with spot discount offset, and receiving wallet address.
   */
  @CreateAction({
    name: "purchase_esim",
    description: `Initiates an eSIM purchase and generates a non-custodial USDC or USDT payment invoice.
Requires packageCode (from search_esim_plans), customerEmail, network ('base', 'polygon', 'arbitrum', or 'tron'), and currency ('USDC' or 'USDT').
Defaults to USDC on Base (Coinbase L2) for sub-cent transaction fees.
Returns payment instructions including receiving address, exact token amount to transfer, and expiry timestamp.`,
    schema: PurchaseEsimSchema,
  })
  async purchaseEsim(args: z.infer<typeof PurchaseEsimSchema>): Promise<string> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.patToken) {
        headers["Authorization"] = `Bearer ${this.patToken}`;
      }

      const response = await fetch(`${this.baseUrl}/agentic/checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          packageCode: args.packageCode,
          customerEmail: args.customerEmail,
          preferredCurrency: args.currency ? args.currency.toUpperCase() : "USDC",
          preferredNetwork: args.network ? args.network.toUpperCase() : "BASE",
        }),
      });

      if (response.status !== 200 && response.status !== 402) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Error purchasing eSIM: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Check order status and download eSIM profile.
   *
   * @param args - Order status arguments containing invoiceId.
   * @returns JSON string containing fulfillment status, ICCID, LPA activation string, and QR code URL.
   */
  @CreateAction({
    name: "check_order_status",
    description: `Check the on-chain payment settlement and provisioning status for a ConnectMeGuru invoice ID.
When status is COMPLETED, returns the eSIM ICCID, LPA activation code string, and QR code image URL for installation.`,
    schema: CheckOrderStatusSchema,
  })
  async checkOrderStatus(args: z.infer<typeof CheckOrderStatusSchema>): Promise<string> {
    try {
      const url = `${this.baseUrl}/agentic/order/${encodeURIComponent(args.invoiceId)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Error checking order status: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * ConnectMeGuru supports non-custodial USDT payments across EVM (Polygon, Arbitrum) and TRON.
   *
   * @returns True, as ConnectMeGuru actions are supported across networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the ConnectMeGuru action provider.
 *
 * @param config - Optional configuration for ConnectMeGuru Action Provider.
 * @returns A new ConnectMeGuruActionProvider instance.
 */
export const connectmeguruActionProvider = (config?: ConnectMeGuruConfig) =>
  new ConnectMeGuruActionProvider(config);
