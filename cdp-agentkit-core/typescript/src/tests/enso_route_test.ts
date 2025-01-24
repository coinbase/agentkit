import { Coinbase, ContractInvocation, Wallet } from "@coinbase/coinbase-sdk";

import { ensoRoute, EnsoRouteInput } from "../actions/cdp/enso/actions/route";
import { ENSO_ETH, ENSO_ROUTER_ABI, ENSO_ROUTERS } from "../actions/cdp/enso/constants";

const MOCK_AMOUNT_ETH_IN_WEI = "100000000000000000";
const ETHEREUM_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MOCK_SENDER = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

describe("Enso Route Input", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      amountIn: MOCK_AMOUNT_ETH_IN_WEI,
      tokenIn: ENSO_ETH,
      tokenOut: ETHEREUM_USDC,
    };

    const result = EnsoRouteInput.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = EnsoRouteInput.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Enso Route Action", () => {
  const NETWORK_ID = Coinbase.networks.EthereumMainnet;
  const TRANSACTION_HASH = "0xghijkl987654321";
  const TRANSACTION_HASH_2 = "0x22ghijkl987654321";

  let mockContractInvocation: jest.Mocked<ContractInvocation>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    mockWallet = {
      invokeContract: jest.fn(),
      getDefaultAddress: jest.fn().mockResolvedValue({
        getId: jest.fn().mockReturnValue(TRANSACTION_HASH),
        toString: jest.fn().mockReturnValue(MOCK_SENDER),
      }),
      getNetworkId: jest.fn().mockReturnValue(NETWORK_ID),
    } as unknown as jest.Mocked<Wallet>;

    mockContractInvocation = {
      wait: jest.fn().mockResolvedValue({
        getTransaction: jest.fn().mockReturnValue({
          getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
        }),
      }),
    } as unknown as jest.Mocked<ContractInvocation>;

    mockWallet.invokeContract.mockResolvedValueOnce(mockContractInvocation).mockResolvedValueOnce({
      wait: jest.fn().mockResolvedValue({
        getTransaction: jest.fn().mockReturnValue({
          getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH_2),
        }),
      }),
    } as unknown as jest.Mocked<ContractInvocation>);
  });

  it("should successfully route ETH -> USDC", async () => {
    const args = {
      amountIn: MOCK_AMOUNT_ETH_IN_WEI,
      tokenIn: ENSO_ETH,
      tokenOut: ETHEREUM_USDC,
    };

    const response = await ensoRoute(mockWallet, args);

    expect(mockWallet.invokeContract).toHaveBeenCalledWith({
      contractAddress: ENSO_ROUTERS.get(1),
      method: "routeSingle",
      abi: ENSO_ROUTER_ABI,
      args: {
        tokenIn: ENSO_ETH,
        amountIn: BigInt(args.amountIn),
        commands: expect.any(Array),
        state: expect.any(Array),
      },
      amount: BigInt(args.amountIn),
      assetId: "wei",
    });
    expect(response).toContain(
      `Route executed successfully, transaction hash: ${TRANSACTION_HASH}`,
    );
  });

  it("should handle errors when buying a token", async () => {
    // This will fail because tokenIn/tokenOut is the same
    const args = {
      amountIn: MOCK_AMOUNT_ETH_IN_WEI,
      tokenIn: ENSO_ETH,
      tokenOut: ENSO_ETH,
    };

    const response = await ensoRoute(mockWallet, args);

    expect(response).toContain(`Error routing token through Enso API: `);
  });
});
