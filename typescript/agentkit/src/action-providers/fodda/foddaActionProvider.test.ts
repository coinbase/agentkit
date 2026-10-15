import { foddaActionProvider } from "./foddaActionProvider";
import { FoddaQueryContextSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

describe("Fodda Action Provider", () => {
  const actionProvider = foddaActionProvider();

  describe("Schema Validation", () => {
    it("should successfully parse valid input", () => {
      const validInput = { slug: "psfk-retail" };
      const result = FoddaQueryContextSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail on empty input", () => {
      const result = FoddaQueryContextSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for base-mainnet", () => {
      expect(
        actionProvider.supportsNetwork({
          networkId: "base-mainnet",
          protocolFamily: "evm",
        } as Network),
      ).toBe(true);
    });

    it("should return true for base-sepolia", () => {
      expect(
        actionProvider.supportsNetwork({
          networkId: "base-sepolia",
          protocolFamily: "evm",
        } as Network),
      ).toBe(true);
    });

    it("should return false for ethereum-mainnet", () => {
      expect(
        actionProvider.supportsNetwork({
          networkId: "ethereum-mainnet",
          protocolFamily: "evm",
        } as Network),
      ).toBe(false);
    });
  });

  describe("queryFoddaContext", () => {
    let mockWallet: jest.Mocked<EvmWalletProvider>;
    const originalFetch = global.fetch;

    beforeEach(() => {
      mockWallet = {
        getAddress: jest.fn().mockReturnValue("0x1234567890123456789012345678901234567890"),
        getNetwork: jest.fn().mockReturnValue({ networkId: "base-mainnet" }),
        sendTransaction: jest.fn().mockResolvedValue("0xmocktxhash"),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
      } as unknown as jest.Mocked<EvmWalletProvider>;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should return graph data directly when 200 OK", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ graph: "psfk-retail", nodes: [] })),
      });

      const result = await actionProvider.queryFoddaContext(mockWallet, { slug: "psfk-retail" });
      expect(result).toContain("psfk-retail");
      expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("should handle 402 challenge, execute Base settlement, and retry paid request", async () => {
      const challengeResponse = {
        status: 402,
        headers: new Headers({ "Retry-After": "0" }),
        json: jest.fn().mockResolvedValue({
          payment_methods_detail: [
            {
              method: "x402",
              recipient_address: "0xF61c2D34e84C77e0e97eba47dB4A1db32fF225A1",
            },
          ],
        }),
      };

      const paidResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ graph: "psfk-retail", verified: true })),
      };

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(challengeResponse)
        .mockResolvedValueOnce(paidResponse);

      const result = await actionProvider.queryFoddaContext(mockWallet, { slug: "psfk-retail" });

      expect(mockWallet.sendTransaction).toHaveBeenCalled();
      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith("0xmocktxhash");
      expect(result).toContain("verified");
    });
  });
});
