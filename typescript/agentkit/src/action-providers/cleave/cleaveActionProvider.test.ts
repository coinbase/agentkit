import { CleaveActionProvider, cleaveActionProvider } from "./cleaveActionProvider";
import { CleaveBuyGasSchema, CleaveExecuteSwapSchema, CleavePlanSwapSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

const WALLET = "0x00000000000000000000000000000000000A11cE";
const BASE: Network = { protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" };

const PLAN = {
  requestId: "dbd8c33f-077b-46aa-9787-b7bc813738f4",
  blocked: false,
  requiresConfirmation: true,
  route: { class: "same_chain", outcomeKind: "at_least", endStates: ["delivered"], etaSec: 2 },
  send: {
    chainId: 8453,
    token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    symbol: "USDC",
    amount: "10",
  },
  pullsAtMost: "10",
  receive: {
    chainId: 8453,
    token: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    expected: "0.004371395405113607",
    minimum: "0.004349538428088038",
    fallback: null,
    refund: null,
  },
  fees: [],
  notices: [
    {
      code: "no_native_gas",
      level: "warn",
      message:
        "This wallet needs native gas unless it pays gas another way; cleave_get_gas fits a wallet with none.",
    },
  ],
  quotedAt: 1793735005,
  validUntil: 1793735065,
  calls: [
    {
      chainId: 8453,
      from: "0x00000000000000000000000000000000000a11ce",
      to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      data: "0x095ea7b3000000000000000000000000b08f28a3575805ee1e3729fc19ab7e869cbaf5630000000000000000000000000000000000000000000000000000000000989680",
      value: "0x0",
    },
    {
      chainId: 8453,
      from: "0x00000000000000000000000000000000000a11ce",
      to: "0xb08F28a3575805ee1E3729fc19Ab7E869CBAF563",
      data: "0xab33b1ec000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000042000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000989680000000000000000000000000000000000000000000000000000f73e1d4f16ee6000000000000000000000000000000000000000000000000000000006aea3e0c00000000000000000000000000000000000000000000000000000000000a11ce00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000361070000000000000000000000000000000000000000000000000000000000000020f87e11850000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000098968000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000dbc6998296caa1652a810dc8d3baf4a8294330f10000000000000000000000000000000000000000000000000000000000000001ffb9af9ea6d9e39da47392ecc7055277b9915b8bfc9f83f105821b7791a6ae3000000000000000000000000000000000000000000000000000000000000000003c89abe0caeeceacdc80eb42e2d56815d123163977b86f44a95b84829bc10ae700000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000989680000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      value: "0x0",
    },
  ],
  next: "Sign the calls in order before validUntil, then call cleave_track_swap with the chain and the mined hash.",
};

const GAS_OFFER = {
  offer:
    "g2.Y2AYSMAUgU8265VlLH79jA4EzH-AX54ZvzQDswIB-QT88owN-OUVWZF5zaadf6693fag36fG6Mp36ZC9CzSFkeWtXDOFbRQZrXefnFVsv2Pi8v-__s7Ca7yPN4HwydqPzJuytPtjtVGQUOTXc1GzFtU9WRBmZI1fPwHAJXiObHn29cbH_Lgn4dOe9crm4X6rEwYmc3816LV7qz_x3e4s3iQlG7N_zzGWRxPrk1-4HiPf8UQBjtBgFwXn_Mw8MvUzGhFQAAA.cRjMgFj7touJP_R0N_ChdLgnRJvwPb_qmmqY9xIbf9c",
  kind: "swap",
  payChainId: 8453,
  chainId: 8453,
  payTo: "0xe11179a054eD96AfF01131FCb5F4e2e4FD8F134B",
  factory: "0x129f934211510b8C0Ac0ef07366f5dba92477c36",
  template: "0x122d0a1e55d6Cd966c906AB27C4C74e7a3B9eD79",
  order: {
    chainId: "8453",
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    shell: "0x3A4569133c21013bbBc99a733FB891A7fffafD9a",
    amount: "5000000",
    fee: "27327",
    feeRecipient: "0x94a58bf17B32521259F5Ce5A9aa27Ee4a056323B",
    maxProtocolFeeBps: "0",
    refundTo: "0x00000000000000000000000000000000000A11cE",
    recipient: "0x00000000000000000000000000000000000A11cE",
    minOut: "2162961742171026",
    deadline: "1793735905",
    quoteId: "0xbf3ac830349dfa802e874b27e44db74317821a1d5cbfbcc604e2917f63e845c6",
  },
  orderHash: "0x31ac35e382b194051e8a44abd572e809086739e586d56e664d215fb1f4feebf6",
  outcome: "native_or_refund",
  pay: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", amount: "5" },
  fee: { usdc: "0.027327" },
  receive: { symbol: "ETH", minimum: "0.002162961742171026", minimumWei: "2162961742171026" },
  deadline: 1793735905,
  refundTo: "0x00000000000000000000000000000000000A11cE",
  typedData: {
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: 8453,
      verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    types: {
      ReceiveWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "ReceiveWithAuthorization",
    message: {
      from: "0x00000000000000000000000000000000000A11cE",
      to: "0xe11179a054eD96AfF01131FCb5F4e2e4FD8F134B",
      value: "5000000",
      validAfter: "0",
      validBefore: "1793735605",
      nonce: "0x31ac35e382b194051e8a44abd572e809086739e586d56e664d215fb1f4feebf6",
    },
  },
  verify:
    "Recompute orderHash and payTo from order with the published factory and template before signing.",
};

const NOW_MS = (PLAN.quotedAt + 5) * 1000;
const SWAP_ARGS = { sellToken: "USDC", buyToken: "WETH", amount: "10" };
const GAS_ARGS = { amount: "5" };

type Answer = { status?: number; body: unknown };

/**
 * Answers each API call in turn and records what was posted.
 *
 * @param answers - The answers, in call order.
 * @returns The recorded calls.
 */
function answering(...answers: Answer[]): { url: string; body: Record<string, unknown> }[] {
  const posted: { url: string; body: Record<string, unknown> }[] = [];
  (global.fetch as jest.Mock).mockImplementation(async (url: string, init: RequestInit) => {
    posted.push({ url, body: JSON.parse(String(init.body)) });
    const answer = answers[posted.length - 1] ?? answers[answers.length - 1];
    return new Response(JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return posted;
}

/**
 * Returns a deep copy of a fixture.
 *
 * @param value - The fixture.
 * @returns The copy.
 */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const OTHER = "0x0000000000000000000000000000000000000B0b";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const hashOf = (n: number): `0x${string}` => `0x${n.toString(16).padStart(64, "0")}`;

describe("CleaveActionProvider", () => {
  let provider: CleaveActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;
  let getCode: jest.Mock;

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(Date, "now").mockReturnValue(NOW_MS);
    provider = cleaveActionProvider();
    getCode = jest.fn().mockResolvedValue(undefined);
    let n = 0;
    wallet = {
      getAddress: jest.fn().mockReturnValue(WALLET),
      getName: jest.fn().mockReturnValue("viem_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue(BASE),
      sendTransaction: jest.fn().mockImplementation(async () => hashOf(++n)),
      waitForTransactionReceipt: jest.fn().mockImplementation(async (hash: string) => ({
        status: "success",
        transactionHash: hash,
      })),
      signTypedData: jest.fn().mockResolvedValue(`0x${"11".repeat(65)}`),
      getPublicClient: jest.fn().mockReturnValue({ getCode }),
      readContract: jest.fn().mockResolvedValue(6),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Plans a swap and returns its requestId.
   *
   * @param plan - The API answer.
   * @param args - The plan_swap inputs.
   * @returns The plan_swap answer.
   */
  async function planned(plan: unknown = PLAN, args: Record<string, unknown> = SWAP_ARGS) {
    answering({ body: plan });
    return JSON.parse(await provider.planSwap(wallet, args as typeof SWAP_ARGS));
  }

  /**
   * Executes a plan by its requestId.
   *
   * @param requestId - The requestId.
   * @returns The execute_swap answer.
   */
  async function executed(requestId: string = PLAN.requestId) {
    return JSON.parse(await provider.executeSwap(wallet, { requestId, confirmed: true }));
  }

  describe("supportsNetwork", () => {
    it("supports the six Cleave chains only", () => {
      for (const chainId of ["1", "10", "56", "137", "8453", "42161"]) {
        expect(provider.supportsNetwork({ protocolFamily: "evm", chainId })).toBe(true);
      }
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "84532" })).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  describe("schemas", () => {
    it("requires a requestId and confirmed: true to execute, and confirmed: true to buy", () => {
      const id = PLAN.requestId;
      expect(CleaveExecuteSwapSchema.safeParse({ requestId: id, confirmed: true }).success).toBe(
        true,
      );
      expect(CleaveExecuteSwapSchema.safeParse({ requestId: id, confirmed: false }).success).toBe(
        false,
      );
      expect(CleaveExecuteSwapSchema.safeParse({ requestId: id }).success).toBe(false);
      expect(CleaveExecuteSwapSchema.safeParse({ confirmed: true }).success).toBe(false);
      expect(CleaveBuyGasSchema.safeParse({ ...GAS_ARGS, confirmed: true }).success).toBe(true);
      expect(CleaveBuyGasSchema.safeParse(GAS_ARGS).success).toBe(false);
    });

    it("rejects malformed amounts, chains and addresses", () => {
      expect(CleavePlanSwapSchema.safeParse({ ...SWAP_ARGS, amount: "1e3" }).success).toBe(false);
      expect(CleavePlanSwapSchema.safeParse({ ...SWAP_ARGS, toChainId: 84532 }).success).toBe(
        false,
      );
      expect(CleavePlanSwapSchema.safeParse({ ...SWAP_ARGS, toChainId: "42161" }).success).toBe(
        false,
      );
      expect(CleavePlanSwapSchema.safeParse({ ...SWAP_ARGS, recipient: "0x1234" }).success).toBe(
        false,
      );
      expect(CleavePlanSwapSchema.safeParse({ ...SWAP_ARGS, maxSlippageBps: 6000 }).success).toBe(
        false,
      );
    });
  });

  describe("find_token", () => {
    it("searches the wallet's chain by default", async () => {
      const posted = answering({ body: { candidates: [] } });
      const result = JSON.parse(await provider.findToken(wallet, { query: "USDC" }));
      expect(result).toEqual({ candidates: [] });
      expect(posted).toEqual([
        {
          url: "https://api.cleave.fi/agent/v1/find_token",
          body: { chainId: 8453, query: "USDC" },
        },
      ]);
    });
  });

  describe("plan_swap", () => {
    it("plans for the wallet on its chain, sends nothing and drops the API's next text", async () => {
      const posted = answering({ body: PLAN });
      const result = JSON.parse(await provider.planSwap(wallet, { ...SWAP_ARGS, toChainId: null }));
      expect(posted[0].body).toEqual({ fromChainId: 8453, wallet: WALLET, ...SWAP_ARGS });
      expect(result.requestId).toBe(PLAN.requestId);
      expect(result.calls).toHaveLength(2);
      expect(result.next).not.toBe(PLAN.next);
      expect(result.next).toContain("execute_swap");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses a plan whose call goes to a contract outside the published list, and keeps nothing", async () => {
      const plan = copy(PLAN);
      plan.calls[1].to = "0x000000000000000000000000000000000000dEaD";
      const result = await planned(plan);
      expect(result.error.code).toBe("address_not_allowed");
      expect(result.calls).toBeUndefined();
      expect((await executed()).error.code).toBe("plan_unavailable");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("keeps no blocked plan", async () => {
      await planned({ ...copy(PLAN), blocked: true, calls: [] });
      expect((await executed()).error.code).toBe("plan_unavailable");
    });

    it("refuses a wallet on a chain Cleave does not support", async () => {
      wallet.getNetwork.mockReturnValue({ protocolFamily: "evm", chainId: "84532" });
      const result = JSON.parse(await provider.planSwap(wallet, SWAP_ARGS));
      expect(result.error.code).toBe("unsupported_chain");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("needs a recipient for a cross-chain swap from a smart contract wallet", async () => {
      getCode.mockResolvedValue("0x6080604052");
      answering({ body: PLAN });
      const byCode = JSON.parse(
        await provider.planSwap(wallet, { ...SWAP_ARGS, toChainId: 42161 }),
      );
      expect(byCode.error.code).toBe("recipient_required");
      wallet.getName.mockReturnValue("zerodev_wallet_provider");
      getCode.mockResolvedValue(undefined);
      const byType = JSON.parse(
        await provider.planSwap(wallet, { ...SWAP_ARGS, toChainId: 42161 }),
      );
      expect(byType.error.code).toBe("recipient_required");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("plans a cross-chain swap from a smart contract wallet that names the recipient", async () => {
      getCode.mockResolvedValue("0x6080604052");
      const posted = answering({
        body: { error: { code: "no_route", message: "x", retryable: false } },
      });
      await provider.planSwap(wallet, { ...SWAP_ARGS, toChainId: 42161, recipient: WALLET });
      expect(posted).toHaveLength(1);
    });
  });

  describe("execute_swap", () => {
    it("sends exactly the planned calls in order, without planning again", async () => {
      await planned();
      const result = await executed();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(wallet.sendTransaction.mock.calls.map(([tx]) => tx)).toEqual(
        PLAN.calls.map(c => ({ to: c.to, data: c.data, value: BigInt(c.value) })),
      );
      expect(wallet.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
      expect(result.requestId).toBe(PLAN.requestId);
      expect(result.chainId).toBe(8453);
      expect(result.sent).toEqual([
        { txHash: hashOf(1), status: "success" },
        { txHash: hashOf(2), status: "success" },
      ]);
      expect(result.txHash).toBe(hashOf(2));
    });

    it("runs a plan only once", async () => {
      await planned();
      await executed();
      expect((await executed()).error.code).toBe("plan_unavailable");
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(2);
    });

    it("refuses an unknown requestId", async () => {
      expect((await executed("not-planned")).error.code).toBe("plan_unavailable");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses after validUntil and does not keep the plan", async () => {
      await planned();
      (Date.now as jest.Mock).mockReturnValue((PLAN.validUntil + 1) * 1000);
      expect((await executed()).error.code).toBe("plan_expired");
      (Date.now as jest.Mock).mockReturnValue(NOW_MS);
      expect((await executed()).error.code).toBe("plan_unavailable");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses without confirmed: true and keeps the plan", async () => {
      await planned();
      const result = JSON.parse(
        await provider.executeSwap(wallet, {
          requestId: PLAN.requestId,
          confirmed: false as unknown as true,
        }),
      );
      expect(result.error.code).toBe("not_confirmed");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
      expect((await executed()).requestId).toBe(PLAN.requestId);
    });

    it.each([
      [
        "another address",
        (w: jest.Mocked<EvmWalletProvider>) => w.getAddress.mockReturnValue(OTHER),
      ],
      [
        "another chain",
        (w: jest.Mocked<EvmWalletProvider>) =>
          w.getNetwork.mockReturnValue({ protocolFamily: "evm", chainId: "42161" }),
      ],
    ])("refuses a wallet that now has %s", async (_name, change) => {
      await planned();
      change(wallet);
      expect((await executed()).error.code).toBe("wallet_changed");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("stops when the wallet changes between calls and returns the sent hash", async () => {
      await planned();
      wallet.waitForTransactionReceipt.mockImplementationOnce(async (hash: string) => {
        wallet.getAddress.mockReturnValue(OTHER);
        return { status: "success", transactionHash: hash };
      });
      const result = await executed();
      expect(result.error.code).toBe("wallet_changed");
      expect(result.error.sent).toEqual([{ txHash: hashOf(1), status: "success" }]);
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["a buy token symbol the checks do not pin", { ...SWAP_ARGS, buyToken: "DAI" }],
      ["a sell token symbol the checks do not pin", { ...SWAP_ARGS, sellToken: "USDbC" }],
    ])("refuses %s", async (_name, args) => {
      const plan = await planned(PLAN, args);
      expect(plan.requestId).toBe(PLAN.requestId);
      const result = await executed();
      expect(result.error.code).toBe("token_not_pinned");
      expect(result.error.message).toContain("find_token");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("sends a sell token given by address when the approve is for exactly the amount in its decimals", async () => {
      await planned(PLAN, { ...SWAP_ARGS, sellToken: USDC_BASE });
      const result = await executed();
      expect(wallet.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ address: USDC_BASE.toLowerCase(), functionName: "decimals" }),
      );
      expect(result.sent).toHaveLength(2);
    });

    it("refuses a sell token given by address when the approve is for another amount in its decimals", async () => {
      wallet.readContract.mockResolvedValue(18);
      await planned(PLAN, { ...SWAP_ARGS, sellToken: USDC_BASE });
      expect((await executed()).error.code).toBe("amount_mismatch");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses a sell token given by address whose decimals cannot be read", async () => {
      wallet.readContract.mockRejectedValue(new Error("execution reverted"));
      await planned(PLAN, { ...SWAP_ARGS, sellToken: USDC_BASE });
      expect((await executed()).error.code).toBe("amount_unchecked");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("reports an unknown outcome with every sent hash when the last receipt wait throws", async () => {
      wallet.waitForTransactionReceipt
        .mockImplementationOnce(async (hash: string) => ({
          status: "success",
          transactionHash: hash,
        }))
        .mockRejectedValueOnce(new Error("Timed out while waiting for transaction"));
      await planned();
      const result = await executed();
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(2);
      expect(result.error.code).toBe("outcome_unknown");
      expect(result.error.message).toContain("track_swap before any retry");
      expect(result.error.chainId).toBe(8453);
      expect(result.error.requestId).toBe(PLAN.requestId);
      expect(result.error.sent).toEqual([
        { txHash: hashOf(1), status: "success" },
        { txHash: hashOf(2), status: "pending" },
      ]);
    });

    it("reports an unknown outcome when the approve's receipt wait throws", async () => {
      wallet.waitForTransactionReceipt.mockRejectedValueOnce(new Error("timeout"));
      await planned();
      const result = await executed();
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
      expect(result.error.code).toBe("outcome_unknown");
      expect(result.error.sent).toEqual([{ txHash: hashOf(1), status: "pending" }]);
    });

    it("reports an unknown outcome when sending throws", async () => {
      wallet.sendTransaction
        .mockResolvedValueOnce(hashOf(1))
        .mockRejectedValueOnce(new Error("request timed out"));
      await planned();
      const result = await executed();
      expect(result.error.code).toBe("outcome_unknown");
      expect(result.error.sent).toHaveLength(1);
    });

    it("labels smart wallet hashes as user operations and keeps the mined tx hash", async () => {
      wallet.getName.mockReturnValue("cdp_smart_wallet_provider");
      wallet.waitForTransactionReceipt.mockImplementation(async (hash: string) => ({
        status: "complete",
        transactionHash: `0x${hash.slice(-1).repeat(64)}`,
      }));
      await planned();
      const result = await executed();
      expect(result.sent).toEqual([
        { userOpHash: hashOf(1), status: "complete", txHash: `0x${"1".repeat(64)}` },
        { userOpHash: hashOf(2), status: "complete", txHash: `0x${"2".repeat(64)}` },
      ]);
      expect(result.txHash).toBe(`0x${"2".repeat(64)}`);
    });

    it("waits again for a smart wallet's user operation before giving up", async () => {
      wallet.getName.mockReturnValue("cdp_smart_wallet_provider");
      wallet.waitForTransactionReceipt.mockRejectedValueOnce(new Error("timeout"));
      await planned();
      const result = await executed();
      expect(wallet.waitForTransactionReceipt).toHaveBeenCalledTimes(3);
      expect(result.sent).toHaveLength(2);
    });

    it("reports a smart wallet's unresolved user operation without pointing to track_swap", async () => {
      wallet.getName.mockReturnValue("cdp_smart_wallet_provider");
      wallet.waitForTransactionReceipt
        .mockRejectedValueOnce(new Error("timeout"))
        .mockRejectedValueOnce(new Error("timeout"));
      await planned();
      const result = await executed();
      expect(result.error.code).toBe("outcome_unknown");
      expect(result.error.message).toContain("user operation before any retry");
      expect(result.error.message).not.toContain("track_swap");
      expect(result.error.sent).toEqual([{ userOpHash: hashOf(1), status: "pending" }]);
    });

    it("keeps URLs out of error text", async () => {
      wallet.waitForTransactionReceipt.mockRejectedValueOnce(
        new Error(
          "HTTP request failed. URL: https://rpc.example.com/v2/secret-key Details: timeout",
        ),
      );
      await planned();
      const text = await provider.executeSwap(wallet, {
        requestId: PLAN.requestId,
        confirmed: true,
      });
      expect(text).not.toContain("https://");
      expect(text).not.toContain("secret-key");
      expect(JSON.parse(text).error.code).toBe("outcome_unknown");
    });

    it("stops at the first failed call", async () => {
      wallet.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
      await planned();
      const result = await executed();
      expect(result.error.code).toBe("transaction_failed");
      expect(result.error.sent).toHaveLength(1);
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("stops when the plan expires between calls", async () => {
      wallet.waitForTransactionReceipt.mockImplementationOnce(async (hash: string) => {
        (Date.now as jest.Mock).mockReturnValue((PLAN.validUntil + 1) * 1000);
        return { status: "success", transactionHash: hash };
      });
      await planned();
      const result = await executed();
      expect(result.error.code).toBe("plan_expired");
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("track_swap", () => {
    it("passes only the given fields and drops the API's next text and URLs", async () => {
      const posted = answering({
        body: {
          state: "delivered",
          next: "call cleave_track_swap",
          note: "see https://example.com/x",
        },
      });
      const result = JSON.parse(
        await provider.trackSwap(wallet, {
          chainId: 8453,
          txHash: null,
          requestId: PLAN.requestId,
        }),
      );
      expect(result).toEqual({ state: "delivered", note: "see [url]" });
      expect(posted[0].body).toEqual({ chainId: 8453, requestId: PLAN.requestId });
    });
  });

  describe("quote_gas", () => {
    it("is not offered for BNB Chain", async () => {
      wallet.getNetwork.mockReturnValue({ protocolFamily: "evm", chainId: "56" });
      for (const result of [
        JSON.parse(await provider.quoteGas(wallet, GAS_ARGS)),
        JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true })),
      ]) {
        expect(result.error.code).toBe("unsupported_chain");
        expect(result.error.message).toContain("not offered for this chain");
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("quotes for the wallet on its chain without signing", async () => {
      const posted = answering({ body: GAS_OFFER });
      const result = JSON.parse(await provider.quoteGas(wallet, GAS_ARGS));
      expect(posted[0].body).toEqual({
        payChainId: 8453,
        chainId: 8453,
        recipient: WALLET,
        amount: "5",
        wallet: WALLET,
      });
      expect(result.orderHash).toBe(GAS_OFFER.orderHash);
      expect(result.typedData).toBeUndefined();
      expect(result.offer).toBeUndefined();
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });
  });

  describe("buy_gas", () => {
    const SIGNATURE = `0x${"11".repeat(65)}`;
    const SUBMITTED = {
      requestId: `g:8453:${GAS_OFFER.orderHash}`,
      state: "accepted",
      payTo: GAS_OFFER.payTo,
      deadline: GAS_OFFER.deadline,
    };

    it("signs the checked authorization once and submits it", async () => {
      const posted = answering({ body: GAS_OFFER }, { body: SUBMITTED });
      const result = JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true }));
      expect(wallet.signTypedData).toHaveBeenCalledTimes(1);
      const typed = wallet.signTypedData.mock.calls[0][0];
      expect(typed.domain).toEqual(GAS_OFFER.typedData.domain);
      expect(typed.message.value).toBe(BigInt(GAS_OFFER.typedData.message.value));
      expect(typed.message.nonce).toBe(GAS_OFFER.typedData.message.nonce);
      expect(posted[1].body).toEqual({
        offer: GAS_OFFER.offer,
        signature: SIGNATURE,
        wallet: WALLET,
      });
      expect(result.requestId).toBe(SUBMITTED.requestId);
      expect(JSON.stringify(result)).not.toContain("1111111111");
    });

    it.each([
      [
        "another payment address",
        (o: typeof GAS_OFFER) => {
          o.payTo = "0x000000000000000000000000000000000000dEaD";
        },
      ],
      [
        "another authorization recipient",
        (o: typeof GAS_OFFER) => {
          o.typedData.message.to = "0x000000000000000000000000000000000000dEaD";
        },
      ],
      [
        "another token domain",
        (o: typeof GAS_OFFER) => {
          o.typedData.domain.verifyingContract = "0x000000000000000000000000000000000000dEaD";
        },
      ],
    ])("signs nothing for %s", async (_name, tamper) => {
      const offer = copy(GAS_OFFER);
      tamper(offer);
      answering({ body: offer });
      const result = JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true }));
      expect(result.error.code).toBe("address_not_allowed");
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("refuses a smart wallet provider before reading any code", async () => {
      wallet.getName.mockReturnValue("cdp_smart_wallet_provider");
      answering({ body: GAS_OFFER });
      const result = JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true }));
      expect(result.error.code).toBe("wallet_not_supported");
      expect(getCode).not.toHaveBeenCalled();
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("signs nothing for a smart contract wallet", async () => {
      getCode.mockResolvedValue("0x6080604052");
      answering({ body: GAS_OFFER });
      const result = JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true }));
      expect(result.error.code).toBe("wallet_not_supported");
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("signs for an EIP-7702 delegated wallet", async () => {
      getCode.mockResolvedValue(`0xef0100${"ab".repeat(20)}`);
      answering({ body: GAS_OFFER }, { body: SUBMITTED });
      const result = JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true }));
      expect(result.requestId).toBe(SUBMITTED.requestId);
      expect(wallet.signTypedData).toHaveBeenCalledTimes(1);
    });

    it("signs nothing when the wallet changes before signing", async () => {
      wallet.getAddress.mockReturnValueOnce(WALLET).mockReturnValue(OTHER);
      answering({ body: GAS_OFFER });
      const result = JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true }));
      expect(result.error.code).toBe("wallet_changed");
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("signs nothing for an expired authorization", async () => {
      (Date.now as jest.Mock).mockReturnValue(
        Number(GAS_OFFER.typedData.message.validBefore) * 1000,
      );
      answering({ body: GAS_OFFER });
      const result = JSON.parse(await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true }));
      expect(result.error.code).toBe("offer_expired");
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("signs nothing without confirmed: true", async () => {
      answering({ body: GAS_OFFER });
      const result = JSON.parse(
        await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: false as unknown as true }),
      );
      expect(result.error.code).toBe("not_confirmed");
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("redacts the signature from a submission refusal that echoes it", async () => {
      answering(
        { body: GAS_OFFER },
        {
          status: 400,
          body: { error: { code: "bad_signature", message: `bad ${SIGNATURE}`, retryable: false } },
        },
      );
      const text = await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true });
      expect(text).not.toContain(SIGNATURE.slice(2));
      expect(JSON.parse(text).error.code).toBe("bad_signature");
    });

    it("returns the id to track, without the signature, when the submission does not answer", async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce(
          async () => new Response(JSON.stringify(GAS_OFFER), { status: 200 }),
        )
        .mockImplementationOnce(async () => {
          throw new TypeError(`fetch failed for ${SIGNATURE}`);
        });
      const text = await provider.buyGas(wallet, { ...GAS_ARGS, confirmed: true });
      const result = JSON.parse(text);
      expect(result.error.code).toBe("submission_unknown");
      expect(result.error.trackRequestId).toBe(SUBMITTED.requestId);
      expect(text).not.toContain(SIGNATURE.slice(2));
    });
  });

  describe("errors", () => {
    it("reports an API that cannot be reached", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError("fetch failed"));
      const result = JSON.parse(await provider.findToken(wallet, { query: "USDC" }));
      expect(result.error.code).toBe("unreachable");
    });
  });
});
