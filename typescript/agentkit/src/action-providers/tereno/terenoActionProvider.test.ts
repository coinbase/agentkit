import {
  TerenoCheckContractSchema,
  TerenoGetTokenMetadataSchema,
  TerenoGetPredictionEvidenceSchema,
  TerenoListBountiesSchema,
} from "./schemas";
import { terenoActionProvider, TerenoActionProvider } from "./terenoActionProvider";
import { Network } from "../../network";

jest.mock(
  "tereno-client",
  () => ({
    createTerenoClient: jest.fn(() => ({
      checkContract: jest.fn(),
      getTokenMetadata: jest.fn(),
      getPredictionEvidence: jest.fn(),
      listBounties: jest.fn(),
    })),
  }),
  { virtual: true },
);

const MOCK_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

describe("TerenoActionProvider Schemas", () => {
  describe("TerenoCheckContractSchema", () => {
    it("should successfully parse a valid Base EVM address", () => {
      const validInput = { address: MOCK_CONTRACT };
      const result = TerenoCheckContractSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should reject an invalid address format", () => {
      const invalidInput = { address: "0xinvalidaddress" };
      const result = TerenoCheckContractSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("TerenoGetTokenMetadataSchema", () => {
    it("should parse valid token address", () => {
      const validInput = { address: MOCK_CONTRACT };
      const result = TerenoGetTokenMetadataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("TerenoGetPredictionEvidenceSchema", () => {
    it("should parse a valid prediction question", () => {
      const validInput = {
        question: "Will Ethereum Pectra upgrade activate before Q4 2026?",
        market: "polymarket",
      };
      const result = TerenoGetPredictionEvidenceSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject too short question", () => {
      const invalidInput = { question: "No?" };
      const result = TerenoGetPredictionEvidenceSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("TerenoListBountiesSchema", () => {
    it("should apply default limit of 20", () => {
      const result = TerenoListBountiesSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });
  });
});

describe("TerenoActionProvider", () => {
  const provider = terenoActionProvider();

  it("should be an instance of TerenoActionProvider", () => {
    expect(provider).toBeInstanceOf(TerenoActionProvider);
  });

  it("should support Base mainnet and Base Sepolia", () => {
    const baseMainnet: Network = {
      protocolFamily: "evm",
      chainId: "8453",
      networkId: "base-mainnet",
    };
    const baseSepolia: Network = {
      protocolFamily: "evm",
      chainId: "84532",
      networkId: "base-sepolia",
    };
    const ethereumMainnet: Network = {
      protocolFamily: "evm",
      chainId: "1",
      networkId: "ethereum",
    };

    expect(provider.supportsNetwork(baseMainnet)).toBe(true);
    expect(provider.supportsNetwork(baseSepolia)).toBe(true);
    expect(provider.supportsNetwork(ethereumMainnet)).toBe(false);
  });
});
