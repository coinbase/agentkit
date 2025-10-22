import {
  parseEther,
  encodeAbiParameters,
  encodeFunctionData,
  zeroAddress,
  Address,
  Hex,
  maxUint256,
  decodeEventLog,
  TransactionReceipt,
} from "viem";
import {
  FLETHAddress,
  FLETHHooksAddress,
  FlaunchPositionManagerV1_1Address,
  IV4RouterAbiExactInput,
  IV4RouterAbiExactOutput,
  V4Actions,
  URCommands,
  UNIVERSAL_ROUTER_ABI,
  POSITION_MANAGERV1_1_ABI,
  QuoterAddress,
  QUOTER_ABI,
  ERC20_ABI,
  UniversalRouterAddress,
} from "./constants";
import { BuySwapAmounts, SellSwapAmounts, PermitSingle, PoolSwapEventArgs } from "./types";
import { EvmWalletProvider } from "../../wallet-providers";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../../network";
import { formatEther } from "viem";

export const getAmountWithSlippage = (
  amount: bigint | undefined,
  slippage: string,
  swapType: "EXACT_IN" | "EXACT_OUT",
) => {
  if (amount == null) {
    return 0n;
  }

  const absAmount = amount < 0n ? -amount : amount;
  const slippageMultiplier =
    swapType === "EXACT_IN"
      ? BigInt(1e18) - parseEther(slippage)
      : BigInt(1e18) + parseEther(slippage);

  return (absAmount * slippageMultiplier) / BigInt(1e18);
};

const ETH = zeroAddress;

export const ethToMemecoin = (params: {
  sender: Address;
  memecoin: Address;
  chainId: number;
  referrer: Address | null;
  swapType: "EXACT_IN" | "EXACT_OUT";
  amountIn?: bigint; // Required for 'EXACT_IN' swap
  amountOutMin?: bigint; // Required for 'EXACT_IN' swap
  amountOut?: bigint; // Required for 'EXACT_OUT' swap
  amountInMax?: bigint; // Required for 'EXACT_OUT' swap
}) => {
  const flETH = FLETHAddress[params.chainId];
  const flETHHooks = FLETHHooksAddress[params.chainId];
  const flaunchHooks = FlaunchPositionManagerV1_1Address[params.chainId];

  // Determine actions based on swapType
  const v4Actions = ("0x" +
    (params.swapType === "EXACT_IN" ? V4Actions.SWAP_EXACT_IN : V4Actions.SWAP_EXACT_OUT) +
    V4Actions.SETTLE_ALL +
    V4Actions.TAKE_ALL) as Hex;

  // Initialize variables for path and v4Params
  let path;
  let v4Params;

  // Configure path and parameters based on swapType
  if (params.swapType === "EXACT_IN") {
    if (params.amountIn == null || params.amountOutMin == null) {
      throw new Error("amountIn and amountOutMin are required for EXACT_IN swap");
    }

    // Path for 'EXACT_IN' swap
    path = [
      {
        intermediateCurrency: flETH,
        fee: 0,
        tickSpacing: 60,
        hooks: flETHHooks,
        hookData: "0x" as Address,
      },
      {
        intermediateCurrency: params.memecoin,
        fee: 0,
        tickSpacing: 60,
        hooks: flaunchHooks,
        hookData: encodeAbiParameters(
          [{ type: "address", name: "referrer" }],
          [params.referrer ?? zeroAddress],
        ),
      },
    ];

    // Parameters for 'EXACT_IN' swap
    v4Params = encodeAbiParameters(IV4RouterAbiExactInput, [
      {
        currencyIn: ETH,
        path: path,
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMin,
      },
    ]);
  } else {
    if (params.amountOut == null || params.amountInMax == null) {
      throw new Error("amountOut and amountInMax are required for EXACT_OUT swap");
    }

    // Path for 'EXACT_OUT' swap
    path = [
      {
        fee: 0,
        tickSpacing: 60,
        hookData: "0x" as `0x${string}`,
        hooks: flETHHooks,
        intermediateCurrency: ETH,
      },
      {
        fee: 0,
        tickSpacing: 60,
        hooks: flaunchHooks,
        intermediateCurrency: flETH,
        hookData: encodeAbiParameters(
          [{ type: "address", name: "referrer" }],
          [params.referrer ?? zeroAddress],
        ) as `0x${string}`,
      },
    ];

    // Parameters for 'EXACT_OUT' swap
    v4Params = encodeAbiParameters(IV4RouterAbiExactOutput, [
      {
        currencyOut: params.memecoin,
        path: path,
        amountOut: params.amountOut,
        amountInMaximum: params.amountInMax,
      },
    ]);
  }

  // Common parameters for both swap types
  const settleParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "maxAmount",
      },
    ],
    [
      ETH,
      params.swapType === "EXACT_IN"
        ? (params.amountIn ?? maxUint256)
        : (params.amountInMax ?? maxUint256),
    ],
  );

  const takeParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "minAmount",
      },
    ],
    [
      params.memecoin,
      params.swapType === "EXACT_IN"
        ? (params.amountOutMin ?? maxUint256)
        : (params.amountOut ?? maxUint256),
    ],
  );

  // Encode router data
  const v4RouterData = encodeAbiParameters(
    [
      { type: "bytes", name: "actions" },
      { type: "bytes[]", name: "params" },
    ],
    [v4Actions, [v4Params, settleParams, takeParams]],
  );

  // Commands for Universal Router
  const urCommands = ("0x" + URCommands.V4_SWAP + URCommands.SWEEP) as Hex;
  const sweepInput = encodeAbiParameters(
    [
      { type: "address", name: "token" },
      { type: "address", name: "recipient" },
      { type: "uint160", name: "amountIn" },
    ],
    [ETH, params.sender, 0n],
  );

  // Encode calldata for Universal Router
  const inputs = [v4RouterData, sweepInput];
  const urExecuteCalldata = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [urCommands, inputs],
  });

  return {
    calldata: urExecuteCalldata,
    commands: urCommands,
    inputs,
  };
};

// @notice Before calling the UniversalRouter the user must have:
// Given the Permit2 contract allowance to spend the memecoin
export const memecoinToEthWithPermit2 = (params: {
  chainId: number;
  memecoin: Address;
  amountIn: bigint;
  ethOutMin: bigint;
  permitSingle: PermitSingle | undefined;
  signature: Hex | undefined;
  referrer: Address | null;
}) => {
  const flETH = FLETHAddress[params.chainId];

  const flETHHooks = FLETHHooksAddress[params.chainId];
  const flaunchHooks = FlaunchPositionManagerV1_1Address[params.chainId];
  const v4Actions = ("0x" +
    V4Actions.SWAP_EXACT_IN +
    V4Actions.SETTLE_ALL +
    V4Actions.TAKE_ALL) as Hex;
  const v4ExactInputParams = encodeAbiParameters(IV4RouterAbiExactInput, [
    {
      currencyIn: params.memecoin,
      path: [
        {
          intermediateCurrency: flETH,
          fee: 0,
          tickSpacing: 60,
          hooks: flaunchHooks,
          hookData: encodeAbiParameters(
            [
              {
                type: "address",
                name: "referrer",
              },
            ],
            [params.referrer ?? zeroAddress],
          ),
        },
        {
          intermediateCurrency: ETH,
          fee: 0,
          tickSpacing: 60,
          hooks: flETHHooks,
          hookData: "0x",
        },
      ],
      amountIn: params.amountIn,
      amountOutMinimum: params.ethOutMin,
    },
  ]);

  const settleParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "maxAmount",
      },
    ],
    [params.memecoin, params.amountIn],
  );

  const takeParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "minAmount",
      },
    ],
    [ETH, params.ethOutMin],
  );

  const v4RouterData = encodeAbiParameters(
    [
      { type: "bytes", name: "actions" },
      { type: "bytes[]", name: "params" },
    ],
    [v4Actions, [v4ExactInputParams, settleParams, takeParams]],
  );

  if (params.signature && params.permitSingle) {
    const urCommands = ("0x" + URCommands.PERMIT2_PERMIT + URCommands.V4_SWAP) as Hex;

    const permit2PermitInput = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            {
              type: "tuple",
              components: [
                { type: "address", name: "token" },
                { type: "uint160", name: "amount" },
                { type: "uint48", name: "expiration" },
                { type: "uint48", name: "nonce" },
              ],
              name: "details",
            },
            { type: "address", name: "spender" },
            { type: "uint256", name: "sigDeadline" },
          ],
          name: "PermitSingle",
        },
        { type: "bytes", name: "signature" },
      ],
      [params.permitSingle, params.signature],
    );

    const inputs = [permit2PermitInput, v4RouterData];
    const urExecuteCalldata = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [urCommands, inputs],
    });

    return {
      calldata: urExecuteCalldata,
      commands: urCommands,
      inputs,
    };
  } else {
    const urCommands = ("0x" + URCommands.V4_SWAP) as Hex;

    const inputs = [v4RouterData];
    const urExecuteCalldata = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [urCommands, inputs],
    });

    return {
      calldata: urExecuteCalldata,
      commands: urCommands,
      inputs,
    };
  }
};

export const getSwapAmountsFromLog = ({
  filteredPoolSwapEvent,
  coinAddress,
  chainId,
}: {
  filteredPoolSwapEvent: PoolSwapEventArgs;
  coinAddress: Address;
  chainId: number;
}): BuySwapAmounts | SellSwapAmounts => {
  const {
    flAmount0,
    flAmount1,
    flFee0,
    flFee1,
    ispAmount0,
    ispAmount1,
    ispFee0,
    ispFee1,
    uniAmount0,
    uniAmount1,
    uniFee0,
    uniFee1,
  } = filteredPoolSwapEvent;

  const currency0Delta = flAmount0 + ispAmount0 + uniAmount0;
  const currency1Delta = flAmount1 + ispAmount1 + uniAmount1;
  const currency0Fees = flFee0 + ispFee0 + uniFee0;
  const currency1Fees = flFee1 + ispFee1 + uniFee1;

  let feesIsInFLETH: boolean;
  let swapType: "BUY" | "SELL";
  const flETHIsCurrencyZero = coinAddress > FLETHAddress[chainId];

  if (flETHIsCurrencyZero) {
    swapType = currency0Delta < 0 ? "BUY" : "SELL";
    feesIsInFLETH = currency0Fees < 0;
  } else {
    swapType = currency1Delta < 0 ? "BUY" : "SELL";
    feesIsInFLETH = currency1Fees < 0;
  }

  const absCurrency0Delta = currency0Delta < 0 ? -currency0Delta : currency0Delta;
  const absCurrency1Delta = currency1Delta < 0 ? -currency1Delta : currency1Delta;
  const absCurrency0Fees = currency0Fees < 0 ? -currency0Fees : currency0Fees;
  const absCurrency1Fees = currency1Fees < 0 ? -currency1Fees : currency1Fees;

  const fees = {
    isInFLETH: feesIsInFLETH,
    amount: flETHIsCurrencyZero
      ? feesIsInFLETH
        ? absCurrency0Fees
        : absCurrency1Fees
      : feesIsInFLETH
        ? absCurrency1Fees
        : absCurrency0Fees,
  };

  if (swapType === "BUY") {
    return {
      coinsBought: flETHIsCurrencyZero
        ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
        : absCurrency0Delta - (!fees.isInFLETH ? fees.amount : 0n),
      ethSold: flETHIsCurrencyZero
        ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
        : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
    };
  } else {
    return {
      coinsSold: flETHIsCurrencyZero
        ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
        : absCurrency0Delta - (!fees.isInFLETH ? fees.amount : 0n),
      ethBought: flETHIsCurrencyZero
        ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
        : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
    };
  }
};

export const getSwapAmountsFromReceipt = ({
  receipt,
  coinAddress,
  chainId,
}: {
  receipt: TransactionReceipt;
  coinAddress: Address;
  chainId: number;
}) => {
  const filteredPoolSwapEvent = receipt.logs
    .map(log => {
      try {
        if (
          log.address.toLowerCase() !== FlaunchPositionManagerV1_1Address[chainId].toLowerCase()
        ) {
          return null;
        }

        const event = decodeEventLog({
          abi: POSITION_MANAGERV1_1_ABI,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "PoolSwap" ? event.args : null;
      } catch {
        return null;
      }
    })
    .filter((event): event is NonNullable<typeof event> => event !== null)[0];

  return getSwapAmountsFromLog({
    filteredPoolSwapEvent,
    coinAddress,
    chainId,
  });
};

/**
 * Buys a flaunch coin using ETH input.
 *
 * @param walletProvider - The wallet provider instance for blockchain interactions
 * @param coinAddress - The address of the coin to buy
 * @param swapType - The type of swap to perform
 * @param swapParams - The parameters for the swap
 * @param swapParams.amountIn - The amount of ETH to spend (for EXACT_IN)
 * @param swapParams.amountOut - The amount of coins to buy (for EXACT_OUT)
 * @param slippagePercent - The slippage percentage
 * @returns A promise that resolves to a string describing the transaction result
 */
export async function buyFlaunchCoin(
  walletProvider: EvmWalletProvider,
  coinAddress: string,
  swapType: "EXACT_IN" | "EXACT_OUT",
  swapParams: {
    amountIn?: string;
    amountOut?: string;
  },
  slippagePercent: number,
): Promise<string> {
  const network = walletProvider.getNetwork();
  const chainId = network.chainId;
  const networkId = network.networkId;

  if (!chainId || !networkId) {
    throw new Error("Chain ID is not set.");
  }

  try {
    let amountIn: bigint | undefined;
    let amountOutMin: bigint | undefined;
    let amountOut: bigint | undefined;
    let amountInMax: bigint | undefined;

    if (swapType === "EXACT_IN") {
      amountIn = parseEther(swapParams.amountIn!);

      const quoteResult = await walletProvider.getPublicClient().simulateContract({
        address: QuoterAddress[chainId],
        abi: QUOTER_ABI,
        functionName: "quoteExactInput",
        args: [
          {
            exactAmount: amountIn,
            exactCurrency: zeroAddress, // ETH
            path: [
              {
                fee: 0,
                tickSpacing: 60,
                hookData: "0x",
                hooks: FLETHHooksAddress[chainId],
                intermediateCurrency: FLETHAddress[chainId],
              },
              {
                fee: 0,
                tickSpacing: 60,
                hooks: FlaunchPositionManagerV1_1Address[chainId],
                hookData: "0x",
                intermediateCurrency: coinAddress,
              },
            ],
          },
        ],
      });
      amountOutMin = getAmountWithSlippage(
        quoteResult.result[0], // amountOut
        (slippagePercent / 100).toFixed(18).toString(),
        swapType,
      );
    } else {
      // EXACT_OUT
      amountOut = parseEther(swapParams.amountOut!);

      const quoteResult = await walletProvider.getPublicClient().simulateContract({
        address: QuoterAddress[chainId],
        abi: QUOTER_ABI,
        functionName: "quoteExactOutput",
        args: [
          {
            path: [
              {
                intermediateCurrency: zeroAddress,
                fee: 0,
                tickSpacing: 60,
                hookData: "0x",
                hooks: FLETHHooksAddress[chainId],
              },
              {
                intermediateCurrency: FLETHAddress[chainId],
                fee: 0,
                tickSpacing: 60,
                hooks: FlaunchPositionManagerV1_1Address[chainId],
                hookData: "0x",
              },
            ],
            exactCurrency: coinAddress as Address,
            exactAmount: amountOut,
          },
        ],
      });
      amountInMax = getAmountWithSlippage(
        quoteResult.result[0], // amountIn
        (slippagePercent / 100).toFixed(18).toString(),
        swapType,
      );
    }

    const { commands, inputs } = ethToMemecoin({
      sender: walletProvider.getAddress() as Address,
      memecoin: coinAddress as Address,
      chainId: Number(chainId),
      referrer: zeroAddress,
      swapType,
      amountIn,
      amountOutMin,
      amountOut,
      amountInMax,
    });

    const data = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [commands, inputs],
    });

    const hash = await walletProvider.sendTransaction({
      to: UniversalRouterAddress[chainId],
      data,
      value: swapType === "EXACT_IN" ? amountIn : amountInMax,
    });

    const receipt = await walletProvider.waitForTransactionReceipt(hash);
    const swapAmounts = getSwapAmountsFromReceipt({
      receipt,
      coinAddress: coinAddress as Address,
      chainId: Number(chainId),
    }) as BuySwapAmounts;

    const coinSymbol = await walletProvider.readContract({
      address: coinAddress as Address,
      abi: ERC20_ABI,
      functionName: "symbol",
    });

    return `Bought ${formatEther(swapAmounts.coinsBought)} $${coinSymbol} for ${formatEther(swapAmounts.ethSold)} ETH\n
      Tx hash: [${hash}](${NETWORK_ID_TO_VIEM_CHAIN[networkId].blockExplorers?.default.url}/tx/${hash})`;
  } catch (error) {
    return `Error buying coin: ${error}`;
  }
}
