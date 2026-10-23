import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { youraitoolsActionProvider, parsePaymentRequired } from "./youraitoolsActionProvider";
import { TOOLS, NFA, SAFETY } from "./constants";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");
jest.mock("@x402/svm/exact/client");
jest.mock("../../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
}));

const PAY_TO = "0x3c1A1E01e790Cd326495631B3b38Bd7068F08d6F";

/**
 * Build a v2 PAYMENT-REQUIRED header value.
 *
 * @param amount - Atomic USDC amount (6 decimals)
 * @returns Base64 JSON document
 */
function terms(amount: string): string {
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      resource: { url: "https://api.youraitools.co/x" },
      accepts: [{ scheme: "exact", network: "eip155:8453", amount, payTo: PAY_TO }],
    }),
  ).toString("base64");
}

// Plain object, not an EvmWalletProvider or SvmWalletProvider instance.
// getName/getAddress/getNetwork satisfy the action decorator's analytics call.
const mockWallet = {
  getName: () => "mock",
  getAddress: () => "0x0000000000000000000000000000000000000000",
  getNetwork: () => ({
    protocolFamily: "evm",
    networkId: "base-mainnet",
    chainId: "8453",
  }),
} as unknown as WalletProvider;

describe("YourAIToolsActionProvider", () => {
  it("exposes six actions with spend-safe copy", () => {
    const actions = youraitoolsActionProvider().getActions(mockWallet);
    expect(actions.map(action => action.name.split("_").slice(1).join("_")).sort()).toEqual(
      TOOLS.map(tool => tool.name).sort(),
    );
    expect(TOOLS.find(tool => tool.name === "smartperps_smart_money")!.description).toContain(NFA);
    expect(TOOLS.find(tool => tool.name === "payguard_screen_address")!.description).toContain(
      SAFETY,
    );
    TOOLS.forEach(tool => expect(tool.description.length).toBeLessThanOrEqual(500));
  });

  it("returns the 402 terms when payWithWallet is off (never pays)", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response("{}", {
        status: 402,
        headers: { "PAYMENT-REQUIRED": terms("1000") },
      }),
    );
    const provider = youraitoolsActionProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const out = JSON.parse(
      await provider.screenAddress(mockWallet, {
        address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      }),
    );
    expect(out.payment_required).toBe(true);
    expect(out.options[0]).toMatchObject({
      network: "eip155:8453",
      price_usd: 0.001,
      pay_to: PAY_TO,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.youraitools.co/payguard/v1/address?address=0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      expect.anything(),
    );
  });

  it("refuses actions above maxPriceUsd before any request", async () => {
    const fetchImpl = jest.fn();
    const provider = youraitoolsActionProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxPriceUsd: 0.002,
      payWithWallet: true,
    });
    expect(
      JSON.parse(
        await provider.checkToken(mockWallet, {
          token: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
        }),
      ).error,
    ).toBe("over_budget");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a prepaid credits key as Bearer and passes 200 results through", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ verdict: "clean" }), { status: 200 }));
    const provider = youraitoolsActionProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      creditsKey: "yatc_test",
    });
    expect(JSON.parse(await provider.scanText(mockWallet, { text: "hello" })).result).toEqual({
      verdict: "clean",
    });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer yatc_test");
  });

  it("reports unsupported wallets instead of throwing when payWithWallet is on", async () => {
    const provider = youraitoolsActionProvider({
      fetchImpl: jest.fn() as unknown as typeof fetch,
      payWithWallet: true,
    });
    expect(
      JSON.parse(await provider.readUrl(mockWallet, { url: "https://example.com/" })).error,
    ).toBe("unsupported_wallet");
  });

  it("pays with an EVM wallet through the x402 client when payWithWallet is on", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ sanctioned: false }), { status: 200 }));
    jest.mocked(wrapFetchWithPayment).mockReturnValue(fetchImpl as unknown as typeof fetch);

    const wallet = Object.create(EvmWalletProvider.prototype) as EvmWalletProvider;
    wallet.toSigner = jest.fn().mockReturnValue({
      address: "0x0000000000000000000000000000000000000001",
      type: "local",
    });
    wallet.readContract = jest.fn().mockResolvedValue(0n);
    wallet.getName = jest.fn().mockReturnValue("evm_wallet_provider");
    wallet.getAddress = jest.fn().mockReturnValue("0x0000000000000000000000000000000000000001");
    wallet.getNetwork = jest.fn().mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    });

    const provider = youraitoolsActionProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      payWithWallet: true,
    });
    const out = JSON.parse(
      await provider.screenAddress(wallet, {
        address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
      }),
    );

    expect(out.result).toEqual({ sanctioned: false });
    expect(wrapFetchWithPayment).toHaveBeenCalledWith(fetchImpl, expect.anything());
    expect(registerExactEvmScheme).toHaveBeenCalledTimes(1);
    const signer = jest.mocked(registerExactEvmScheme).mock.calls[0][1].signer;
    await signer.readContract?.({
      address: "0x0000000000000000000000000000000000000001",
      abi: [],
      functionName: "balanceOf",
    });
    expect(wallet.readContract).toHaveBeenCalled();
  });

  it("parses v1 bodies too", () => {
    const out = parsePaymentRequired(new Headers(), {
      x402Version: 1,
      accepts: [
        {
          network: "base",
          maxAmountRequired: "3000",
          payTo: PAY_TO,
          resource: "https://api.youraitools.co/toolpick/v1/lite",
        },
      ],
    });
    expect(out.options[0].price_usd).toBe(0.003);
    expect(out.resource).toBe("https://api.youraitools.co/toolpick/v1/lite");
  });
});
