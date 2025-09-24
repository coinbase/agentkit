import { getAddress } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { ensoActionProvider } from "./ensoActionProvider";
import { EnsoRouteSchema } from "./schemas";

const MOCK_ADDRESS = "0x1234567890123456789012345678901234543210";
const ENSO_ROUTER_BASE = "0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf";

const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const mockGetTokenData = jest.fn();
const mockGetRouteData = jest.fn();
const mockGetApprovalData = jest.fn();

jest.mock("@ensofinance/sdk", () => {
  return {
    EnsoClient: jest.fn().mockImplementation(() => {
      return {
        getTokenData: mockGetTokenData,
        getRouteData: mockGetRouteData,
        getApprovalData: mockGetApprovalData,
      };
    }),
  };
});

describe("Enso Route Schema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      tokenIn: USDC,
      tokenOut: WETH,
      amountIn: "100",
      slippage: 50,
    };

    const result = EnsoRouteSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = EnsoRouteSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Enso Route Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = ensoActionProvider();
  const args = {
    tokenIn: USDC,
    tokenOut: WETH,
    amountIn: "100",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Set up default mock responses for EnsoClient methods for successful scenarios
    mockGetTokenData.mockResolvedValue({
      data: [
        {
          address: USDC,
          decimals: 6,
          symbol: "USDC",
        },
      ],
    });
    mockGetRouteData.mockResolvedValue({
      tx: {
        to: ENSO_ROUTER_BASE,
        value: "0",
        data: "0xb94c3609000000000000000000000000f75584ef6673ad213a685a1b58cc0330b8ea22cf0000000000000000000000000000000000000000000000000000000005f5e100",
      },
    });
    mockGetApprovalData.mockResolvedValue({
      tx: {
        to: USDC,
        data: "0x095ea7b3000000000000000000000000f75584ef6673ad213a685a1b58cc0330b8ea22cf0000000000000000000000000000000000000000000000000000000005f5e100",
      },
    });

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({ chainId: "8453" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("should successfully respond", async () => {
    const hash = "0x1234567890123456789012345678901234567890";
    mockWallet.sendTransaction.mockResolvedValue(hash);

    const response = await actionProvider.route(mockWallet, args);

    // First transaction should be the approval
    expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(
      1, // First call
      expect.objectContaining({
        to: getAddress(args.tokenIn),
      }),
    );

    // Second transaction should be the route execution
    expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(
      2, // Second call
      expect.objectContaining({
        to: ENSO_ROUTER_BASE,
        value: BigInt(0),
      }),
    );

    expect(response).toContain(`Route executed successfully, transaction hash: ${hash}`);
  });

  it("should fail with an error", async () => {
    const error = new Error("Failed to route through Enso");
    mockWallet.sendTransaction.mockRejectedValue(error);

    const response = await actionProvider.route(mockWallet, args);

    // First transaction should be the approval
    expect(mockWallet.sendTransaction).toHaveBeenNthCalledWith(
      1, // First call
      expect.objectContaining({
        to: getAddress(args.tokenIn),
      }),
    );

    expect(response).toContain(`Error routing token through Enso: ${error}`);
  });
});

describe("supportsNetwork", () => {
  const actionProvider = ensoActionProvider();

  it("should return false for base-mainnet (supported only with chainId)", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "base-mainnet",
    });
    expect(result).toBe(false);
  });

  it("should return true for 8453 (base)", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      chainId: "8453",
    });
    expect(result).toBe(true);
  });

  it("should return false for base-sepolia", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      networkId: "base-sepolia",
    });
    expect(result).toBe(false);
  });

  it("should return true for 1 (mainnet)", () => {
    const result = actionProvider.supportsNetwork({
      protocolFamily: "evm",
      chainId: "1",
    });
    expect(result).toBe(true);
  });
});
