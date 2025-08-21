/**
 * Clanker Action Provider tests
 */

import { clankerActionProvider } from "./clankerActionProvider";
import { ClankTokenSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

import { makeClanker } from "./utils/clankerBridge";

jest.mock("./utils/clankerBridge", () => ({
  makeClanker: jest.fn(),
}));

type MakeClanker = typeof makeClanker;
const makeClankerMock = makeClanker as jest.MockedFunction<MakeClanker>;

const DEPLOYED_HASH = "0xdeadbeef";
const DEPLOYED_TOKEN_ADDRESS = "0xabc123abc123abc123abc123abc123abc123abc1";

describe("Clanker action provider tests", () => {
  const provider = clankerActionProvider();

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

    const fakeClanker = {
      deploy: jest.fn(async _tokenCfg => ({
        txHash: DEPLOYED_HASH as `0x${string}`,
        waitForTransaction: async () => ({ address: DEPLOYED_TOKEN_ADDRESS as `0x${string}` }),
      })),
    };

    makeClankerMock.mockResolvedValue(fakeClanker as unknown as Awaited<ReturnType<MakeClanker>>);
  });

  describe("network validation", () => {
    it("should support the protocol family and network", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        } as Network),
      ).toBe(true);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
        } as Network),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({ protocolFamily: "invalid-protocol" } as Network)).toBe(
        false,
      );
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("schema validation", () => {
    it("should validate example action schema", () => {
      const validInput = {
        tokenName: "testTokenName",
        tokenSymbol: "TTN",
        image: "https://test.com",
        vestingPercentage: 10,
        vestingDuration_Days: 30,
        lockDuration_Days: 30,
      };
      const parseResult = ClankTokenSchema.safeParse(validInput);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.tokenName).toBe("testTokenName");
        expect(parseResult.data.tokenSymbol).toBe("TTN");
        expect(parseResult.data.image).toBe("https://test.com");
        expect(parseResult.data.vestingPercentage).toBe(10);
        expect(parseResult.data.vestingDuration_Days).toBe(30);
        expect(parseResult.data.lockDuration_Days).toBe(30);
      }
    });

    it("should reject invalid example action input", () => {
      const invalidInput = {
        fieldName: "",
        amount: "invalid",
      };
      const parseResult = ClankTokenSchema.safeParse(invalidInput);
      expect(parseResult.success).toBe(false);
    });
  });

  describe("clanker action execution", () => {
    it("should execute the clanker action with wallet provider", async () => {
      const args = {
        tokenName: "testTokenName",
        tokenSymbol: "TTN",
        image: "https://test.com",
        vestingPercentage: 10,
        vestingDuration_Days: 30,
        lockDuration_Days: 30,
      };
      const result = await provider.clankToken(mockWalletProvider, args);
      expect(result).toContain(`Clanker token deployed at ${DEPLOYED_TOKEN_ADDRESS}`);
      expect(result).toContain(`View the transaction at ${DEPLOYED_HASH}`);
      expect(mockWalletProvider.getNetwork).toHaveBeenCalled();

      expect(makeClankerMock).toHaveBeenCalledWith(expect.any(Object), expect.any(String));
    });
  });
});
