import { taxrailActionProvider } from "./taxrailActionProvider";

describe("TaxRailActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = taxrailActionProvider({
    referrerWallet: "0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1",
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should return pre-trade tax impact preview with referrer header", async () => {
    const mockResponse = {
      planId: "plan_agentkit_1",
      taxSavedUsd: 420.5,
      baselineTaxUsd: 550.5,
      optimizedTaxUsd: 130.0,
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await provider.checkTaxImpact({
      jurisdiction: "US",
      chain: "base",
      targetAsset: "ETH",
      sellQuantity: 1,
      walletAddress: "0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1",
    });

    expect(JSON.parse(result)).toEqual(mockResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.taxrail.online/api/v1/check-tax-impact",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-TaxRail-Referrer": "0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1",
        }),
      })
    );
  });

  it("should compare borrow vs sell via TaxRail API", async () => {
    const mockBorrow = {
      planId: "plan_borrow_1",
      recommendation: "BORROW_AAVE_V3",
      taxSavedUsd: 680,
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockBorrow),
    });

    const result = await provider.compareBorrowVsSell({
      jurisdiction: "US",
      chain: "base",
      collateralAsset: "ETH",
      collateralAmount: 2,
      collateralPriceUsd: 3000,
      collateralCostBasisUsd: 500,
      liquidityNeededUsd: 2000,
      holdingDays: 180,
    });

    expect(JSON.parse(result)).toEqual(mockBorrow);
  });

  it("should return structured 402 x402 challenge on checkBr35kStatus without signature", async () => {
    const challenge = { x402Version: 2, accepts: [{ amount: "5000", network: "eip155:8453" }] };
    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      json: jest.fn().mockResolvedValue(challenge),
    });

    const result = await provider.checkBr35kStatus({
      monthlySalesBrl: 20000,
      plannedSaleUsd: 2500,
      custodyLocation: "DOMESTIC",
      paymentSignature: null,
    });

    expect(JSON.parse(result)).toEqual({ status: 402, paymentRequired: challenge });
  });

  it("should support all networks", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true
    );
  });
});
