import { getAmountWithSlippage, ethToMemecoin } from "./swap_utils";
import { zeroAddress } from "viem";

describe("getAmountWithSlippage", () => {
  it("throws when quote amount is missing", () => {
    expect(() => getAmountWithSlippage(undefined, "0.01", "EXACT_IN")).toThrow(
      /missing or zero/,
    );
  });

  it("throws when quote amount is zero", () => {
    expect(() => getAmountWithSlippage(0n, "0.01", "EXACT_IN")).toThrow(/missing or zero/);
  });

  it("applies slippage for a positive quote", () => {
    const out = getAmountWithSlippage(100n, "0", "EXACT_IN");
    expect(out).toBe(100n);
  });
});

describe("ethToMemecoin", () => {
  it("rejects zero amountOutMin for EXACT_IN", () => {
    expect(() =>
      ethToMemecoin({
        sender: zeroAddress,
        memecoin: "0x1234567890123456789012345678901234567890",
        chainId: 8453,
        referrer: null,
        swapType: "EXACT_IN",
        amountIn: 1n,
        amountOutMin: 0n,
      }),
    ).toThrow(/non-zero amountOutMin/);
  });
});
