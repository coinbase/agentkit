import { Coinbase, ContractInvocation, Wallet } from "@coinbase/coinbase-sdk";
import { MorphoWithdrawAction } from "../actions/cdp/defi/morpho/withdraw";
import { METAMORPHO_ABI } from "../actions/cdp/defi/morpho/constants";

const MOCK_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_ASSETS = "1000000000000000000"; // 1 token in wei
const MOCK_RECEIVER_ID = "0x9876543210987654321098765432109876543210";

describe("Morpho Withdraw Input", () => {
  const action = new MorphoWithdrawAction();

  it("should successfully parse valid input", () => {
    const validInput = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_ASSETS,
      receiver: MOCK_RECEIVER_ID,
    };

    const result = action.argsSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = action.argsSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });

  it("should fail with invalid Vault address", () => {
    const invalidInput = {
      vaultAddress: "not_an_address",
      assets: MOCK_ASSETS,
      receiver: MOCK_RECEIVER_ID,
    };
    const result = action.argsSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("vaultAddress");
    }
  });

  it("should handle valid asset string formats", () => {
    const validInput = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_ASSETS,
      receiver: MOCK_RECEIVER_ID,
    };

    const validInputs = [{ ...validInput, assets: "1000000000000000000" }];

    validInputs.forEach(input => {
      const result = action.argsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  it("should reject invalid asset strings", () => {
    const validInput = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_ASSETS,
      receiver: MOCK_RECEIVER_ID,
    };

    const invalidInputs = [
      { ...validInput, assets: "" },
      { ...validInput, assets: "1,000" },
      { ...validInput, assets: "1.2.3" },
      { ...validInput, assets: "abc" },
    ];

    invalidInputs.forEach(input => {
      const result = action.argsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe("Morpho Withdraw Action", () => {
  const NETWORK_ID = Coinbase.networks.BaseSepolia;
  const TRANSACTION_HASH = "0xabcdef1234567890";
  const TRANSACTION_LINK = `https://etherscan.io/tx/${TRANSACTION_HASH}`;

  const action = new MorphoWithdrawAction();

  let mockContractInvocation: jest.Mocked<ContractInvocation>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockContractInvocation = {
      wait: jest.fn().mockResolvedValue({
        getTransaction: jest.fn().mockReturnValue({
          getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
          getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
        }),
      }),
    } as unknown as jest.Mocked<ContractInvocation>;

    mockWallet = {
      invokeContract: jest.fn(),
      getDefaultAddress: jest.fn().mockResolvedValue({
        getId: jest.fn().mockReturnValue(MOCK_RECEIVER_ID),
      }),
      getNetworkId: jest.fn().mockReturnValue(NETWORK_ID),
    } as unknown as jest.Mocked<Wallet>;

    mockWallet.invokeContract.mockResolvedValue(mockContractInvocation);
  });

  it("should successfully withdraw from Morpho Vault", async () => {
    const args = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_ASSETS,
      receiver: MOCK_RECEIVER_ID,
    };

    const response = await action.func(mockWallet, args);

    expect(mockWallet.invokeContract).toHaveBeenCalledWith({
      contractAddress: MOCK_VAULT_ADDRESS,
      method: "withdraw",
      abi: METAMORPHO_ABI,
      args: {
        assets: MOCK_ASSETS,
        receiver: MOCK_RECEIVER_ID,
        owner: MOCK_RECEIVER_ID,
      },
    });
    expect(mockContractInvocation.wait).toHaveBeenCalled();
    expect(response).toContain(`Withdrawn ${MOCK_ASSETS}`);
    expect(response).toContain(`from Morpho Vault ${MOCK_VAULT_ADDRESS}`);
    expect(response).toContain(`with transaction hash: ${TRANSACTION_HASH}`);
    expect(response).toContain(`and transaction link: ${TRANSACTION_LINK}`);
  });

  it("should handle errors when withdrawing", async () => {
    const args = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_ASSETS,
      receiver: MOCK_RECEIVER_ID,
    };

    const error = new Error("API Error");
    mockWallet.invokeContract.mockRejectedValue(error);

    const response = await action.func(mockWallet, args);

    expect(mockWallet.invokeContract).toHaveBeenCalled();
    expect(response).toContain(`Error withdrawing from Morpho Vault: ${error}`);
  });
});
