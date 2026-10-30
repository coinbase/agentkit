import { z } from "zod";
import { decodeEventLog, encodeFunctionData, erc20Abi, formatUnits, Hex, parseUnits } from "viem";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  BorrowSchema,
  GetAgentRecordSchema,
  GetCreditLineSchema,
  PayX402WithCreditSchema,
  RepaySchema,
} from "./schemas";
import {
  LOAN_ACTIVE,
  POOL_ABI,
  PRIORS_API,
  PRIORS_POOL,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_NETWORK,
  USDG,
  USDG_DECIMALS,
} from "./constants";

const usdg = (atomic: bigint) => formatUnits(atomic, USDG_DECIMALS);
const sameAddress = (a: unknown, b: string) => String(a).toLowerCase() === b.toLowerCase();

type Requirement = {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
};

/**
 * PriorsActionProvider gives an agent on Robinhood Chain a USDG credit line from Priors: pay an x402 URL and borrow
 * the gap when the wallet is short, borrow and repay, and read another agent's repayment record before paying it.
 */
export class PriorsActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the PriorsActionProvider.
   *
   * @param fetchImpl - The fetch used for Priors' API and the x402 URLs (injectable for tests).
   */
  constructor(
    private readonly fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {
    super("priors", []);
  }

  /**
   * Reads an agent's Priors repayment record.
   *
   * @param _walletProvider - The wallet provider (unused: the record is public).
   * @param args - The agent id.
   * @returns The record in plain words, or an error message.
   */
  @CreateAction({
    name: "get_priors_agent_record",
    description: `
This tool reads an ERC-8004 agent's repayment record on Priors: loans repaid, late repayments, defaults and score.
Use it before paying or hiring another agent. It moves no money.

Inputs:
- agentId: the agent's ERC-8004 id on Robinhood Chain.`,
    schema: GetAgentRecordSchema,
  })
  async getAgentRecord(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentRecordSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchImpl(`${PRIORS_API}/api/check?agent=${args.agentId}`);
      if (!res.ok) return `Error: Priors answered HTTP ${res.status} for agent #${args.agentId}.`;
      const body = (await res.json()) as {
        agents?: Array<{
          name?: string;
          record?: Record<string, unknown>;
          scoreV2?: Record<string, unknown>;
        }>;
      };
      const a = body.agents?.[0];
      if (!a || !a.record) return `Agent #${args.agentId} has no Priors record.`;
      const r = a.record;
      return [
        `Agent #${args.agentId}${a.name ? ` (${a.name})` : ""} on Priors:`,
        `- loans repaid: ${r.loansRepaid ?? 0} (${r.volumeRepaidUsdg ?? 0} USDG), open loans: ${r.activeLoans ?? 0}`,
        `- defaulted: ${r.defaulted ? "yes" : "no"}${r.frozen ? ", frozen" : ""}`,
        `- late repayments: ${a.scoreV2?.lateRepayments ?? 0}, Score v2: ${a.scoreV2?.score ?? "n/a"} (${a.scoreV2?.rungName ?? "n/a"})`,
        `A record shows how the agent repaid loans on Priors, not whether its service is good.`,
      ].join("\n");
    } catch (error) {
      return `Error reading agent #${args.agentId}'s record: ${error}`;
    }
  }

  /**
   * Reads an agent's Priors credit line.
   *
   * @param _walletProvider - The wallet provider (unused: the line is public).
   * @param args - The agent id.
   * @returns The line in plain words, or an error message.
   */
  @CreateAction({
    name: "get_priors_credit_line",
    description: `
This tool reads an agent's Priors credit line: its size, what is drawn and what is available to borrow. It moves no money.

Inputs:
- agentId: the agent's ERC-8004 id on Robinhood Chain.`,
    schema: GetCreditLineSchema,
  })
  async getCreditLine(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetCreditLineSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchImpl(`${PRIORS_API}/api/hub/agent?id=${args.agentId}`);
      if (!res.ok) return `Error: Priors answered HTTP ${res.status} for agent #${args.agentId}.`;
      const body = (await res.json()) as {
        agent?: {
          line?: { limit?: number; drawn?: number; available?: number };
          activeLoans?: number;
        };
      };
      const line = body.agent?.line;
      if (!line) return `Agent #${args.agentId} has no Priors line.`;
      const fmt = (n?: number) => usdg(BigInt(Math.round(Number(n ?? 0))));
      return `Agent #${args.agentId}'s Priors line: ${fmt(line.limit)} USDG, drawn ${fmt(line.drawn)}, available ${fmt(line.available)}; open loans: ${body.agent?.activeLoans ?? 0}.`;
    } catch (error) {
      return `Error reading agent #${args.agentId}'s line: ${error}`;
    }
  }

  /**
   * Borrows USDG from the agent's Priors line into this wallet.
   *
   * @param walletProvider - The wallet provider: the agent's owner or its registry wallet.
   * @param args - The agent id, the amount and the term.
   * @returns The loan, or an error message.
   */
  @CreateAction({
    name: "borrow_from_priors",
    description: `
This tool borrows USDG from the agent's Priors credit line into this wallet, on Robinhood Chain. Real money: the loan
must be repaid (principal and fee) before its due date, or the agent's record ends in a default.

Inputs:
- agentId: the agent's ERC-8004 id; this wallet must be its owner or its registry wallet.
- amount: USDG to borrow, e.g. 1.5 (at least the pool's minimum loan).
- days: the loan term in days (default 7).`,
    schema: BorrowSchema,
  })
  async borrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BorrowSchema>,
  ): Promise<string> {
    try {
      const loan = await this.borrowAmount(
        walletProvider,
        args.agentId,
        parseUnits(args.amount, USDG_DECIMALS),
        args.days,
      );
      return `Borrowed ${usdg(loan.amount)} USDG from agent #${args.agentId}'s Priors line: loan #${loan.loanId}, fee ${usdg(loan.fee)} USDG, due ${loan.dueAt}. Transaction: ${loan.hash}`;
    } catch (error) {
      return `Error borrowing from Priors: ${error}`;
    }
  }

  /**
   * Repays a Priors loan in full from this wallet.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The loan id.
   * @returns The repayment, or an error message.
   */
  @CreateAction({
    name: "repay_priors_loan",
    description: `
This tool repays a Priors loan in full (principal and fee) from this wallet's USDG on Robinhood Chain. Real money.

Inputs:
- loanId: the loan to repay.`,
    schema: RepaySchema,
  })
  async repay(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RepaySchema>,
  ): Promise<string> {
    try {
      const loan = (await walletProvider.readContract({
        address: PRIORS_POOL,
        abi: POOL_ABI,
        functionName: "getLoan",
        args: [BigInt(args.loanId)],
      })) as { agentId: bigint; principal: bigint; fee: bigint; status: number };
      if (Number(loan.status) !== LOAN_ACTIVE) return `Error: loan #${args.loanId} is not active.`;
      const due = loan.principal + loan.fee;
      const me = walletProvider.getAddress() as Hex;
      const balance = (await walletProvider.readContract({
        address: USDG,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [me],
      })) as bigint;
      if (balance < due)
        return `Error: repaying loan #${args.loanId} needs ${usdg(due)} USDG, the wallet holds ${usdg(balance)}.`;
      const allowance = (await walletProvider.readContract({
        address: USDG,
        abi: erc20Abi,
        functionName: "allowance",
        args: [me, PRIORS_POOL],
      })) as bigint;
      if (allowance < due) {
        const approve = await walletProvider.sendTransaction({
          to: USDG,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [PRIORS_POOL, due],
          }),
        });
        await walletProvider.waitForTransactionReceipt(approve);
      }
      const hash = await walletProvider.sendTransaction({
        to: PRIORS_POOL,
        data: encodeFunctionData({
          abi: POOL_ABI,
          functionName: "repay",
          args: [BigInt(args.loanId), loan.agentId, due],
        }),
      });
      await walletProvider.waitForTransactionReceipt(hash);
      return `Repaid Priors loan #${args.loanId}: ${usdg(due)} USDG. Transaction: ${hash}`;
    } catch (error) {
      return `Error repaying loan #${args.loanId}: ${error}`;
    }
  }

  /**
   * Pays an x402 URL in USDG on Robinhood Chain, borrowing the gap from the Priors line when the wallet is short.
   *
   * @param walletProvider - The wallet provider: the agent's owner or its registry wallet.
   * @param args - The URL, the agent id, the most to pay and the most to borrow.
   * @returns What was paid and borrowed and the response, or an error message.
   */
  @CreateAction({
    name: "pay_x402_with_priors_credit",
    description: `
This tool fetches a URL that charges per call with x402 (HTTP 402) and pays it in USDG on Robinhood Chain from this
wallet. If the wallet is short of the price, it first borrows the gap from the agent's Priors line, only when maxBorrow
covers it. Real money: confirm the URL, the price and the most to borrow with the user first.

Inputs:
- url: the https URL.
- agentId: the agent's ERC-8004 id whose line may be drawn.
- maxPrice: the most to pay for this call, in USDG (e.g. 0.10).
- maxBorrow: the most to borrow if the wallet is short, in USDG (default 0: never borrow).
- days: the term of a loan taken for the gap (default 7).`,
    schema: PayX402WithCreditSchema,
  })
  async payX402WithCredit(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PayX402WithCreditSchema>,
  ): Promise<string> {
    try {
      if (!/^https:\/\//i.test(args.url)) return "Error: only https URLs are paid.";
      const maxPrice = parseUnits(args.maxPrice, USDG_DECIMALS);
      const maxBorrow = parseUnits(args.maxBorrow || "0", USDG_DECIMALS);
      const probe = await this.fetchImpl(args.url);
      if (probe.status !== 402)
        return `No payment asked (HTTP ${probe.status}):\n${(await probe.text()).slice(0, 2000)}`;
      const requirement = await this.usdgRequirement(probe);
      if (!requirement)
        return "Error: the URL asks for no USDG payment on Robinhood Chain (x402 exact).";
      const price = BigInt(requirement.amount ?? "0");
      if (price > maxPrice)
        return `Error: the URL asks ${usdg(price)} USDG, above maxPrice ${args.maxPrice}. Nothing was paid.`;
      const me = walletProvider.getAddress() as Hex;
      const balance = (await walletProvider.readContract({
        address: USDG,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [me],
      })) as bigint;
      let borrowed = "";
      if (balance < price) {
        const params = (await walletProvider.readContract({
          address: PRIORS_POOL,
          abi: POOL_ABI,
          functionName: "getParams",
        })) as { minLoan: bigint };
        const gap = price - balance;
        const amount = gap > params.minLoan ? gap : params.minLoan;
        if (amount > maxBorrow) {
          return `Error: the wallet holds ${usdg(balance)} USDG, short of ${usdg(price)}; borrowing ${usdg(amount)} (the pool's minimum loan is ${usdg(params.minLoan)}) is above maxBorrow ${args.maxBorrow || "0"}. Nothing was paid.`;
        }
        const loan = await this.borrowAmount(walletProvider, args.agentId, amount, args.days);
        borrowed = `Borrowed ${usdg(loan.amount)} USDG first: loan #${loan.loanId}, fee ${usdg(loan.fee)}, due ${loan.dueAt} (transaction ${loan.hash}). Repay it with repay_priors_loan before then.\n`;
      }
      const client = new x402Client()
        .register(ROBINHOOD_NETWORK, new ExactEvmScheme(walletProvider.toSigner()))
        .registerPolicy((_version, reqs) =>
          reqs.filter(
            r =>
              r.network === ROBINHOOD_NETWORK &&
              sameAddress(r.asset, USDG) &&
              BigInt((r as Requirement).amount ?? "0") <= maxPrice,
          ),
        );
      const paid = await wrapFetchWithPayment(this.fetchImpl, client)(args.url);
      const receipt =
        paid.headers.get("payment-response") || paid.headers.get("x-payment-response");
      return `${borrowed}Paid ${usdg(price)} USDG to ${requirement.payTo} (HTTP ${paid.status})${receipt ? `; settlement: ${receipt.slice(0, 200)}` : ""}.\nResponse:\n${(await paid.text()).slice(0, 2000)}`;
    } catch (error) {
      return `Error paying ${args.url} with Priors credit: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network: Robinhood Chain only.
   *
   * @param network - The network to check.
   * @returns True on Robinhood Chain (chain id 4663).
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && String(network.chainId) === ROBINHOOD_CHAIN_ID;

  /**
   * The x402 v2 `exact` requirement for USDG on Robinhood Chain, from the 402's header or body.
   *
   * @param probe - The 402 response.
   * @returns The requirement, or null.
   */
  private async usdgRequirement(probe: Response): Promise<Requirement | null> {
    let accepts: Requirement[] = [];
    const header = probe.headers.get("payment-required");
    if (header) {
      try {
        accepts = JSON.parse(Buffer.from(header, "base64").toString("utf8")).accepts ?? [];
      } catch {
        accepts = [];
      }
    }
    if (!accepts.length) {
      try {
        accepts = ((await probe.clone().json()) as { accepts?: Requirement[] }).accepts ?? [];
      } catch {
        accepts = [];
      }
    }
    return (
      accepts.find(
        r =>
          r.scheme === "exact" &&
          r.network === ROBINHOOD_NETWORK &&
          sameAddress(r.asset, USDG) &&
          /^\d+$/.test(String(r.amount)),
      ) ?? null
    );
  }

  /**
   * Borrows `amount` atomic USDG for `days` from the agent's line into this wallet.
   *
   * @param walletProvider - The wallet provider.
   * @param agentId - The agent id.
   * @param amount - Atomic USDG.
   * @param days - The term in days.
   * @returns The loan.
   */
  private async borrowAmount(
    walletProvider: EvmWalletProvider,
    agentId: number,
    amount: bigint,
    days: number,
  ) {
    const me = walletProvider.getAddress() as Hex;
    const term = BigInt(days * 86400);
    const [fee] = (await walletProvider.readContract({
      address: PRIORS_POOL,
      abi: POOL_ABI,
      functionName: "quoteFee",
      args: [BigInt(agentId), amount, term],
    })) as readonly [bigint, bigint, bigint, bigint];
    const hash = await walletProvider.sendTransaction({
      to: PRIORS_POOL,
      data: encodeFunctionData({
        abi: POOL_ABI,
        functionName: "borrow",
        args: [BigInt(agentId), amount, term, me, fee],
      }),
    });
    const receipt = await walletProvider.waitForTransactionReceipt(hash);
    let loanId = "?";
    let dueAt = "?";
    for (const log of (receipt?.logs ?? []) as Array<{
      address: string;
      data: Hex;
      topics: [Hex, ...Hex[]];
    }>) {
      if (!sameAddress(log.address, PRIORS_POOL)) continue;
      try {
        const ev = decodeEventLog({ abi: POOL_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "Borrowed") {
          loanId = String(ev.args.loanId);
          dueAt = new Date(Number(ev.args.dueAt) * 1000).toISOString();
        }
      } catch {
        // another event of the pool
      }
    }
    return { amount, fee, hash, loanId, dueAt };
  }
}

export const priorsActionProvider = (fetchImpl?: typeof fetch) =>
  new PriorsActionProvider(fetchImpl);
