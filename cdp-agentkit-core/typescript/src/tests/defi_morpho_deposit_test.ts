import { Coinbase, ContractInvocation, Wallet, Asset } from "@coinbase/coinbase-sdk";

import { approve } from "../actions/cdp/utils";

import { MorphoDepositAction } from "../actions/cdp/defi/morpho/deposit";
import { METAMORPHO_ABI } from "../actions/cdp/defi/morpho/constants";

const MOCK_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_ATOMIC_ASSETS = "1000000000000000000";
const MOCK_WHOLE_ASSETS = "0.0001";
const MOCK_RECEIVER_ID = "0x9876543210987654321098765432109876543210";
const MOCK_TOKEN_ADDRESS = "0x4200000000000000000000000000000000000006";

jest.mock("../actions/cdp/utils");
const mockApprove = approve as jest.MockedFunction<typeof approve>;

describe("Morpho Deposit Input", () => {
  const action = new MorphoDepositAction();

  it("should successfully parse valid input", () => {
    const validInput = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_WHOLE_ASSETS,
      receiver: MOCK_RECEIVER_ID,
      tokenAddress: MOCK_TOKEN_ADDRESS,
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

  it("should fail with invalid vault address", () => {
    const invalidInput = {
      vaultAddress: "not_an_address",
      assets: MOCK_WHOLE_ASSETS,
      receiver: MOCK_RECEIVER_ID,
      tokenAddress: MOCK_TOKEN_ADDRESS,
    };
    const result = action.argsSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });

  it("should handle valid asset string formats", () => {
    const validInput = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_WHOLE_ASSETS,
      receiver: MOCK_RECEIVER_ID,
      tokenAddress: MOCK_TOKEN_ADDRESS,
    };

    const validInputs = [
      { ...validInput, assets: "1000000000000000000" },
      { ...validInput, assets: "1.5" },
      { ...validInput, assets: "0.00001" },
    ];

    validInputs.forEach(input => {
      const result = action.argsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  it("should reject invalid asset strings", () => {
    const validInput = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_WHOLE_ASSETS,
      receiver: MOCK_RECEIVER_ID,
      tokenAddress: MOCK_TOKEN_ADDRESS,
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

describe("Morpho Deposit Action", () => {
  const NETWORK_ID = Coinbase.networks.BaseSepolia;
  const TRANSACTION_HASH = "0xabcdef1234567890";
  const TRANSACTION_LINK = `https://etherscan.io/tx/${TRANSACTION_HASH}`;

  const action = new MorphoDepositAction();

  let mockContractInvocation: jest.Mocked<ContractInvocation>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockContractInvocation = {
      wait: jest.fn().mockResolvedValue({
        getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
        getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
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

    jest.spyOn(Asset, "fetch").mockResolvedValue({
      toAtomicAmount: jest.fn().mockReturnValue(BigInt(MOCK_ATOMIC_ASSETS)),
    } as unknown as Asset);

    mockApprove.mockResolvedValue("Approval successful");
  });

  it("should successfully deposit to Morpho vault", async () => {
    const args = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_WHOLE_ASSETS,
      receiver: MOCK_RECEIVER_ID,
      tokenAddress: MOCK_TOKEN_ADDRESS,
    };

    const atomicAssets = BigInt(MOCK_ATOMIC_ASSETS);
    const response = await action.func(mockWallet, args);

    expect(mockApprove).toHaveBeenCalledWith(
      mockWallet,
      MOCK_TOKEN_ADDRESS,
      MOCK_VAULT_ADDRESS,
      atomicAssets,
    );

    expect(mockWallet.invokeContract).toHaveBeenCalledWith({
      contractAddress: MOCK_VAULT_ADDRESS,
      method: "deposit",
      abi: METAMORPHO_ABI,
      args: {
        assets: MOCK_ATOMIC_ASSETS,
        receiver: MOCK_RECEIVER_ID,
      },
    });

    expect(mockContractInvocation.wait).toHaveBeenCalled();
    expect(response).toContain(`Deposited ${MOCK_WHOLE_ASSETS}`);
    expect(response).toContain(`to Morpho Vault ${MOCK_VAULT_ADDRESS}`);
    expect(response).toContain(`with transaction hash: ${TRANSACTION_HASH}`);
    expect(response).toContain(`and transaction link: ${TRANSACTION_LINK}`);
  });

  it("should handle approval failure", async () => {
    const args = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_WHOLE_ASSETS,
      receiver: MOCK_RECEIVER_ID,
      tokenAddress: MOCK_TOKEN_ADDRESS,
    };

    mockApprove.mockResolvedValue("Error: Approval failed");

    const response = await action.func(mockWallet, args);

    expect(mockApprove).toHaveBeenCalled();
    expect(response).toContain("Error approving Morpho Vault as spender: Error: Approval failed");
    expect(mockWallet.invokeContract).not.toHaveBeenCalled();
  });

  it("should handle deposit errors", async () => {
    const args = {
      vaultAddress: MOCK_VAULT_ADDRESS,
      assets: MOCK_WHOLE_ASSETS,
      receiver: MOCK_RECEIVER_ID,
      tokenAddress: MOCK_TOKEN_ADDRESS,
    };

    const error = new Error("Failed to deposit to Morpho vault");
    mockWallet.invokeContract.mockRejectedValue(error);

    const response = await action.func(mockWallet, args);

    expect(mockApprove).toHaveBeenCalled();
    expect(mockWallet.invokeContract).toHaveBeenCalled();
    expect(response).toContain(`Error depositing to Morpho Vault: ${error}`);
  });
});
