import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { SpendPreflightActionProvider } from "./spendpreflightActionProvider";
import { CheckPayeeSchema } from "./schemas";

type FeeHook = Parameters<x402Client["onBeforePaymentCreation"]>[0];
const mockFeeHooks: FeeHook[] = [];

jest.mock("../../analytics", () => ({ sendAnalyticsEvent: jest.fn() }));
jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockReturnThis(),
    onBeforePaymentCreation: jest.fn().mockImplementation(hook => mockFeeHooks.push(hook)),
  })),
  wrapFetchWithPayment: jest.fn().mockImplementation(transport => transport),
}));

const mockSigner = jest.fn().mockReturnValue({
  address: "0x1111111111111111111111111111111111111111",
});
const wallet = {
  getName: () => "test-wallet",
  getAddress: () => "0x1111111111111111111111111111111111111111",
  getNetwork: () => ({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
  toSigner: mockSigner,
  readContract: jest.fn(),
} as unknown as EvmWalletProvider;
const challenge = {
  x402Version: 2,
  resource: { url: "https://merchant.example/data" },
  accepts: [{ scheme: "exact", network: "eip155:8453", amount: "10000" }],
};
const preflightInput = {
  challenge,
  resource_url: "https://merchant.example/data",
  rules: { max_per_payment_usd: 1 },
};
const fee = {
  scheme: "exact",
  network: "eip155:8453",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0xBf4164e07552e4c1b1B1597E72C7acAA3F0a1c58",
  amount: "10000",
  maxTimeoutSeconds: 60,
};

describe("SpendPreflightActionProvider", () => {
  let transport: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeeHooks.length = 0;
    transport = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => transport.mockRestore());

  it("registers exactly two disclosed screening actions", () => {
    const actions = new SpendPreflightActionProvider().getActions(wallet);
    expect(actions.map(action => action.name)).toEqual([
      "SpendPreflightActionProvider_check_payee",
      "SpendPreflightActionProvider_preflight_payment",
    ]);
    for (const action of actions)
      expect(action.description).toContain("Operated by SpendPreflight");
  });

  it("screens encoded identifiers only at the fixed API origin", async () => {
    transport.mockResolvedValue(Response.json({ risk: "high", flags: ["possible_match"] }));
    const result = JSON.parse(
      await new SpendPreflightActionProvider().checkPayee(wallet, { name: "Acme & Sons" }),
    );
    expect(result).toMatchObject({ success: true, data: { risk: "high" } });
    const [rawUrl, options] = transport.mock.calls[0];
    const url = new URL(rawUrl);
    expect(url.origin).toBe("https://api.spendpreflight.com");
    expect(url.searchParams.get("name")).toBe("Acme & Sons");
    expect(options.redirect).toBe("error");
    expect(wrapFetchWithPayment).toHaveBeenCalledTimes(1);
  });

  it.each(["allow", "hold", "block"])(
    "preserves %s and receipt without calling the merchant",
    async decision => {
      transport.mockResolvedValue(
        Response.json({ decision, reasons: [decision], receipt: { id: "test-receipt" } }),
      );
      const result = JSON.parse(
        await new SpendPreflightActionProvider().preflightPayment(wallet, preflightInput),
      );
      expect(result).toMatchObject({
        success: true,
        data: { decision, receipt: { id: "test-receipt" } },
      });
      expect(transport).toHaveBeenCalledTimes(1);
      const [url, options] = transport.mock.calls[0];
      expect(url).toBe("https://api.spendpreflight.com/v1/preflight");
      expect(JSON.parse(options.body)).toEqual(preflightInput);
    },
  );

  it("accepts only the exact advertised screening fee", async () => {
    transport.mockResolvedValue(Response.json({ risk: "low" }));
    await new SpendPreflightActionProvider().checkPayee(wallet, { name: "Acme" });
    const context = { selectedRequirements: fee } as Parameters<FeeHook>[0];
    await expect(mockFeeHooks[0](context)).resolves.toBeUndefined();
    for (const changed of [
      { amount: "20000" },
      { payTo: "0x1111111111111111111111111111111111111111" },
      { asset: "0x1111111111111111111111111111111111111111" },
      { network: "eip155:1" },
      { scheme: "upto" },
    ]) {
      const rejected = { selectedRequirements: { ...fee, ...changed } } as Parameters<FeeHook>[0];
      await expect(mockFeeHooks[0](rejected)).resolves.toMatchObject({ abort: true });
    }
  });

  it("sets the preflight fee to exactly 20000 atomic USDC", async () => {
    transport.mockResolvedValue(
      Response.json({ decision: "allow", reasons: [], receipt: { id: "r" } }),
    );
    await new SpendPreflightActionProvider().preflightPayment(wallet, preflightInput);
    const context = { selectedRequirements: { ...fee, amount: "20000" } } as Parameters<FeeHook>[0];
    await expect(mockFeeHooks[0](context)).resolves.toBeUndefined();
  });

  it("uses trial without a signer or paid client, including exhausted quota", async () => {
    transport.mockResolvedValue(new Response("", { status: 402 }));
    const result = JSON.parse(
      await new SpendPreflightActionProvider({ trial: true }).checkPayee(wallet, { name: "Acme" }),
    );
    expect(result).toMatchObject({ success: false, decision: "hold" });
    expect(new URL(transport.mock.calls[0][0]).searchParams.get("trial")).toBe("1");
    expect(mockSigner).not.toHaveBeenCalled();
    expect(x402Client).not.toHaveBeenCalled();
    expect(wrapFetchWithPayment).not.toHaveBeenCalled();
  });

  it.each([400, 402, 503])(
    "holds on HTTP %s without returning screening approval",
    async status => {
      transport.mockResolvedValue(new Response("", { status }));
      const result = JSON.parse(
        await new SpendPreflightActionProvider({ trial: true }).preflightPayment(
          wallet,
          preflightInput,
        ),
      );
      expect(result).toMatchObject({ success: false, decision: "hold" });
    },
  );

  it("holds on malformed or incomplete screening results", async () => {
    transport.mockResolvedValue(Response.json({ decision: "allow" }));
    const result = JSON.parse(
      await new SpendPreflightActionProvider({ trial: true }).preflightPayment(
        wallet,
        preflightInput,
      ),
    );
    expect(result).toMatchObject({ success: false, decision: "hold" });
  });

  it("holds on network failure without exposing exception details", async () => {
    transport.mockRejectedValue(new Error("private transport details"));
    const result = await new SpendPreflightActionProvider({ trial: true }).checkPayee(wallet, {
      name: "Acme",
    });
    expect(JSON.parse(result)).toMatchObject({ success: false, decision: "hold" });
    expect(result).not.toContain("private transport details");
  });

  it("rejects unsupported wallet networks before a request", async () => {
    const wrongNetwork = {
      ...wallet,
      getNetwork: () => ({ protocolFamily: "evm", networkId: "base-sepolia" }),
    } as unknown as EvmWalletProvider;
    const result = JSON.parse(
      await new SpendPreflightActionProvider().checkPayee(wrongNetwork, { name: "Acme" }),
    );
    expect(result).toMatchObject({ success: false, decision: "hold" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects empty payee input", () => {
    expect(CheckPayeeSchema.safeParse({}).success).toBe(false);
  });
});
