import { z } from "zod";
import type { BursarToolset, SpendCap, createToolset } from "@bursar/toolset";
import { createWalletClient, custom, defineChain, numberToHex } from "viem";
import type { Address, Hex } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { InspectSchema, PaySchema, QuoteSchema, SettlementsSchema } from "./schemas";

/**
 * The wallet client the toolset takes. AgentKit and the toolset pin different minor versions of
 * viem, whose `WalletClient` types differ only in the actions they list; the client built here is
 * the same object at every method the toolset calls.
 */
type ToolsetWalletClient = NonNullable<Parameters<typeof createToolset>[0]["walletClient"]>;

/**
 * Configuration for the Bursar action provider.
 */
export interface BursarActionProviderConfig {
  /**
   * The mandate account the agent spends from. The wallet provider has to be its agent.
   */
  mandate: Address;

  /**
   * What this agent may spend on top of the mandate's own limits, in micro-USD.
   */
  spendCap?: SpendCap;

  /**
   * One RPC endpoint or several for Robinhood Chain. Defaults to the chain's own endpoint.
   */
  rpc?: string | readonly string[];

  /**
   * Seconds a provider gets to deliver when a call does not say. Defaults to ten minutes.
   */
  deliverWithinSeconds?: number;

  /**
   * A toolset opened elsewhere, which then supplies the signer instead of the wallet provider.
   */
  toolset?: BursarToolset;
}

/**
 * Robinhood Chain, the only network a Bursar mandate settles on.
 */
const CHAIN_ID = "4663";

const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
});

/**
 * The toolset names the next tool in its answers, so its prefix matches the names AgentKit exposes.
 */
const PREFIX = "BursarActionProvider_";

type Request = { method: string; params?: unknown };

/**
 * Builds a viem wallet client whose transactions the AgentKit wallet provider sends, the way it
 * sends every other action. A CDP wallet, a Privy wallet or a viem account all work and no key is
 * copied. Reads never come this way: the Bursar SDK reads through its own connection.
 *
 * @param walletProvider - The wallet provider that signs for the mandate's agent.
 * @returns A wallet client for the Bursar SDK.
 */
function walletClientFor(walletProvider: EvmWalletProvider) {
  const address = walletProvider.getAddress() as Address;
  const transport = custom({
    async request({ method, params }: Request) {
      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return [address];
        case "eth_chainId":
          return numberToHex(Number(CHAIN_ID));
        case "eth_sendTransaction": {
          const [tx] = params as [{ to: Address; data?: Hex; value?: Hex }];
          const hash = await walletProvider.sendTransaction({
            to: tx.to,
            ...(tx.data === undefined ? {} : { data: tx.data }),
            ...(tx.value === undefined ? {} : { value: BigInt(tx.value) }),
          });
          const receipt = (await walletProvider.waitForTransactionReceipt(hash)) as
            | { transactionHash?: Hex }
            | undefined;
          return receipt?.transactionHash ?? hash;
        }
        default:
          throw new Error(`The AgentKit wallet provider does not serve ${method}.`);
      }
    },
  });
  return createWalletClient({ account: address, chain: robinhoodChain, transport });
}

/**
 * BursarActionProvider lets an agent spend from a Bursar mandate: a contract on Robinhood Chain
 * that holds USDG and the limits the agent spends inside, per call, per day, per month, which
 * providers and which capabilities. The contract enforces the limits, so a spend outside them
 * does not settle whatever the agent is told. The wallet AgentKit holds is the mandate's agent:
 * it signs, and the mandate pays.
 */
export class BursarActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: BursarActionProviderConfig;
  private toolsets = new WeakMap<EvmWalletProvider, BursarToolset>();

  /**
   * Constructor for the BursarActionProvider.
   *
   * @param config - The mandate to spend from and the agent's own cap.
   */
  constructor(config: BursarActionProviderConfig) {
    super("bursar", []);
    if (!config.mandate && !config.toolset) {
      throw new Error("BursarActionProvider needs a mandate address.");
    }
    this.config = config;
  }

  /**
   * Reads the mandate: limits, what is left in each window, the balance, the escrow floor and
   * this agent's own cap. Nothing is spent.
   *
   * @param walletProvider - The wallet provider that signs for the mandate's agent.
   * @param _args - No inputs.
   * @returns A description of the mandate.
   */
  @CreateAction({
    name: "inspect",
    description: `
This tool reads the Bursar spending mandate this agent is bound to: the per-call cap, the daily and monthly
budgets and what is left in each, the amount at and above which the principal has to sign, the balance,
whether the mandate is active, the escrow's smallest payment, and this agent's own cap. Nothing is spent.
Start here when you do not know what you are allowed to buy.
`,
    schema: InspectSchema,
  })
  async inspect(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof InspectSchema>,
  ): Promise<string> {
    return (await this.toolset(walletProvider)).inspect();
  }

  /**
   * Asks the mandate what it would decide about one spend, before making it.
   *
   * @param walletProvider - The wallet provider that signs for the mandate's agent.
   * @param args - The provider, capability and amount.
   * @returns Whether the spend would settle, and which limit stops it when it would not.
   */
  @CreateAction({
    name: "quote",
    description: `
This tool asks the Bursar mandate what it would decide about one spend before making it. The answer says
whether the spend would settle and, when it would not, which limit stopped it. Nothing moves and nothing is
charged. Amounts are USDG in six-decimal units as digit strings: "250000" is 0.25 USDG.
`,
    schema: QuoteSchema,
  })
  async quote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof QuoteSchema>,
  ): Promise<string> {
    return (await this.toolset(walletProvider)).quote(args);
  }

  /**
   * Pays a provider for one job from the mandate. The amount is locked in escrow and goes to the
   * provider when it delivers before the deadline; otherwise the funds return to the mandate.
   *
   * @param walletProvider - The wallet provider that signs for the mandate's agent.
   * @param args - The provider, capability, amount, and optionally the brief and the delivery window.
   * @returns The settlement id and the transaction, or the refusal.
   */
  @CreateAction({
    name: "pay",
    description: `
This tool pays a provider for one job from the Bursar mandate. The amount is locked in escrow and goes to the
provider when it delivers before the deadline; if it does not, the funds return to the mandate. The contract
enforces the limits, so a spend outside them does not settle whatever this tool is told. The mandate is asked
first, and a spend it would refuse is not sent. Amounts are USDG in six-decimal units as digit strings:
"250000" is 0.25 USDG. The reply carries a settlement id; follow it with the settlements tool.
`,
    schema: PaySchema,
  })
  async pay(walletProvider: EvmWalletProvider, args: z.infer<typeof PaySchema>): Promise<string> {
    return (await this.toolset(walletProvider)).pay(args);
  }

  /**
   * Lists what this agent has paid for, newest first, with where each payment stands on the
   * escrow, or reads one settlement by id.
   *
   * @param walletProvider - The wallet provider that signs for the mandate's agent.
   * @param args - Optionally one settlement id.
   * @returns One line per settlement.
   */
  @CreateAction({
    name: "settlements",
    description: `
This tool lists what this agent has paid for through Bursar, newest first, with where each payment stands:
held in escrow while the provider works, paid to the provider, returned to the mandate, disputed, or split by
a resolver. Pass a settlementId to read one payment, including one made elsewhere. Nothing is spent.
`,
    schema: SettlementsSchema,
  })
  async settlements(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SettlementsSchema>,
  ): Promise<string> {
    return (await this.toolset(walletProvider)).settlements(args);
  }

  /**
   * Checks if the Bursar action provider supports the given network. A mandate settles on
   * Robinhood Chain only.
   *
   * @param network - The network to check.
   * @returns True if the network is Robinhood Chain.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    (network.chainId === undefined || network.chainId === CHAIN_ID);

  /**
   * The toolset for a wallet provider, opened once. It sends through the wallet provider.
   *
   * @param walletProvider - The wallet provider that signs for the mandate's agent.
   * @returns The toolset.
   */
  private async toolset(walletProvider: EvmWalletProvider): Promise<BursarToolset> {
    if (this.config.toolset) return this.config.toolset;
    let toolset = this.toolsets.get(walletProvider);
    if (!toolset) {
      // The toolset ships as ES modules; a dynamic import loads it from this CommonJS build.
      const { createToolset } = await import("@bursar/toolset");
      const { mandate, spendCap, rpc, deliverWithinSeconds } = this.config;
      toolset = createToolset({
        mandate,
        walletClient: walletClientFor(walletProvider) as unknown as ToolsetWalletClient,
        prefix: PREFIX,
        ...(spendCap === undefined ? {} : { spendCap }),
        ...(rpc === undefined ? {} : { rpc }),
        ...(deliverWithinSeconds === undefined ? {} : { deliverWithinSeconds }),
      });
      this.toolsets.set(walletProvider, toolset);
    }
    return toolset;
  }
}

export const bursarActionProvider = (config: BursarActionProviderConfig) =>
  new BursarActionProvider(config);
