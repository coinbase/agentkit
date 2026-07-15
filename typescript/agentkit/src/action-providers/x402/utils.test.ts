import { NEAR_TESTNET_NETWORK } from "../../network/near";
import { NearWalletProvider } from "../../wallet-providers";
import { NEAR_USDC_ADDRESSES } from "./constants";
import {
  convertWholeUnitsToAtomic,
  formatPaymentOption,
  getX402Networks,
  isUsdcAsset,
} from "./utils";

describe("x402 NEAR utilities", () => {
  const wallet = Object.assign(Object.create(NearWalletProvider.prototype), {
    getNetwork: jest.fn().mockReturnValue(NEAR_TESTNET_NETWORK),
  }) as NearWalletProvider;
  const usdc = NEAR_USDC_ADDRESSES["near-testnet"];

  it("maps AgentKit's testnet ID to the x402 CAIP-2 network", () => {
    expect(getX402Networks(NEAR_TESTNET_NETWORK)).toEqual(["near:testnet"]);
  });

  it("recognizes Circle USDC on NEAR", () => {
    expect(isUsdcAsset(usdc, wallet)).toBe(true);
    expect(isUsdcAsset("other-token.testnet", wallet)).toBe(false);
  });

  it("formats and converts six-decimal USDC amounts", async () => {
    await expect(
      formatPaymentOption(
        { asset: usdc, maxAmountRequired: "1250000", network: "near:testnet" },
        wallet,
      ),
    ).resolves.toBe("1.25 USDC on near-testnet");
    await expect(convertWholeUnitsToAtomic(1.25, usdc, wallet)).resolves.toBe("1250000");
  });
});
