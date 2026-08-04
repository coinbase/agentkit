import { PERMIT2_ADDRESS, assertPermit2Eip712MatchesSwap } from "./utils";

const sellToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const sellAmount = "1000000";

function baseEip712(overrides: Record<string, unknown> = {}) {
  return {
    domain: {
      name: "Permit2",
      chainId: 8453,
      verifyingContract: PERMIT2_ADDRESS,
    },
    primaryType: "PermitWitnessTransferFrom",
    message: {
      permitted: {
        token: sellToken,
        amount: sellAmount,
      },
    },
    ...overrides,
  };
}

describe("assertPermit2Eip712MatchesSwap", () => {
  it("accepts a matching Permit2 payload", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712(),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).not.toThrow();
  });

  it("rejects wrong verifyingContract", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({
          domain: {
            name: "Permit2",
            chainId: 8453,
            verifyingContract: "0x0000000000000000000000000000000000000001",
          },
        }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/verifyingContract mismatch/);
  });

  it("rejects token mismatch", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({
          message: {
            permitted: {
              token: "0x0000000000000000000000000000000000000001",
              amount: sellAmount,
            },
          },
        }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/token mismatch/);
  });

  it("rejects amount below local sell amount", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({
          message: {
            permitted: {
              token: sellToken,
              amount: "1",
            },
          },
        }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/amount too low/);
  });
});
