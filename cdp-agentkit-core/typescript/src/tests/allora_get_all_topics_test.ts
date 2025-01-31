import { AlloraAPIClient } from "@alloralabs/allora-sdk";
import { GetAllTopicsAction, getAllTopics } from "../actions/cdp/allora/get_all_topics";

describe("GetAllTopicsAction", () => {
  const mockTopics = [
    {
      topic_id: 1,
      topic_name: "Bitcoin 8h",
      description: "Bitcoin price prediction for the next 8 hours",
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

  it("should have correct action properties", () => {
    const action = new GetAllTopicsAction();
    expect(action.name).toBe("get_all_topics");
    expect(action.description).toContain(
      "This tool will get all available topics from Allora Network",
    );
    expect(action.argsSchema).toBeDefined();
  });

  describe("getAllTopics", () => {
    it("should return topics successfully", async () => {
      const mockClient = {
        getAllTopics: jest.fn().mockResolvedValue(mockTopics),
      } as unknown as jest.Mocked<AlloraAPIClient>;

      const result = await getAllTopics(mockClient, {});

      expect(mockClient.getAllTopics).toHaveBeenCalledTimes(1);
      expect(result).toContain("The available topics at Allora Network are:");
      expect(result).toContain(JSON.stringify(mockTopics));
    });

    it("should handle errors gracefully", async () => {
      const mockError = new Error("API Error");
      const mockClient = {
        getAllTopics: jest.fn().mockRejectedValue(mockError),
      } as unknown as jest.Mocked<AlloraAPIClient>;

      const result = await getAllTopics(mockClient, {});

      expect(mockClient.getAllTopics).toHaveBeenCalledTimes(1);
      expect(result).toContain("Error getting all topics:");
      expect(result).toContain(mockError.toString());
    });
  });
});
