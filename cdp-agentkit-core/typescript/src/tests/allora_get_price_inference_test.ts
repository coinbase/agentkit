import {
  AlloraAPIClient,
  PriceInferenceTimeframe,
  PriceInferenceToken,
  AlloraInference,
} from "@alloralabs/allora-sdk";
import {
  getPriceInference,
  GetPriceInferenceInput,
} from "../actions/cdp/allora/get_price_inference";

describe("Get Price Inference Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      asset: "BTC",
      timeframe: "5m",
    };

    const result = GetPriceInferenceInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = GetPriceInferenceInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Get Price Inference Action", () => {
  let mockAlloraClient: jest.Mocked<AlloraAPIClient>;

  beforeEach(() => {
    mockAlloraClient = {
      getPriceInference: jest.fn(),
    } as unknown as jest.Mocked<AlloraAPIClient>;
  });

  it("should successfully get price inference", async () => {
    const args = {
      asset: "BTC",
      timeframe: "5m",
    };
    const mockInference = {
      signature: "mockSignature",
      inference_data: { network_inference_normalized: "45000.00" },
    };

    mockAlloraClient.getPriceInference.mockResolvedValue(mockInference as AlloraInference);

    const response = await getPriceInference(mockAlloraClient, args);

    expect(mockAlloraClient.getPriceInference).toHaveBeenCalledWith(
      args.asset as PriceInferenceToken,
      args.timeframe as PriceInferenceTimeframe,
    );
    expect(response).toBe(
      `The future price inference for BTC in 5m is ${mockInference.inference_data.network_inference_normalized}`,
    );
  });

  it("should handle errors gracefully", async () => {
    const args = {
      asset: "BTC",
      timeframe: "5m",
    };

    const error = new Error("Failed to fetch price inference");
    mockAlloraClient.getPriceInference.mockRejectedValue(error);

    const response = await getPriceInference(mockAlloraClient, args);

    expect(mockAlloraClient.getPriceInference).toHaveBeenCalled();
    expect(response).toBe(`Error getting price inference: ${error}`);
  });
});
