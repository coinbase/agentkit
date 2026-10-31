import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, erc20Abi } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { POOL_ABI, PRIORS_POOL, USDG } from "./constants";
import { PayX402WithCreditSchema, BorrowSchema } from "./schemas";
import { priorsActionProvider } from "./priorsActionProvider";

const paidFetch = jest.fn();
jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn().mockImplementation(() => {
    const c = { register: jest.fn(), registerPolicy: jest.fn() };
    c.register.mockReturnValue(c);
    c.registerPolicy.mockReturnValue(c);
    return c;
  }),
  wrapFetchWithPayment: jest.fn(() => paidFetch),
}));
jest.mock("@x402/evm/exact/client", () => ({ ExactEvmScheme: jest.fn() }));

const ME = "0x1234567890123456789012345678901234543210";
const PAY_TO = "0x86727111a44084cc7a7c1c5d8ac4b0eca4d7db66";

/**
 * A wallet whose reads answer `reads[functionName]` and whose sends are recorded.
 *
 * @param reads - The value each contract read returns, by function name.
 * @param borrowedLog - Whether a receipt carries the pool's Borrowed event.
 * @returns The mocked wallet provider and the transactions it sent.
 */
function wallet(reads: Record<string, unknown>, borrowedLog = true) {
  const sent: Array<{ to: string; data: string }> = [];
  const provider = {
    getAddress: jest.fn(() => ME),
    getNetwork: jest.fn(() => ({ protocolFamily: "evm", chainId: "4663" })),
    toSigner: jest.fn(() => ({ address: ME })),
    readContract: jest.fn(
      async ({ functionName }: { functionName: string }) => reads[functionName],
    ),
    sendTransaction: jest.fn(async (tx: { to: string; data: string }) => {
      sent.push(tx);
      return `0xhash${sent.length}`;
    }),
    waitForTransactionReceipt: jest.fn(async () => ({
      logs: borrowedLog
        ? [
            {
              address: PRIORS_POOL,
              topics: encodeEventTopics({
                abi: POOL_ABI,
                eventName: "Borrowed",
                args: { loanId: 50900n, agentId: 437n, sponsorId: 8646n },
              }),
              data: encodeAbiParameters(
                [{ type: "uint256" }, { type: "uint256" }, { type: "uint64" }, { type: "address" }],
                [1000000n, 1666n, 1794000000n, ME],
              ),
            },
          ]
        : [],
    })),
  } as unknown as EvmWalletProvider;
  return { provider, sent };
}

const requirement = (amount: string) => ({
  scheme: "exact",
  network: "eip155:4663",
  asset: USDG,
  amount,
  payTo: PAY_TO,
});
const res402 = (amount: string) =>
  new Response("{}", {
    status: 402,
    headers: {
      "payment-required": Buffer.from(
        JSON.stringify({ x402Version: 2, accepts: [requirement(amount)] }),
      ).toString("base64"),
    },
  });

describe("Priors schemas", () => {
  it("parses a payment with its defaults, and refuses one without its price", () => {
    const ok = PayX402WithCreditSchema.safeParse({
      url: "https://check.blockpin.dev/check",
      agentId: 437,
      maxPrice: "0.10",
    });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({ maxBorrow: "0", days: 7 });
    expect(PayX402WithCreditSchema.safeParse({ url: "https://x.dev", agentId: 437 }).success).toBe(
      false,
    );
    expect(BorrowSchema.safeParse({ agentId: 0, amount: "1" }).success).toBe(false);
  });
});

describe("get_priors_agent_record", () => {
  it("reads the public check API and says the record in plain words", async () => {
    const fetchImpl = jest.fn(async () =>
      Response.json({
        agents: [
          {
            name: "Blockpin",
            record: { loansRepaid: 2, volumeRepaidUsdg: 10, activeLoans: 1, defaulted: false },
            scoreV2: { lateRepayments: 1, score: 0, rungName: "started" },
          },
        ],
      }),
    );
    const out = await priorsActionProvider(fetchImpl as unknown as typeof fetch).getAgentRecord(
      wallet({}).provider,
      { agentId: 9233 },
    );
    expect(fetchImpl).toHaveBeenCalledWith("https://priors.trade/api/check?agent=9233");
    expect(out).toContain("loans repaid: 2 (10 USDG)");
    expect(out).toContain("defaulted: no");
  });
});

describe("get_priors_credit_line", () => {
  it("reads the line from the public hub API in USDG (atomic amounts)", async () => {
    const fetchImpl = jest.fn(async () =>
      Response.json({
        agent: { line: { limit: 5000000, drawn: 1000000, available: 4000000 }, activeLoans: 1 },
      }),
    );
    const out = await priorsActionProvider(fetchImpl as unknown as typeof fetch).getCreditLine(
      wallet({}).provider,
      { agentId: 437 },
    );
    expect(fetchImpl).toHaveBeenCalledWith("https://priors.trade/api/hub/agent?id=437");
    expect(out).toBe("Agent #437's Priors line: 5 USDG, drawn 1, available 4; open loans: 1.");
  });

  it("says when an agent has no line", async () => {
    const fetchImpl = jest.fn(async () => Response.json({ agent: {} }));
    const out = await priorsActionProvider(fetchImpl as unknown as typeof fetch).getCreditLine(
      wallet({}).provider,
      { agentId: 9 },
    );
    expect(out).toBe("Agent #9 has no Priors line.");
  });
});

describe("borrow_from_priors", () => {
  it("quotes the fee, borrows with it as the most to pay, and reads the loan from the Borrowed event", async () => {
    const { provider, sent } = wallet({ quoteFee: [1666n, 0n, 0n, 0n] });
    const out = await priorsActionProvider().borrow(provider, {
      agentId: 437,
      amount: "1",
      days: 7,
    });
    expect(sent).toEqual([
      {
        to: PRIORS_POOL,
        data: encodeFunctionData({
          abi: POOL_ABI,
          functionName: "borrow",
          args: [437n, 1000000n, 604800n, ME, 1666n],
        }),
      },
    ]);
    expect(out).toContain("loan #50900");
  });
});

describe("repay_priors_loan", () => {
  const loan = { agentId: 437n, principal: 1000000n, fee: 1666n, status: 1 };
  it("approves exactly what is due when the allowance is short, then repays it", async () => {
    const { provider, sent } = wallet({ getLoan: loan, balanceOf: 2000000n, allowance: 0n });
    const out = await priorsActionProvider().repay(provider, { loanId: 50900 });
    expect(sent).toEqual([
      {
        to: USDG,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [PRIORS_POOL, 1001666n],
        }),
      },
      {
        to: PRIORS_POOL,
        data: encodeFunctionData({
          abi: POOL_ABI,
          functionName: "repay",
          args: [50900n, 437n, 1001666n],
        }),
      },
    ]);
    expect(out).toContain("1.001666 USDG");
  });
  it("sends nothing when the wallet is short of what is due", async () => {
    const { provider, sent } = wallet({ getLoan: loan, balanceOf: 10n, allowance: 0n });
    expect(await priorsActionProvider().repay(provider, { loanId: 50900 })).toContain("Error");
    expect(sent).toEqual([]);
  });
});

describe("pay_x402_with_priors_credit", () => {
  beforeEach(() =>
    paidFetch.mockReset().mockResolvedValue(new Response("the data", { status: 200 })),
  );

  it("refuses a price above maxPrice before anything is signed", async () => {
    const { provider, sent } = wallet({ balanceOf: 5000000n });
    const fetchImpl = jest.fn(async () => res402("200000"));
    const out = await priorsActionProvider(fetchImpl as unknown as typeof fetch).payX402WithCredit(
      provider,
      {
        url: "https://check.blockpin.dev/check",
        agentId: 437,
        maxPrice: "0.10",
        maxBorrow: "0",
        days: 7,
      },
    );
    expect(out).toContain("above maxPrice");
    expect([sent, paidFetch.mock.calls.length]).toEqual([[], 0]);
  });

  it("with the wallet short and no borrowing allowed, pays nothing", async () => {
    const { provider, sent } = wallet({ balanceOf: 0n, getParams: { minLoan: 1000000n } });
    const fetchImpl = jest.fn(async () => res402("100000"));
    const out = await priorsActionProvider(fetchImpl as unknown as typeof fetch).payX402WithCredit(
      provider,
      {
        url: "https://check.blockpin.dev/check",
        agentId: 437,
        maxPrice: "0.10",
        maxBorrow: "0",
        days: 7,
      },
    );
    expect(out).toContain("Nothing was paid");
    expect([sent, paidFetch.mock.calls.length]).toEqual([[], 0]);
  });

  it("with the wallet short, borrows the pool's minimum loan when maxBorrow covers it, then pays", async () => {
    const { provider, sent } = wallet({
      balanceOf: 0n,
      getParams: { minLoan: 1000000n },
      quoteFee: [1666n, 0n, 0n, 0n],
    });
    const fetchImpl = jest.fn(async () => res402("100000"));
    const out = await priorsActionProvider(fetchImpl as unknown as typeof fetch).payX402WithCredit(
      provider,
      {
        url: "https://check.blockpin.dev/check",
        agentId: 437,
        maxPrice: "0.10",
        maxBorrow: "1",
        days: 7,
      },
    );
    expect(sent.map(t => t.to)).toEqual([PRIORS_POOL]);
    expect(paidFetch).toHaveBeenCalledWith("https://check.blockpin.dev/check");
    expect(out).toContain("Borrowed 1 USDG first: loan #50900");
    expect(out).toContain("Paid 0.1 USDG");
  });

  it("with the wallet holding the price, pays without borrowing", async () => {
    const { provider, sent } = wallet({ balanceOf: 5000000n });
    const fetchImpl = jest.fn(async () => res402("100000"));
    const out = await priorsActionProvider(fetchImpl as unknown as typeof fetch).payX402WithCredit(
      provider,
      {
        url: "https://check.blockpin.dev/check",
        agentId: 437,
        maxPrice: "0.10",
        maxBorrow: "1",
        days: 7,
      },
    );
    expect(sent).toEqual([]);
    expect(out).not.toContain("Borrowed");
  });
});

describe("supportsNetwork", () => {
  it("is Robinhood Chain only", () => {
    const p = priorsActionProvider();
    expect(p.supportsNetwork({ protocolFamily: "evm", chainId: "4663" })).toBe(true);
    expect(
      p.supportsNetwork({ protocolFamily: "evm", chainId: "8453", networkId: "base-mainnet" }),
    ).toBe(false);
  });
});
