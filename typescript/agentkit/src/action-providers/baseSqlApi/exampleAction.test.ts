import { BaseSqlApiActionProvider } from "./baseSqlApiActionProvider";
import { BaseSqlApiSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

describe("Base SQL API Action Provider tests", () => {
  const provider = new BaseSqlApiActionProvider();

  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWalletProvider = {
      getAddress: jest.fn(),
      getBalance: jest.fn(),
      getName: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
      }),
      nativeTransfer: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("schema validation", () => {
    it("should validate example action schema", () => {
      const validInput = {
        sqlQuery: "test",
      };
      const parseResult = BaseSqlApiSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.sqlQuery).toBe("test");
      }
    });

    it("should reject invalid example action input", () => {
      const invalidInput = {
        fieldName: "",
        amount: "invalid",
      };
      const parseResult = BaseSqlApiSchema.safeParse(invalidInput);
      expect(parseResult.success).toBe(false);
    });
  });

  describe("example action execution", () => {
    it("should execute example action with wallet provider", async () => {
      const args = {
        sqlQuery: "test",
      };
      const result = await provider.exampleAction(mockWalletProvider, args);
      expect(result).toContain(args.sqlQuery);
      expect(mockWalletProvider.getNetwork).toHaveBeenCalled();
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for base-mainnet with evm protocol", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      ).toBe(true);
    });

    it("should return false for non-base networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
        }),
      ).toBe(false);
    });
  });
});
