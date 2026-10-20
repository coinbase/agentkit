import { filterByDescription } from "./utils";
import { DiscoveryResource } from "./constants";

describe("x402 Utilities", () => {
  describe("filterByDescription", () => {
    it("keeps a v2 resource with a top-level description", () => {
      const resources: DiscoveryResource[] = [
        {
          resource: "https://example.com/feed",
          x402Version: 2,
          description: "Live agent-index data",
        },
      ];

      expect(filterByDescription(resources)).toEqual(resources);
    });

    it("keeps a v2 resource that only has metadata.description", () => {
      const resources: DiscoveryResource[] = [
        {
          resource: "https://example.com/feed",
          x402Version: 2,
          metadata: { description: "Legacy metadata-only description" },
        },
      ];

      expect(filterByDescription(resources)).toEqual(resources);
    });

    it("prefers the top-level description over metadata.description when both are present", () => {
      const resources: DiscoveryResource[] = [
        {
          resource: "https://example.com/feed",
          x402Version: 2,
          description: "Top-level wins",
          metadata: { description: "Should be ignored" },
        },
      ];

      const result = filterByDescription(resources);
      expect(result).toHaveLength(1);
    });

    it("drops a v2 resource with no description anywhere", () => {
      const resources: DiscoveryResource[] = [
        {
          resource: "https://example.com/feed",
          x402Version: 2,
        },
      ];

      expect(filterByDescription(resources)).toEqual([]);
    });

    it("leaves the v1 accepts[].description path unchanged", () => {
      const resources: DiscoveryResource[] = [
        {
          resource: "https://example.com/v1-feed",
          x402Version: 1,
          accepts: [
            {
              scheme: "exact",
              network: "base",
              asset: "0xusdc",
              maxAmountRequired: "1000",
              description: "v1 accepts description",
            },
          ],
        },
      ];

      expect(filterByDescription(resources)).toEqual(resources);
    });

    it("drops resources whose description is the discovery API's default placeholder", () => {
      const resources: DiscoveryResource[] = [
        {
          resource: "https://example.com/placeholder",
          x402Version: 2,
          description: "Access to protected content",
        },
      ];

      expect(filterByDescription(resources)).toEqual([]);
    });
  });
});
