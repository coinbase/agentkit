import { describe, it, expect, vi } from "vitest";
import { HcrbActionProvider } from "./hcrbActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

describe("HcrbActionProvider", () => {
  const provider = new HcrbActionProvider({ apiUrl: "https://hcrb.in" });

  const mockWallet = {
    getAddress: () => "0xc59c85e661d34084a7769f955d17fd38254a6235",
    getNetwork: () => ({ protocolFamily: "evm", networkId: "base-mainnet" }),
  } as unknown as EvmWalletProvider;

  it("supports Base and Base Sepolia networks", () => {
    const baseNet: Network = { protocolFamily: "evm", networkId: "8453" };
    const ethNet: Network = { protocolFamily: "evm", networkId: "1" };
    expect(provider.supportsNetwork(baseNet)).toBe(true);
    expect(provider.supportsNetwork(ethNet)).toBe(false);
  });

  it("verifies IBAN with deterministic payload structure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, iban: "GB29NWBK60161331926819" }),
    } as Response);

    const res = await provider.verifyIban(mockWallet, { iban: "GB29NWBK60161331926819" });
    const parsed = JSON.parse(res);
    expect(parsed.success).toBe(true);
    expect(parsed.iban).toBe("GB29NWBK60161331926819");
    fetchSpy.mockRestore();
  });

  it("verifies LEI with institutional schema", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, lei: "HW68LVUS7IT1SXVO4E65" }),
    } as Response);

    const res = await provider.verifyLei(mockWallet, { lei: "HW68LVUS7IT1SXVO4E65" });
    const parsed = JSON.parse(res);
    expect(parsed.success).toBe(true);
    fetchSpy.mockRestore();
  });

  it("creates B2B invoice with EIP-681 Base USDC details", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "inv_test123", amount: 5000, status: "ISSUED" }),
    } as Response);

    const res = await provider.createB2bInvoice(mockWallet, {
      amountUsdc: 5000,
      clientName: "SpearSec DAO",
      memo: "Smart contract security review",
    });
    const parsed = JSON.parse(res);
    expect(parsed.success).toBe(true);
    expect(parsed.invoice.id).toBe("inv_test123");
    fetchSpy.mockRestore();
  });
});
