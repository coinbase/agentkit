import { Address } from "@coinbase/coinbase-sdk";
import { AddressReputationAction } from "../actions/cdp/address_reputation";

const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_NETWORK = "base-sepolia";

jest.mock("@coinbase/coinbase-sdk", () => ({
  Address: jest.fn(),
}));

describe("Address Reputation Input", () => {
  const action = new AddressReputationAction();

  it("should successfully parse valid input", () => {
    const validInput = {
      network: MOCK_NETWORK,
      address: MOCK_ADDRESS,
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

  it("should fail with invalid address", () => {
    const invalidInput = {
      network: MOCK_NETWORK,
      address: "not_an_address",
    };
    const result = action.argsSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });
});

describe("Address Reputation Action", () => {
  let mockAddress: jest.Mocked<Address>;

  beforeEach(() => {
    mockAddress = {
      reputation: jest.fn(),
    } as unknown as jest.Mocked<Address>;

    (Address as unknown as jest.Mock).mockImplementation(() => mockAddress);
  });

  it("should successfully check address reputation", async () => {
    const mockReputation = {
      score: 85,
      metadata: {
        total_transactions: 150,
        unique_days_active: 30,
        longest_active_streak: 10,
        current_active_streak: 5,
        activity_period_days: 45,
        token_swaps_performed: 20,
        bridge_transactions_performed: 5,
        lend_borrow_stake_transactions: 10,
        ens_contract_interactions: 2,
        smart_contract_deployments: 1,
      },

      // TODO: remove this once AddressReputation is exported from the sdk
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as jest.Mocked<any>;

    mockAddress.reputation.mockResolvedValue(mockReputation);

    const args = {
      network: MOCK_NETWORK,
      address: MOCK_ADDRESS,
    };

    const action = new AddressReputationAction();
    const response = await action.func(args);

    expect(response).toBe(mockReputation.toString());
  });

  it("should handle errors gracefully", async () => {
    const error = new Error("API error");
    mockAddress.reputation.mockRejectedValue(error);

    const args = {
      network: MOCK_NETWORK,
      address: MOCK_ADDRESS,
    };

    const action = new AddressReputationAction();
    const response = await action.func(args);

    expect(response).toBe(`Error checking address reputation: ${error}`);
  });
});
