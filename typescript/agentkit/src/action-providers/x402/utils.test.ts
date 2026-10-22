import { filterByDescription, filterByKeyword } from "./utils";
import { DiscoveryResource } from "./constants";

/**
 * The CDP discovery API returns v2 resources with the description at the TOP LEVEL
 * (`resource.description`), not under `metadata`. These tests pin both shapes so
 * discovery keeps working whichever one a facilitator returns.
 */
describe("x402 discovery utilities", () => {
  const v2TopLevel: DiscoveryResource = {
    resource: "https://example.com/v2-top-level",
    x402Version: 2,
    description: "Executable swap quote at size, including price impact and slippage",
  };

  const v2Metadata: DiscoveryResource = {
    resource: "https://example.com/v2-metadata",
    x402Version: 2,
    metadata: { description: "Token metadata lookup for ERC-20 contracts" },
  };

  const v2NoDescription: DiscoveryResource = {
    resource: "https://example.com/v2-none",
    x402Version: 2,
  };

  const v2Default: DiscoveryResource = {
    resource: "https://example.com/v2-default",
    x402Version: 2,
    description: "Access to protected content",
  };

  const v1: DiscoveryResource = {
    resource: "https://example.com/v1",
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        asset: "0x0000000000000000000000000000000000000001",
        description: "Weather forecast for a given city",
      },
    ],
  };

  describe("filterByDescription", () => {
    it("keeps v2 resources that carry the description at the top level", () => {
      expect(filterByDescription([v2TopLevel])).toEqual([v2TopLevel]);
    });

    it("keeps v2 resources that carry the description under metadata", () => {
      expect(filterByDescription([v2Metadata])).toEqual([v2Metadata]);
    });

    it("prefers the top-level description when both are present", () => {
      const both: DiscoveryResource = {
        ...v2TopLevel,
        metadata: { description: "metadata description" },
      };
      expect(filterByKeyword([both], "price impact")).toEqual([both]);
    });

    it("drops v2 resources with no description in either place", () => {
      expect(filterByDescription([v2NoDescription])).toEqual([]);
    });

    it("drops the default placeholder description", () => {
      expect(filterByDescription([v2Default])).toEqual([]);
    });

    it("still keeps v1 resources with a description in accepts[]", () => {
      expect(filterByDescription([v1])).toEqual([v1]);
    });
  });

  describe("filterByKeyword", () => {
    it("matches keywords in a top-level v2 description", () => {
      expect(filterByKeyword([v2TopLevel, v2Metadata], "slippage")).toEqual([v2TopLevel]);
    });

    it("matches keywords in a metadata v2 description", () => {
      expect(filterByKeyword([v2TopLevel, v2Metadata], "erc-20")).toEqual([v2Metadata]);
    });
  });
});
