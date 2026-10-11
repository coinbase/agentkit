import { cleanAddress, cleanText, describeLevel, formatUsdcBaseUnits, roundUsd } from "./utils";

describe("Agentic Finance Graph utils", () => {
  describe("formatUsdcBaseUnits", () => {
    it.each([
      ["0", "0"],
      ["1", "0.000001"],
      ["1500000", "1.5"],
      ["303000000", "303"],
      ["20650200000", "20650.2"],
      ["123456789012345678901234567890", "123456789012345678901234.56789"],
    ])("converts %p base units to %p USD", (input, expected) => {
      expect(formatUsdcBaseUnits(input)).toBe(expected);
    });

    it.each([undefined, null, "", "-5", "1.5", "1e6", 1500000])("returns null for %p", input => {
      expect(formatUsdcBaseUnits(input)).toBeNull();
    });
  });

  describe("cleanAddress", () => {
    it("accepts a plain address and the address part of a CAIP-10 account id", () => {
      const address = "0x024beeed33d76cce272c0db022134cda921f4aa6";
      expect(cleanAddress(address)).toBe(address);
      expect(cleanAddress(`eip155:8453:${address}`)).toBe(address);
    });

    it.each([null, "", "0x123", "not an address", 42])("returns null for %p", input => {
      expect(cleanAddress(input)).toBeNull();
    });
  });

  describe("cleanText", () => {
    it("removes non-printable characters and caps the length", () => {
      expect(cleanText("a‮b​c\u0000d")).toBe("abcd");
      expect(cleanText("x".repeat(500), 10)).toBe("x".repeat(10));
    });

    it("returns null for non-strings and empty results", () => {
      expect(cleanText(42)).toBeNull();
      expect(cleanText("​")).toBeNull();
    });
  });

  it("rounds USD to cents and rejects non-numbers", () => {
    expect(roundUsd(78564.897832)).toBe(78564.9);
    expect(roundUsd("12")).toBeNull();
    expect(roundUsd(Number.NaN)).toBeNull();
  });

  it("describes the public liveness levels", () => {
    expect(describeLevel(7)).toContain("observed paying a different address");
    expect(describeLevel(3)).toBe("Below the public rank, which starts at L7.");
  });
});
