import { keccak256, toBytes } from "viem";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { BrainChainActionProvider } from "./brainchainActionProvider";
import { BRAINCHAIN_NETWORKS } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

type Requirement = {
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  maxTimeoutSeconds: number;
};
type Hooks = {
  policies: ((version: number, reqs: Requirement[]) => Requirement[])[];
  before?: (ctx: {
    selectedRequirements: Requirement;
  }) => Promise<void | { abort: true; reason: string }>;
  after?: (ctx: { paymentPayload: { payload: unknown } }) => Promise<void>;
  failure?: () => Promise<void>;
};

const MAINNET = BRAINCHAIN_NETWORKS["base-mainnet"];
const PAYLOAD = {
  payload: { authorization: { nonce: "0x01", value: "1000000" }, signature: "0xab" },
};
const ORDER = `0x${"cd".repeat(32)}`;
const TASK = {
  title: "Summarise",
  brief: "Summarise the text below.",
  levels: ["Complete", "Mostly complete"],
};

const deskRequirement = (overrides: Partial<Requirement> = {}): Requirement => ({
  network: MAINNET.network,
  asset: MAINNET.usdc,
  payTo: MAINNET.payTo,
  amount: "1000000",
  maxTimeoutSeconds: 300,
  ...overrides,
});

let hooks: Hooks;
let deskReply: () => Promise<Response>;

/**
 * Stands in for the x402 client: applies the registered policies and hooks the
 * way a real payment would, then returns the desk's reply.
 */
function mockPayingFetch() {
  jest.mocked(x402Client).mockImplementation(() => {
    hooks = { policies: [] };
    const client = {
      registerPolicy: (p: Hooks["policies"][number]) => (hooks.policies.push(p), client),
      onBeforePaymentCreation: (h: Hooks["before"]) => ((hooks.before = h), client),
      onAfterPaymentCreation: (h: Hooks["after"]) => ((hooks.after = h), client),
      onPaymentCreationFailure: (h: Hooks["failure"]) => ((hooks.failure = h), client),
    };
    return client as unknown as x402Client;
  });
  jest.mocked(wrapFetchWithPayment).mockImplementation(
    () =>
      (async () => {
        const offered = [deskRequirement()];
        const [selected] = hooks.policies.reduce((reqs, p) => p(2, reqs), offered);
        if (!selected) throw new Error("No payment option matched");
        const verdict = await hooks.before?.({ selectedRequirements: selected });
        if (verdict && "abort" in verdict) {
          await hooks.failure?.();
          throw new Error(verdict.reason);
        }
        await hooks.after?.({ paymentPayload: PAYLOAD });
        return deskReply();
      }) as unknown as typeof fetch,
  );
}

describe("BrainChainActionProvider", () => {
  let wallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPayingFetch();
    wallet = {
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      toSigner: jest
        .fn()
        .mockReturnValue({ address: "0x0000000000000000000000000000000000000001" }),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    deskReply = async () => Response.json({ order: ORDER, state: "posting" });
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet and Base Sepolia only", () => {
      const provider = new BrainChainActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        true,
      );
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });
  });

  it("refuses limits that are not positive", () => {
    expect(() => new BrainChainActionProvider({ budgetUsdc: 0 })).toThrow(/positive/);
  });

  describe("postTask", () => {
    it("pays the desk and returns the order", async () => {
      const result = JSON.parse(await new BrainChainActionProvider().postTask(wallet, TASK));
      expect(result).toMatchObject({
        order: ORDER,
        price: "1 USDC",
        statusUrl: `${MAINNET.desk}/x402/tasks/${ORDER}`,
      });
      expect(registerExactEvmScheme).toHaveBeenCalled();
    });

    it("pays only BrainChain's desk, in USDC, within the per-task cap", async () => {
      await new BrainChainActionProvider({ maxPriceUsdc: 1 }).postTask(wallet, TASK);
      const offers = [
        deskRequirement({ payTo: "0x0000000000000000000000000000000000000bad" }),
        deskRequirement({ asset: "0x0000000000000000000000000000000000000bad" }),
        deskRequirement({ amount: "2000000" }),
        deskRequirement({ network: "eip155:1" }),
        deskRequirement({ maxTimeoutSeconds: 3600 }),
        deskRequirement(),
      ];
      const kept = hooks.policies.reduce((reqs, p) => p(2, reqs), offers);
      expect(kept).toEqual([deskRequirement()]);
    });

    it("stops before signing once the budget is spent", async () => {
      const provider = new BrainChainActionProvider({ budgetUsdc: 1 });
      expect(JSON.parse(await provider.postTask(wallet, TASK)).order).toBe(ORDER);
      const second = JSON.parse(await provider.postTask(wallet, TASK));
      expect(second.error).toMatch(/budget of 1 USDC would be exceeded.*Nothing was charged/);
    });

    it("names the order from the signed payment when the desk never answers", async () => {
      deskReply = async () => {
        throw new Error("socket hang up");
      };
      const result = JSON.parse(await new BrainChainActionProvider().postTask(wallet, TASK));
      expect(result.possiblyCharged).toBe(true);
      expect(result.order).toBe(
        keccak256(
          toBytes('{"authorization":{"nonce":"0x01","value":"1000000"},"signature":"0xab"}'),
        ),
      );
    });

    it("treats a refused brief as uncharged and frees the budget", async () => {
      const provider = new BrainChainActionProvider({ budgetUsdc: 1 });
      deskReply = async () => Response.json({ error: "The brief is empty." }, { status: 400 });
      expect(JSON.parse(await provider.postTask(wallet, TASK)).error).toBe(
        "The brief is empty. Nothing was charged.",
      );
      deskReply = async () => Response.json({ order: ORDER });
      expect(JSON.parse(await provider.postTask(wallet, TASK)).order).toBe(ORDER);
    });

    it("reports a server error after signing as possibly charged", async () => {
      deskReply = async () => new Response("bad gateway", { status: 502 });
      const result = JSON.parse(await new BrainChainActionProvider().postTask(wallet, TASK));
      expect(result.possiblyCharged).toBe(true);
      expect(result.next).toMatch(/do not post again/);
    });

    it("explains a refused payment by the wallet's USDC balance", async () => {
      deskReply = async () => Response.json({}, { status: 402 });
      wallet.readContract.mockResolvedValue(500_000n as never);
      const provider = new BrainChainActionProvider({ budgetUsdc: 1 });
      const short = JSON.parse(await provider.postTask(wallet, TASK));
      expect(short.error).toBe(
        "This wallet (0x0000000000000000000000000000000000000001) holds 0.5 USDC on Base, and a task costs 1 USDC. Add USDC to it and post again. Nothing was charged.",
      );

      wallet.readContract.mockResolvedValue(5_000_000n as never);
      const required = Buffer.from(
        JSON.stringify({ x402Version: 2, error: "invalid_signature" }),
      ).toString("base64");
      deskReply = async () =>
        new Response("{}", { status: 402, headers: { "payment-required": required } });
      expect(JSON.parse(await provider.postTask(wallet, TASK)).error).toBe(
        "The desk refused the payment (invalid_signature). Nothing was charged.",
      );
    });

    it("refuses networks BrainChain does not take payment on", async () => {
      wallet.getNetwork.mockReturnValue({ protocolFamily: "evm", networkId: "ethereum-mainnet" });
      const result = JSON.parse(await new BrainChainActionProvider().postTask(wallet, TASK));
      expect(result.error).toMatch(/Base mainnet and Base Sepolia/);
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
    });
  });

  describe("getTask", () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      global.fetch = fetchMock as unknown as typeof fetch;
    });

    it("returns the accepted result text", async () => {
      const result = `${MAINNET.desk}/records/0x${"ee".repeat(32)}.txt`;
      fetchMock
        .mockResolvedValueOnce(
          Response.json({
            order: ORDER,
            state: "paid-out",
            task: { status: "paid", accepted: true },
            result,
          }),
        )
        .mockResolvedValueOnce(new Response("the summary"));
      const view = JSON.parse(
        await new BrainChainActionProvider().getTask(wallet, { order: ORDER, waitSeconds: 0 }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        `${MAINNET.desk}/x402/tasks/${ORDER}`,
        expect.anything(),
      );
      expect(view).toMatchObject({ resultText: "the summary", done: true });
    });

    it("never fetches a result link that is not the desk's own", async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({
          order: ORDER,
          state: "paid-out",
          result: "https://elsewhere.example/x.txt",
        }),
      );
      const view = JSON.parse(
        await new BrainChainActionProvider().getTask(wallet, { order: ORDER, waitSeconds: 0 }),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(view.resultText).toBeUndefined();
    });

    it("finishes on a refund and waits while the work is in progress", async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({ order: ORDER, state: "refunded", refundTx: "0xfeed" }),
      );
      expect(
        JSON.parse(
          await new BrainChainActionProvider().getTask(wallet, { order: ORDER, waitSeconds: 0 }),
        ),
      ).toMatchObject({
        done: true,
        next: expect.stringContaining("0xfeed"),
      });
      fetchMock.mockResolvedValueOnce(
        Response.json({ order: ORDER, state: "posted", task: { status: "hired" } }),
      );
      expect(
        JSON.parse(
          await new BrainChainActionProvider().getTask(wallet, { order: ORDER, waitSeconds: 0 }),
        ),
      ).toMatchObject({
        done: false,
        retryAfterSeconds: 60,
      });
    });

    it("keeps waiting while a dispute, a ruling or an appeal can still change a rejected grade", async () => {
      for (const status of ["disputed", "ruled", "appealed"]) {
        fetchMock.mockResolvedValueOnce(
          Response.json({ order: ORDER, state: "posted", task: { status, accepted: false } }),
        );
        expect(
          JSON.parse(
            await new BrainChainActionProvider().getTask(wallet, { order: ORDER, waitSeconds: 0 }),
          ),
        ).toMatchObject({ done: false });
      }
    });

    it("waits for the order to finish before answering", async () => {
      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(
          Response.json({ order: ORDER, state: "posted", task: { status: "delivered" } }),
        )
        .mockResolvedValueOnce(Response.json({ order: ORDER, state: "refunded" }));
      const pending = new BrainChainActionProvider().getTask(wallet, {
        order: ORDER,
        waitSeconds: 30,
      });
      await jest.advanceTimersByTimeAsync(10_000);
      expect(JSON.parse(await pending)).toMatchObject({ state: "refunded", done: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it("asks to read again when the desk does not know the order yet", async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ error: "Not found." }, { status: 404 }));
      const view = JSON.parse(
        await new BrainChainActionProvider().getTask(wallet, { order: ORDER, waitSeconds: 0 }),
      );
      expect(view).toMatchObject({ done: false, retryAfterSeconds: 60 });
    });
  });
});
