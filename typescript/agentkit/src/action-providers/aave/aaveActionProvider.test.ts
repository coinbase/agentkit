import { AaveActionProvider } from "./aaveActionProvider";
import {
  AaveSupplySchema,
  AaveWithdrawSchema,
  AaveBorrowSchema,
  AaveRepaySchema,
  AaveGetUserDataSchema,
} from "./schemas";

describe("Aave Action Provider Input Schemas", () => {
  describe("Supply Schema", () => {
    it("should successfully parse valid supply input", () => {
      const validInput = {
        assetId: "weth",
        amount: "1.5",
      };
      const result = AaveSupplySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should fail for invalid asset", () => {
      const invalidInput = {
        assetId: "invalid",
        amount: "1.5",
      };
      const result = AaveSupplySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should fail for invalid amount format", () => {
      const invalidInput = {
        assetId: "weth",
        amount: "not-a-number",
      };
      const result = AaveSupplySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("Withdraw Schema", () => {
    it("should successfully parse valid withdraw input", () => {
      const validInput = {
        assetId: "usdc",
        amount: "1000",
      };
      const result = AaveWithdrawSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("Borrow Schema", () => {
    it("should successfully parse valid borrow input with variable rate", () => {
      const validInput = {
        assetId: "usdc",
        amount: "500",
        interestRateMode: "variable",
      };
      const result = AaveBorrowSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should successfully parse valid borrow input with stable rate", () => {
      const validInput = {
        assetId: "weth",
        amount: "0.5",
        interestRateMode: "stable",
      };
      const result = AaveBorrowSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should fail for invalid interest rate mode", () => {
      const invalidInput = {
        assetId: "usdc",
        amount: "500",
        interestRateMode: "invalid",
      };
      const result = AaveBorrowSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("Repay Schema", () => {
    it("should successfully parse valid repay input", () => {
      const validInput = {
        assetId: "usdc",
        amount: "500",
        interestRateMode: "variable",
      };
      const result = AaveRepaySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("GetUserData Schema", () => {
    it("should successfully parse empty input", () => {
      const validInput = {};
      const result = AaveGetUserDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });
});

describe("Aave Action Provider", () => {
  let actionProvider: AaveActionProvider;

  beforeEach(() => {
    actionProvider = new AaveActionProvider();
  });

  describe("constructor", () => {
    it("should create an instance", () => {
      expect(actionProvider).toBeDefined();
      expect(actionProvider).toBeInstanceOf(AaveActionProvider);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for base-mainnet", () => {
      expect(
        actionProvider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      ).toBe(true);
    });

    it("should return true for ethereum-mainnet", () => {
      expect(
        actionProvider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
        }),
      ).toBe(true);
    });

    it("should return false for unsupported networks", () => {
      expect(
        actionProvider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "polygon-mainnet",
        }),
      ).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      expect(
        actionProvider.supportsNetwork({
          protocolFamily: "solana",
          networkId: "solana-mainnet",
        }),
      ).toBe(false);
    });
  });
});

