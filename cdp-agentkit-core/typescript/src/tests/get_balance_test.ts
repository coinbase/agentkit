import { Wallet, WalletAddress } from "@coinbase/coinbase-sdk";
import { getBalance, GetBalanceInput } from "../actions/cdp/get_balance";

const MOCK_ASSET_ID = "test-asset-id";
const MOCK_BALANCE = 1000000000000000000;

describe("Get Balance Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      assetId: MOCK_ASSET_ID,
    };

    const result = GetBalanceInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = GetBalanceInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Get Balance Action", () => {
  const WALLET_ID = "0x123456789abcdef";

  let mockAddresses: jest.Mocked<WalletAddress[]>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockAddresses = [
      {
        getId: jest.fn().mockReturnValue("test-address-id-1"),
        getBalance: jest.fn().mockReturnValue(MOCK_BALANCE),
      } as unknown as jest.Mocked<WalletAddress>,
      {
        getId: jest.fn().mockReturnValue("test-address-id-2"),
        getBalance: jest.fn().mockReturnValue(0.0),
      } as unknown as jest.Mocked<WalletAddress>,
      {
        getId: jest.fn().mockReturnValue("test-address-id-3"),
        getBalance: jest.fn().mockReturnValue(MOCK_BALANCE),
      } as unknown as jest.Mocked<WalletAddress>,
    ] as unknown as jest.Mocked<WalletAddress>[];

    mockWallet = {
      getId: jest.fn().mockReturnValue(WALLET_ID),
      listAddresses: jest.fn(),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.listAddresses.mockResolvedValue(mockAddresses);
  });

  it("should successfully respond", async () => {
    const args = {
      assetId: MOCK_ASSET_ID,
    };

    const response = await getBalance(mockWallet, args);

    expect(mockWallet.listAddresses).toHaveBeenCalledWith();
    mockAddresses.forEach(address => {
      expect(address.getBalance).toHaveBeenCalledWith(MOCK_ASSET_ID);
      expect(response).toContain(`${address.getId()}: ${address.getBalance(MOCK_ASSET_ID)}`);
    });
    expect(response).toContain(`Balances for wallet ${WALLET_ID}`);
  });

  it("should fail with an error", async () => {
    const args = {
      assetId: MOCK_ASSET_ID,
    };

    const error = new Error("An error has occurred");
    mockWallet.listAddresses.mockRejectedValue(error);

    const response = await getBalance(mockWallet, args);

    expect(mockWallet.listAddresses).toHaveBeenCalled();
    expect(response).toContain(`Error getting balance for all addresses in the wallet: ${error}`);
  });
});
