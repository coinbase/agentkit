import { ViemWalletProvider } from "../../wallet-providers";
import { SushiQuoteSchema, SushiSwapSchema } from "./sushiRouterSchemas";
import { getSwap, SwapResponse, nativeAddress, RouteStatus, getEvmChainById } from "sushi/evm";
import { SushiRouterActionProvider } from "./sushiRouterActionProvider";
import {
  Address,
  encodeAbiParameters,
  encodeEventTopics,
  formatUnits,
  parseAbiParameters,
} from "viem";
import { routeProcessor9Abi_Route } from "./constants";

// Mock the entire module
jest.mock("sushi/evm", () => {
  const originalModule = jest.requireActual("sushi/evm");

  return {
    __esModule: true,
    ...originalModule,
    getSwap: jest.fn(originalModule.getSwap),
  };
});
const mockedGetSwap = getSwap as jest.MockedFunction<typeof getSwap>;

describe("Sushi Action Provider Input Schemas", () => {
  describe("Swap Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        fromAssetAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        amount: "0.0001",
        toAssetAddress: "0x1234567890123456789012345678901234567890",
        maxSlippage: 0.005,
      };

      const result = SushiSwapSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing invalid fromAssetAddress", () => {
      const invalidInput = {
        fromAssetAddress: "invalid-address",
        amount: "0.0001",
        toAssetAddress: "0x1234567890123456789012345678901234567890",
        maxSlippage: 0.005,
      };
      const result = SushiSwapSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing invalid toAssetAddress", () => {
      const invalidInput = {
        fromAssetAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        amount: "0.0001",
        toAssetAddress: "invalid-address",
        maxSlippage: 0.005,
      };
      const result = SushiSwapSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing invalid maxSlippage (>1)", () => {
      const invalidInput = {
        fromAssetAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        amount: "0.0001",
        toAssetAddress: "0x1234567890123456789012345678901234567890",
        maxSlippage: 1.1,
      };
      const result = SushiSwapSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing invalid maxSlippage (<0)", () => {
      const invalidInput = {
        fromAssetAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        amount: "0.0001",
        toAssetAddress: "0x1234567890123456789012345678901234567890",
        maxSlippage: -1.1,
      };
      const result = SushiSwapSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });

  describe("Quote Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        fromAssetAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        amount: "0.0001",
        toAssetAddress: "0x1234567890123456789012345678901234567890",
      };

      const result = SushiQuoteSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing invalid fromAssetAddress", () => {
      const invalidInput = {
        fromAssetAddress: "invalid-address",
        amount: "0.0001",
        toAssetAddress: "0x1234567890123456789012345678901234567890",
        maxSlippage: 0.005,
      };
      const result = SushiQuoteSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing invalid toAssetAddress", () => {
      const invalidInput = {
        fromAssetAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        amount: "0.0001",
        toAssetAddress: "invalid-address",
        maxSlippage: 0.005,
      };
      const result = SushiQuoteSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("Sushi Action Provider", () => {
  let actionProvider: SushiRouterActionProvider;
  let mockWallet: jest.Mocked<ViemWalletProvider>;

  type Token = { address: Address; decimals: number; symbol: string; name: string };

  const amountIn = BigInt(1000000);
  const amountOut = BigInt(500000);

  const nativeToken: Token = {
    address: nativeAddress,
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
  };
  const tokenIn: Token = {
    address: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
    symbol: "TIN",
    name: "Token In",
    decimals: 18,
  };
  const tokenOut: Token = {
    address: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
    symbol: "TOU",
    name: "Token Out",
    decimals: 18,
  } as const;

  const user = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF";

  const txHash = "0xhash";

  const chainId = 1;

  const getRouteLog = ({
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
  }: {
    tokenIn: Token;
    tokenOut: Token;
    amountIn: bigint;
    amountOut: bigint;
  }) => [
    {
      data: encodeAbiParameters(
        parseAbiParameters(
          "address to, address tokenOut, uint256 amountIn, uint256 amountOut, int256 slippage, bytes32 diagnosticsFirst32",
        ),
        [user, tokenOut.address, amountIn, amountOut, 0n, `0x${"00".repeat(32)}`],
      ),
      topics: encodeEventTopics({
        abi: routeProcessor9Abi_Route,
        eventName: "Route",
        args: {
          from: user,
          tokenIn: tokenIn.address,
          referralCode: 0,
        },
      }),
    },
  ];

  const getSuccessfullSwapResponse = async ({
    tokenIn,
    amountIn,
    tokenOut,
    amountOut,
  }: {
    tokenIn: Token;
    amountIn: bigint;
    tokenOut: Token;
    amountOut: bigint;
  }): Promise<SwapResponse> => ({
    amountIn: String(amountIn),
    assumedAmountOut: String(amountOut),
    priceImpact: 0,
    status: RouteStatus.Success,
    swapPrice: 1,
    tokens: [tokenIn, tokenOut],
    tokenFrom: tokenIn,
    tokenTo: tokenOut,
    tx: {
      to: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      data: "0x",
      from: user,
      value: BigInt(0),
      gas: "1000000",
      gasPrice: 1000000000,
    },
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    actionProvider = new SushiRouterActionProvider();
    mockWallet = {
      readContract: jest.fn(),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getBalance: jest.fn(),
      getNetwork: jest.fn().mockResolvedValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
        chainId: String(chainId),
      }),
      getAddress: jest.fn().mockReturnValue(user),
    } satisfies Partial<
      jest.Mocked<ViemWalletProvider>
    > as unknown as jest.Mocked<ViemWalletProvider>;
  });

  describe("swap", () => {
    it("should successfully perform a swap (token -> token)", async () => {
      const args: Parameters<(typeof actionProvider)["swap"]>[1] = {
        amount: formatUnits(amountIn, tokenIn.decimals),
        fromAssetAddress: tokenIn.address,
        toAssetAddress: tokenOut.address,
        maxSlippage: 0.005,
      };

      /*
       * 1. Mock the readContract which checks the decimals of the fromAssetAddress token (18, default)
       * 2. Mock the readContract which checks for the balance of the fromAssetAddress token (1000000, enough balance)
       * 3. Mock the readContract which checks for the approval (0, not approved)
       */
      mockWallet.readContract
        .mockResolvedValueOnce(tokenIn.decimals)
        .mockResolvedValueOnce(amountIn)
        .mockResolvedValueOnce(BigInt(0));

      mockWallet.sendTransaction.mockResolvedValue(txHash);

      /*
       * 1. Mock the waitForTransactionReceipt to return success for the approval tx
       * 2. Mock the waitForTransactionReceipt to return success for the swap tx, including the Route log
       */
      mockWallet.waitForTransactionReceipt
        .mockResolvedValueOnce({
          status: "success",
        })
        .mockResolvedValueOnce({
          status: "success",
          logs: getRouteLog({
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
          }),
        });

      mockedGetSwap.mockReturnValue(
        getSuccessfullSwapResponse({
          tokenIn,
          amountIn,
          tokenOut,
          amountOut,
        }),
      );

      const result = await actionProvider.swap(mockWallet, args);

      expect(mockWallet.readContract).toHaveBeenCalledTimes(3); // Decimals + Balance + Approval
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2); // Approval + Swap
      expect(mockedGetSwap).toHaveBeenCalledTimes(2);

      expect(result).toContain(
        `Swapped ${formatUnits(amountIn, tokenIn.decimals)} of ${tokenIn.symbol} (${tokenIn.address}) for ${formatUnits(amountOut, tokenOut.decimals)} of ${tokenOut.symbol} (${tokenOut.address})`,
      );
      expect(result).toContain(`Transaction hash: ${txHash}`);
      expect(result).toContain(
        `Transaction link: ${getEvmChainById(chainId).getTransactionUrl(txHash)}`,
      );
      expect(result).toContain(`on ${getEvmChainById(chainId).shortName}`);
    });

    it("should successfully perform a swap (native -> token)", async () => {
      const args: Parameters<(typeof actionProvider)["swap"]>[1] = {
        amount: formatUnits(amountIn, tokenIn.decimals),
        fromAssetAddress: nativeToken.address,
        toAssetAddress: tokenOut.address,
        maxSlippage: 0.005,
      };

      // Mock the readContract which checks for the balance of the fromAssetAddress token (1000000, enough balance)
      mockWallet.getBalance.mockResolvedValue(amountIn);

      mockWallet.sendTransaction.mockResolvedValue(txHash);

      // Mock the waitForTransactionReceipt to return success for the swap tx, including the Route log
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
        logs: getRouteLog({
          tokenIn: nativeToken,
          tokenOut,
          amountIn,
          amountOut,
        }),
      });

      mockedGetSwap.mockReturnValue(
        getSuccessfullSwapResponse({
          tokenIn: nativeToken,
          amountIn,
          tokenOut,
          amountOut,
        }),
      );

      const result = await actionProvider.swap(mockWallet, args);

      expect(mockWallet.getBalance).toHaveBeenCalledTimes(1);
      expect(mockWallet.readContract).toHaveBeenCalledTimes(0); // No balance check nor approval
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1); // Swap
      expect(mockedGetSwap).toHaveBeenCalledTimes(2);

      expect(result).toContain(
        `Swapped ${formatUnits(amountIn, nativeToken.decimals)} of ${nativeToken.symbol} (${nativeToken.address}) for ${formatUnits(amountOut, tokenOut.decimals)} of ${tokenOut.symbol} (${tokenOut.address})`,
      );
      expect(result).toContain(`Transaction hash: ${txHash}`);
      expect(result).toContain(
        `Transaction link: ${getEvmChainById(chainId).getTransactionUrl(txHash)}`,
      );
      expect(result).toContain(`on ${getEvmChainById(chainId).shortName}`);
    });

    it("should fail if there isn't enough balance (native)", async () => {
      const args: Parameters<(typeof actionProvider)["swap"]>[1] = {
        amount: formatUnits(amountIn, tokenIn.decimals),
        fromAssetAddress: nativeToken.address,
        toAssetAddress: tokenOut.address,
        maxSlippage: 0.005,
      };

      // Mock the readContract which checks for the balance of the fromAssetAddress token (99, not enough balance)
      mockWallet.getBalance.mockResolvedValue(amountIn - BigInt(1));

      const result = await actionProvider.swap(mockWallet, args);

      expect(mockWallet.getBalance).toHaveBeenCalledTimes(1);
      expect(mockWallet.readContract).toHaveBeenCalledTimes(0);
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(0);
      expect(mockedGetSwap).toHaveBeenCalledTimes(1);

      expect(result).toContain(
        `Swap failed: Insufficient balance for ${nativeToken.symbol} (${nativeToken.address})`,
      );
    });

    it("should fail if there isn't enough balance (token)", async () => {
      const args: Parameters<(typeof actionProvider)["swap"]>[1] = {
        amount: formatUnits(amountIn, tokenIn.decimals),
        fromAssetAddress: tokenIn.address,
        toAssetAddress: tokenOut.address,
        maxSlippage: 0.005,
      };

      /*
       * 1. Mock the readContract which checks the decimals of the fromAssetAddress token (18, default)
       * 2. Mock the readContract which checks for the balance of the fromAssetAddress token (1000000, enough balance)
       */
      mockWallet.readContract.mockResolvedValueOnce(18).mockResolvedValue(amountIn - BigInt(1));

      mockedGetSwap.mockReturnValue(
        getSuccessfullSwapResponse({
          tokenIn,
          amountIn,
          tokenOut,
          amountOut,
        }),
      );

      const result = await actionProvider.swap(mockWallet, args);

      expect(mockWallet.getBalance).toHaveBeenCalledTimes(0);
      expect(mockWallet.readContract).toHaveBeenCalledTimes(2);
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(0);
      expect(mockedGetSwap).toHaveBeenCalledTimes(1);

      expect(result).toContain(
        `Swap failed: Insufficient balance for ${tokenIn.symbol} (${tokenIn.address})`,
      );
    });

    it("should not approve if already approved", async () => {
      const args: Parameters<(typeof actionProvider)["swap"]>[1] = {
        amount: formatUnits(amountIn, tokenIn.decimals),
        fromAssetAddress: tokenIn.address,
        toAssetAddress: tokenOut.address,
        maxSlippage: 0.005,
      };

      /*
       * 1. Mock the readContract which checks the decimals of the fromAssetAddress token (18, default)
       * 2. Mock the readContract which checks for the balance of the fromAssetAddress token (1000000, enough balance)
       * 3. Mock the readContract which checks for the approval (1000000, approved)
       */
      mockWallet.readContract
        .mockResolvedValueOnce(tokenIn.decimals)
        .mockResolvedValueOnce(amountIn)
        .mockResolvedValueOnce(amountIn);

      mockWallet.sendTransaction.mockResolvedValue(txHash);

      // Mock the waitForTransactionReceipt to return success for the swap tx, including the Route log
      mockWallet.waitForTransactionReceipt.mockResolvedValueOnce({
        status: "success",
        logs: getRouteLog({
          tokenIn,
          tokenOut,
          amountIn,
          amountOut,
        }),
      });

      mockedGetSwap.mockReturnValue(
        getSuccessfullSwapResponse({
          tokenIn,
          amountIn,
          tokenOut,
          amountOut,
        }),
      );
      const result = await actionProvider.swap(mockWallet, args);

      expect(mockWallet.getBalance).toHaveBeenCalledTimes(0);
      expect(mockWallet.readContract).toHaveBeenCalledTimes(3); // Decimals + Balance + Allowance
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1); // Swap
      expect(mockedGetSwap).toHaveBeenCalledTimes(2);

      expect(result).toContain(`Swapped`);
    });

    it("should fail if there's no route", async () => {
      const args: Parameters<(typeof actionProvider)["swap"]>[1] = {
        amount: formatUnits(amountIn, tokenIn.decimals),
        fromAssetAddress: tokenIn.address,
        toAssetAddress: tokenOut.address,
        maxSlippage: 0.005,
      };

      /*
       * 1. Mock the readContract which checks for decimals of the fromAssetAddress token (18, default)
       * 2. Mock the readContract which checks for the balance of the fromAssetAddress token (1000000, enough balance)
       */
      mockWallet.readContract
        .mockResolvedValueOnce(tokenIn.decimals)
        .mockResolvedValueOnce(amountIn);

      mockedGetSwap.mockReturnValue(
        new Promise(r =>
          r({
            status: RouteStatus.NoWay,
          }),
        ),
      );

      const result = await actionProvider.swap(mockWallet, args);

      expect(mockWallet.getBalance).toHaveBeenCalledTimes(0);
      expect(mockWallet.readContract).toHaveBeenCalledTimes(1); // Decimals
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(0);
      expect(mockedGetSwap).toHaveBeenCalledTimes(1);

      expect(result).toContain(
        `No route found to swap ${amountIn} of ${tokenIn.address} for ${tokenOut.address}`,
      );
    });
  });

  describe("quote", () => {
    it("should successfully fetch a quote (token -> token)", async () => {
      const args: Parameters<(typeof actionProvider)["quote"]>[1] = {
        amount: formatUnits(amountIn, tokenIn.decimals),
        fromAssetAddress: tokenIn.address,
        toAssetAddress: tokenOut.address,
      };

      mockedGetSwap.mockReturnValue(
        getSuccessfullSwapResponse({
          tokenIn,
          amountIn,
          tokenOut,
          amountOut,
        }),
      );

      const result = await actionProvider.quote(mockWallet, args);

      expect(mockedGetSwap).toHaveBeenCalledTimes(1);

      expect(result).toContain(
        `Found a quote for ${tokenIn.symbol} (${tokenIn.address}) -> ${tokenOut.symbol} (${tokenOut.address})`,
      );
      expect(result).toContain(`AmountIn: ${formatUnits(amountIn, tokenIn.decimals)}`);
      expect(result).toContain(`AmountOut: ${formatUnits(amountOut, tokenOut.decimals)}`);
    });
  });
});
