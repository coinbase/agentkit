import { createApprovedPaymentSelector, createCappedPaymentSelector } from "./utils";

const BASE_APPROVED = {
  scheme: "exact",
  network: "eip155:84532",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  maxAmountRequired: "10000", // 0.01 USDC
  amount: null,
  price: null,
  payTo: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
};

const BASE_REQ = {
  scheme: "exact",
  network: "eip155:84532",
  asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e", // lowercase on purpose
  amount: "10000",
  payTo: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
};

describe("createApprovedPaymentSelector", () => {
  it("selects the requirement that matches the approved option", () => {
    const selector = createApprovedPaymentSelector(BASE_APPROVED);
    const chosen = selector(2, [BASE_REQ]);
    expect(chosen).toBe(BASE_REQ);
  });

  it("refuses to sign when the retry inflates the amount", () => {
    const selector = createApprovedPaymentSelector(BASE_APPROVED);
    const inflated = { ...BASE_REQ, amount: "100000000" }; // 100 USDC
    expect(() => selector(2, [inflated])).toThrow(/do not match the approved/);
  });

  it("refuses to sign when the retry swaps the recipient", () => {
    const selector = createApprovedPaymentSelector(BASE_APPROVED);
    const swapped = { ...BASE_REQ, payTo: "0x000000000000000000000000000000000000dEaD" };
    expect(() => selector(2, [swapped])).toThrow(/do not match the approved/);
  });

  it("refuses when no requirement matches the approved network", () => {
    const selector = createApprovedPaymentSelector(BASE_APPROVED);
    const other = { ...BASE_REQ, network: "eip155:1" };
    expect(() => selector(2, [other])).toThrow(/do not match the approved/);
  });

  it("supports the v2 price field for the approved amount", () => {
    const selector = createApprovedPaymentSelector({
      ...BASE_APPROVED,
      maxAmountRequired: null,
      price: "$0.01",
    });
    expect(selector(2, [BASE_REQ])).toBe(BASE_REQ);
    expect(() => selector(2, [{ ...BASE_REQ, amount: "10001" }])).toThrow(
      /do not match the approved/,
    );
  });
});

const isBaseUsdc = (asset: string) => asset.toLowerCase() === BASE_REQ.asset;
const CAPPED_OPTS = {
  isAllowedAsset: isBaseUsdc,
  allowedNetworks: [BASE_REQ.network],
};

describe("createCappedPaymentSelector", () => {
  it("accepts requirements within the configured limit", () => {
    const selector = createCappedPaymentSelector(0.5, CAPPED_OPTS);
    const req = { ...BASE_REQ, amount: "500000" }; // 0.5 USDC
    expect(selector(2, [req])).toBe(req);
  });

  it("refuses requirements above the configured limit", () => {
    const selector = createCappedPaymentSelector(0.5, CAPPED_OPTS);
    const req = { ...BASE_REQ, amount: "500001" };
    expect(() => selector(2, [req])).toThrow(/exceed the configured spending limit/);
  });

  it("refuses a within-cap requirement on a non-USDC asset", () => {
    const selector = createCappedPaymentSelector(0.5, CAPPED_OPTS);
    const req = { ...BASE_REQ, amount: "1", asset: "0x0000000000000000000000000000000000000001" };
    expect(() => selector(2, [req])).toThrow(/not USDC/);
  });

  it("refuses a within-cap USDC requirement on an unsupported network", () => {
    const selector = createCappedPaymentSelector(0.5, CAPPED_OPTS);
    const req = { ...BASE_REQ, amount: "1", network: "eip155:1" };
    expect(() => selector(2, [req])).toThrow(/unsupported network/);
  });
});
