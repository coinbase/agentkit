import { PERMIT2_ADDRESS, assertPermit2Eip712MatchesSwap } from "./utils";

const sellToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const sellAmount = "1000000";
const spender = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const futureDeadline = "4102444800"; // 2100-01-01

function baseEip712(overrides: Record<string, unknown> = {}) {
  const base = {
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
      spender,
      deadline: futureDeadline,
    },
  };
  const { domain: domainOverride, message: messageOverride, ...rest } = overrides as {
    domain?: Record<string, unknown>;
    message?: Record<string, unknown>;
  };
  return {
    ...base,
    ...rest,
    domain: { ...base.domain, ...(domainOverride ?? {}) },
    message: { ...base.message, ...(messageOverride ?? {}) },
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
        expectedSpender: spender,
        nowSeconds: 1_700_000_000,
      }),
    ).not.toThrow();
  });

  it("rejects wrong verifyingContract", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({
          domain: {
            verifyingContract: "0x0000000000000000000000000000000000000001",
          },
        }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/verifyingContract mismatch/);
  });

  it("rejects missing chainId", () => {
    const eip712 = baseEip712();
    delete (eip712.domain as { chainId?: number }).chainId;
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712,
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/chainId missing/);
  });

  it("rejects chainId mismatch", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({ domain: { chainId: 1 } }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/chainId mismatch/);
  });

  it("rejects domain.name mismatch", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({ domain: { name: "NotPermit2" } }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/domain\.name mismatch/);
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
    ).toThrow(/amount mismatch/);
  });

  it("rejects amount above local sell amount", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({
          message: {
            permitted: {
              token: sellToken,
              amount: "999999999999",
            },
          },
        }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
      }),
    ).toThrow(/amount mismatch/);
  });

  it("rejects spender mismatch when expectedSpender is set", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712(),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
        expectedSpender: "0x0000000000000000000000000000000000000001",
      }),
    ).toThrow(/spender mismatch/);
  });

  it("rejects expired deadline", () => {
    expect(() =>
      assertPermit2Eip712MatchesSwap({
        eip712: baseEip712({
          message: { deadline: "100" },
        }),
        chainId: 8453,
        sellToken,
        sellAmountBaseUnits: sellAmount,
        nowSeconds: 1_700_000_000,
      }),
    ).toThrow(/deadline expired/);
  });
});
