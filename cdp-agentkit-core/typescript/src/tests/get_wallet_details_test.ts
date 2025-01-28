import { Coinbase, Wallet, WalletAddress } from "@coinbase/coinbase-sdk";

import { getWalletDetails, GetWalletDetailsInput } from "../actions/cdp/get_wallet_details";

describe("Wallet Details Input", () => {
  it("should successfully parse empty input", () => {
    const emptyInput = {};
    const result = GetWalletDetailsInput.safeParse(emptyInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(emptyInput);
  });
});

describe("Wallet Details Action", () => {
  const ADDRESS_ID = "0xabcdef123456789";
  const NETWORK_ID = Coinbase.networks.BaseSepolia;
  const WALLET_ID = "0x123456789abcdef";

  let mockAddress: jest.Mocked<WalletAddress>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockAddress = {
      getId: jest.fn().mockReturnValue(ADDRESS_ID),
    } as unknown as jest.Mocked<WalletAddress>;

    mockWallet = {
      getDefaultAddress: jest.fn(),
      getId: jest.fn().mockReturnValue(WALLET_ID),
      getNetworkId: jest.fn().mockReturnValue(NETWORK_ID),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.getDefaultAddress.mockResolvedValue(mockAddress);
  });

  it("should successfully respond", async () => {
    const args = {};
    const response = await getWalletDetails(mockWallet, args);

    expect(mockWallet.getDefaultAddress).toHaveBeenCalled();
    expect(response).toContain(`Wallet: ${WALLET_ID}`);
    expect(response).toContain(`on network: ${NETWORK_ID}`);
    expect(response).toContain(`with default address: ${ADDRESS_ID}`);
  });

  it("should fail with an error", async () => {
    const args = {};

    const error = new Error("An error has occurred");
    mockWallet.getDefaultAddress.mockRejectedValue(error);

    const response = await getWalletDetails(mockWallet, args);

    expect(mockWallet.getDefaultAddress).toHaveBeenCalled();
    expect(response).toContain(`Error getting wallet details: ${error}`);
  });
});
