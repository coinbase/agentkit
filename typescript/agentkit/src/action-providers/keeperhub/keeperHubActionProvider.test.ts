import { keeperHubActionProvider } from "./index";

/**
 * Every test here fakes `fetch` rather than injecting a fake client, so the
 * real client code is exercised too: headers, body shape, and response parsing.
 */

type Reply = { status?: number; body: unknown };
let queue: Reply[] = [];
let sent: Array<{
  url: string;
  method: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}> = [];

const realFetch = globalThis.fetch;

beforeEach(() => {
  queue = [];
  sent = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({
      url: String(input),
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const next = queue.shift() ?? { body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

const walletOn = (chainId: string) =>
  ({ getNetwork: () => ({ protocolFamily: "evm", chainId, networkId: "base-sepolia" }) }) as never;

const kh = () => keeperHubActionProvider({ apiKey: "kh_test" });

const args = {
  recipientAddress: "0x33b1499a92793B3e634f2D8B9e83A7185f4eC44D",
  amount: "1.5",
  tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  taskId: "invoice-1",
};

const OK_SIM = { body: { success: true, wouldRevert: false, gasEstimate: "45415" } };

describe("transfer: gate before the network", () => {
  it("refuses chains KeeperHub does not support without calling the API", async () => {
    // KeeperHub answers 503 for unsupported chains, which looks like a transient
    // outage and invites endless retries. Refused here instead.
    const out = await kh().transfer(walletOn("100"), args as never);
    expect(out).toMatch(/does not support chainId 100/);
    expect(sent).toHaveLength(0);
  });
});

describe("transfer: simulation gate", () => {
  it("aborts when simulation predicts a revert, and does not execute", async () => {
    queue.push({
      status: 400,
      body: {
        success: false,
        wouldRevert: true,
        failureKind: "revert",
        revertReason: "Error(ERC20: transfer amount exceeds balance)",
      },
    });
    const out = await kh().transfer(walletOn("84532"), args as never);
    expect(out).toMatch(/Aborted before broadcast/);
    expect(out).toMatch(/Simulation predicts a revert/);
    expect(out).toMatch(/no gas was spent/);
    expect(sent).toHaveLength(1); // simulation only, no execution
  });

  it("tells validation failures apart from revert predictions", async () => {
    // The consequences differ: bad input must not be retried as-is, while a
    // chain-state problem may be retried later.
    queue.push({
      status: 400,
      body: {
        success: false,
        wouldRevert: true,
        failureKind: "validation",
        revertReason: "bad address checksum",
      },
    });
    const out = await kh().transfer(walletOn("84532"), args as never);
    expect(out).toMatch(/Input rejected/);
    expect(out).not.toMatch(/Simulation predicts a revert/);
  });

  it("always sends simulate:true, and the value never comes from input", async () => {
    // Defence against the class KeeperHub tracks in #2004: a misspelled body key
    // is accepted silently and the transaction is broadcast for real.
    queue.push(OK_SIM, { status: 202, body: { executionId: "e1", status: "completed" } });
    await kh().transfer(walletOn("84532"), args as never);
    expect(sent[0].body.simulate).toBe(true);
    expect(sent[1].body.simulate).toBeUndefined();
  });
});

describe("transfer: execution", () => {
  it("sends a derived Idempotency-Key, not a random one", async () => {
    queue.push(OK_SIM, { status: 202, body: { executionId: "e1", status: "completed" } });
    await kh().transfer(walletOn("84532"), args as never);
    const key1 = sent[1].headers["Idempotency-Key"];

    queue.push(OK_SIM, { status: 202, body: { executionId: "e1", status: "completed" } });
    await kh().transfer(walletOn("84532"), args as never);
    const key2 = sent[3].headers["Idempotency-Key"];

    expect(key1).toBeDefined();
    expect(key1).toBe(key2); // same work -> same key -> replayed
  });

  it("returns the executionId and says to ask about it instead of resending", async () => {
    queue.push(OK_SIM, {
      status: 202,
      body: { executionId: "ks9u", status: "completed", transactionHash: "0xabc" },
    });
    const out = await kh().transfer(walletOn("84532"), args as never);
    expect(out).toMatch(/executionId: ks9u/);
    expect(out).toMatch(/get_execution_status/);
  });

  it("explains an idempotency conflict as a taskId misuse", async () => {
    queue.push(OK_SIM, {
      status: 409,
      body: { code: "idempotency_conflict", originalExecutionId: "e0" },
    });
    const out = await kh().transfer(walletOn("84532"), args as never);
    expect(out).toMatch(/already used for work with different details/);
  });

  it("never asks for or forwards raw calldata", async () => {
    queue.push(OK_SIM, { status: 202, body: { executionId: "e1" } });
    await kh().transfer(walletOn("84532"), args as never);
    for (const req of sent) {
      expect(req.body).not.toHaveProperty("data");
      expect(req.body).not.toHaveProperty("calldata");
      expect(req.body).not.toHaveProperty("abi");
    }
  });
});

describe("get_execution_status: tells THREE states apart", () => {
  it("SUCCEEDED when a verified receipt has status success", async () => {
    queue.push({
      body: {
        executionId: "e1",
        status: "completed",
        receipts: [
          {
            hash: "0xabc",
            chainId: 84532,
            verified: true,
            receiptStatus: "success",
            blockNumber: 123,
            gasUsed: "67338",
          },
        ],
      },
    });
    const out = await kh().getExecutionStatus(walletOn("84532"), { executionId: "e1" } as never);
    expect(out).toMatch(/transaction SUCCEEDED/);
    expect(out).toMatch(/Do not resend/);
  });

  it("REVERTED when a verified receipt is not success", async () => {
    queue.push({
      body: {
        executionId: "e1",
        status: "completed",
        receipts: [{ hash: "0xabc", chainId: 84532, verified: true, receiptStatus: "reverted" }],
      },
    });
    const out = await kh().getExecutionStatus(walletOn("84532"), { executionId: "e1" } as never);
    expect(out).toMatch(/REVERTED/);
    expect(out).toMatch(/No funds moved/);
  });

  it("NOT YET KNOWN when no receipt is verified, and forbids resending", async () => {
    // This is the whole argument: "not yet known" is not "failed". Treating them
    // as the same is the most common way an agent pays twice.
    queue.push({ body: { executionId: "e1", status: "pending", receipts: [] } });
    const out = await kh().getExecutionStatus(walletOn("84532"), { executionId: "e1" } as never);
    expect(out).toMatch(/NOT YET KNOWN, which is not the same as failed/);
    expect(out).toMatch(/Do not resend/);
  });

  it("ignores receipts that are not verified", async () => {
    // `transactionHash` is self-reported by the write path; only receipts
    // re-read from chain count as evidence.
    queue.push({
      body: {
        executionId: "e1",
        status: "completed",
        receipts: [{ hash: "0xabc", chainId: 84532, verified: false, receiptStatus: "success" }],
      },
    });
    const out = await kh().getExecutionStatus(walletOn("84532"), { executionId: "e1" } as never);
    expect(out).toMatch(/NOT YET KNOWN/);
  });
});

describe("supportsNetwork", () => {
  it("accepts supported EVM chains and rejects the rest", () => {
    const p = kh();
    expect(p.supportsNetwork({ protocolFamily: "evm", chainId: "84532" } as never)).toBe(true);
    expect(p.supportsNetwork({ protocolFamily: "evm", chainId: "100" } as never)).toBe(false);
    expect(p.supportsNetwork({ protocolFamily: "svm", chainId: "101" } as never)).toBe(false);
  });
});
