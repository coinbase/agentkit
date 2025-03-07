import { AlloraActionProvider } from "./alloraActionProvider";
import { AlloraAPIClient, ChainSlug, PriceInferenceToken } from "@alloralabs/allora-sdk";

jest.mock("@alloralabs/allora-sdk");

describe("AlloraActionProvider", () => {
  let provider: AlloraActionProvider;
  const mockConfig = { apiKey: "test-api-key", chainSlug: ChainSlug.TESTNET };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AlloraActionProvider(mockConfig);
  });

  describe("getAllTopics", () => {
    it("should return topics when successful", async () => {
      const mockTopics = [
        {
          topic_id: 1,
          topic_name: "Bitcoin 8h",
          description: "Bitcoin price prediction",
          epoch_length: 100,
          ground_truth_lag: 10,
          loss_method: "method1",
          worker_submission_window: 50,
          worker_count: 5,
          reputer_count: 3,
          total_staked_allo: 1000,
          total_emissions_allo: 500,
          is_active: true,
          updated_at: "2023-01-01T00:00:00Z",
        },
      ];

      (AlloraAPIClient.prototype.getAllTopics as jest.Mock).mockResolvedValue(mockTopics);

      const result = await provider.getAllTopics({});
      expect(result).toContain("The available topics at Allora Network are:");
      expect(result).toContain(JSON.stringify(mockTopics));
    });

    it("should handle errors", async () => {
      const error = new Error("API Error");
      (AlloraAPIClient.prototype.getAllTopics as jest.Mock).mockRejectedValue(error);

      const result = await provider.getAllTopics({});
      expect(result).toContain("Error getting all topics:");
      expect(result).toContain(error.toString());
    });
  });

  describe("getInferenceByTopicId", () => {
    const mockTopicId = 1;

    it("should return inference when successful", async () => {
      const mockInferenceResponse = {
        inference_data: {
          network_inference: "0.5",
          network_inference_normalized: "0.5",
          confidence_interval_percentiles: ["0.1", "0.5", "0.9"],
          confidence_interval_percentiles_normalized: ["0.1", "0.5", "0.9"],
          confidence_interval_values: ["0.1", "0.5", "0.9"],
          confidence_interval_values_normalized: ["0.1", "0.5", "0.9"],
          topic_id: "1",
          timestamp: 1718198400,
          extra_data: "extra_data",
        },
      };

      (AlloraAPIClient.prototype.getInferenceByTopicID as jest.Mock).mockResolvedValue(
        mockInferenceResponse,
      );

      const result = await provider.getInferenceByTopicId({ topicId: mockTopicId });
      expect(result).toContain(`The inference for topic ${mockTopicId} is:`);
      expect(result).toContain(JSON.stringify(mockInferenceResponse.inference_data));
    });

    it("should handle errors", async () => {
      const error = new Error("API Error");
      (AlloraAPIClient.prototype.getInferenceByTopicID as jest.Mock).mockRejectedValue(error);

      const result = await provider.getInferenceByTopicId({ topicId: mockTopicId });
      expect(result).toContain(`Error getting inference for topic ${mockTopicId}:`);
      expect(result).toContain(error.toString());
    });
  });

  describe("getPriceInference", () => {
    const mockAsset = PriceInferenceToken.BTC;
    const mockTimeframe = "8h";

    it("should return price inference when successful", async () => {
      const mockPriceInference = {
        inference_data: {
          network_inference_normalized: "50000.00",
          timestamp: 1718198400,
        },
      };

      (AlloraAPIClient.prototype.getPriceInference as jest.Mock).mockResolvedValue(
        mockPriceInference,
      );

      const expectedResponse = {
        price: "50000.00",
        timestamp: 1718198400,
        asset: mockAsset,
        timeframe: mockTimeframe,
      };

      const result = await provider.getPriceInference({
        asset: mockAsset,
        timeframe: mockTimeframe,
      });
      expect(result).toContain(`The price inference for ${mockAsset} (${mockTimeframe}) is:`);
      expect(result).toContain(JSON.stringify(expectedResponse));
    });

    it("should handle errors", async () => {
      const error = new Error("API Error");
      (AlloraAPIClient.prototype.getPriceInference as jest.Mock).mockRejectedValue(error);

      const result = await provider.getPriceInference({
        asset: mockAsset,
        timeframe: mockTimeframe,
      });
      expect(result).toContain(
        `Error getting price inference for ${mockAsset} (${mockTimeframe}):`,
      );
      expect(result).toContain(error.toString());
    });
  });
});
