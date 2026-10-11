import type { BursarToolset } from "@bursar/toolset";
import { bursarActionProvider } from "./bursarActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

jest.mock("../../analytics", () => ({ sendAnalyticsEvent: jest.fn() }));

const MANDATE = "0x8605853aC6A64dA11F4ED0Ff0Ad128961Cc3cd5c";
const PROVIDER = "0x5210D8df060A9D5ce4c1305045ED5c9548fca374";

describe("BursarActionProvider", () => {
  const toolset = {
    inspect: jest.fn(async () => "inspected"),
    quote: jest.fn(async () => "quoted"),
    pay: jest.fn(async () => "paid"),
    settlements: jest.fn(async () => "listed"),
  } as unknown as BursarToolset;
  const wallet = {
    getAddress: () => "0x877c349EFb5926082C413833E8055F0991185c61",
    getName: () => "evm_wallet_provider",
    getNetwork: () => ({ protocolFamily: "evm", networkId: "robinhood-chain", chainId: "4663" }),
  } as unknown as EvmWalletProvider;
  const provider = bursarActionProvider({ mandate: MANDATE, toolset });

  beforeEach(() => jest.clearAllMocks());

  it("supports Robinhood Chain only", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "4663" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(false);
    expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
  });

  it("exposes inspect, quote, pay and settlements", () => {
    const names = provider.getActions(wallet).map(action => action.name);
    expect(names).toEqual([
      "BursarActionProvider_inspect",
      "BursarActionProvider_quote",
      "BursarActionProvider_pay",
      "BursarActionProvider_settlements",
    ]);
  });

  it("passes the arguments to the toolset and returns its answer", async () => {
    const actions = provider.getActions(wallet);
    const pay = actions.find(action => action.name === "BursarActionProvider_pay")!;
    const args = {
      provider: PROVIDER,
      capability: "gpu.render:1",
      amount: "250000",
      input: "render a koi",
    };
    expect(await pay.invoke(args)).toBe("paid");
    expect(toolset.pay).toHaveBeenCalledWith(args);
    const inspect = actions.find(action => action.name === "BursarActionProvider_inspect")!;
    expect(await inspect.invoke({})).toBe("inspected");
  });

  it("refuses an amount with a decimal point in the schema", () => {
    const pay = provider
      .getActions(wallet)
      .find(action => action.name === "BursarActionProvider_pay")!;
    expect(
      pay.schema.safeParse({ provider: PROVIDER, capability: "gpu.render:1", amount: "0.25" })
        .success,
    ).toBe(false);
  });
});
