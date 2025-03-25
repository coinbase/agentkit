import axios from "axios";
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
  FlaunchPositionManagerAddress,
  IV4RouterAbiExactInput,
  IV4RouterAbiExactOutput,
  V4Actions,
  URCommands,
  UNIVERSAL_ROUTER_ABI,
  POSITION_MANAGER_ABI,
} from "./constants";
import { PoolSwapEventArgs } from "./types";

/**
 * Configuration for Pinata
 */
interface PinataConfig {
  jwt: string;
}

/**
 * Upload response from Pinata
 */
interface UploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate: boolean;
}

interface CoinMetadata {
  name: string;
  description: string;
  image: string;
  external_link: string;
  collaborators: string[];
  discordUrl: string;
  twitterUrl: string;
  telegramUrl: string;
}

interface IPFSParams {
  metadata: {
    base64Image: string;
    description: string;
    websiteUrl?: string;
    discordUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
  };
  pinataConfig: PinataConfig;
}

interface TokenUriParams {
  metadata: {
    imageUrl: string;
    description: string;
    websiteUrl?: string;
    discordUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
  };
  pinataConfig: PinataConfig;
}

/**
 * Uploads a base64 image to IPFS using Pinata
 *
 * @param params - Configuration and base64 image data
 * @param params.pinataConfig - Pinata configuration including JWT
 * @param params.base64Image - Base64 encoded image data
 * @param params.name - Optional name for the uploaded file
 * @param params.metadata - Optional metadata key-value pairs
 * @returns Upload response with CID and other details
 */
const uploadImageToIPFS = async (params: {
  pinataConfig: PinataConfig;
  base64Image: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<UploadResponse> => {
  try {
    const formData = new FormData();

    // Convert base64 to Blob and then to File
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = params.base64Image.split(",")[1] || params.base64Image;
    const byteCharacters = atob(base64Data);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    // Detect mime type from base64 string
    let mimeType = "image/png"; // default
    if (params.base64Image.startsWith("data:")) {
      mimeType = params.base64Image.split(";")[0].split(":")[1];
    }

    const blob = new Blob(byteArrays, { type: mimeType });
    const fileName = params.name || `image.${mimeType.split("/")[1]}`;
    const file = new File([blob], fileName, { type: mimeType });

    formData.append("file", file);

    const pinataMetadata = {
      name: params.name || null,
      keyvalues: params.metadata || {},
    };
    formData.append("pinataMetadata", JSON.stringify(pinataMetadata));

    const pinataOptions = {
      cidVersion: 1,
    };
    formData.append("pinataOptions", JSON.stringify(pinataOptions));

    const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
      headers: {
        Authorization: `Bearer ${params.pinataConfig.jwt}`,
        "Content-Type": "multipart/form-data",
      },
    });

    return {
      IpfsHash: response.data.IpfsHash,
      PinSize: response.data.PinSize,
      Timestamp: response.data.Timestamp,
      isDuplicate: response.data.isDuplicate || false,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to upload image to IPFS: ${error.response?.data?.message || error.message}`,
      );
    }
    throw error;
  }
};

/**
 * Uploads JSON data to IPFS using Pinata
 *
 * @param params - Configuration and JSON data
 * @param params.pinataConfig - Pinata configuration including JWT
 * @param params.json - JSON data to upload
 * @param params.name - Optional name for the uploaded file
 * @param params.metadata - Optional metadata key-value pairs
 * @returns Upload response with CID and other details
 */
const uploadJsonToIPFS = async (params: {
  pinataConfig: PinataConfig;
  json: Record<string, unknown> | CoinMetadata;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<UploadResponse> => {
  try {
    const requestBody = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: params.name || null,
        keyvalues: params.metadata || {},
      },
      pinataContent: params.json,
    };

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${params.pinataConfig.jwt}`,
          "Content-Type": "application/json",
        },
      },
    );

    return {
      IpfsHash: response.data.IpfsHash,
      PinSize: response.data.PinSize,
      Timestamp: response.data.Timestamp,
      isDuplicate: response.data.isDuplicate || false,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to upload JSON to IPFS: ${error.response?.data?.message || error.message}`,
      );
    }
    throw error;
  }
};

const generateTokenUriBase64Image = async (name: string, params: IPFSParams) => {
  // 1. upload image to IPFS
  const imageRes = await uploadImageToIPFS({
    pinataConfig: params.pinataConfig,
    base64Image: params.metadata.base64Image,
  });

  // 2. upload metadata to IPFS
  const coinMetadata: CoinMetadata = {
    name,
    description: params.metadata.description,
    image: `ipfs://${imageRes.IpfsHash}`,
    external_link: params.metadata.websiteUrl || "",
    collaborators: [],
    discordUrl: params.metadata.discordUrl || "",
    twitterUrl: params.metadata.twitterUrl || "",
    telegramUrl: params.metadata.telegramUrl || "",
  };

  const metadataRes = await uploadJsonToIPFS({
    pinataConfig: params.pinataConfig,
    json: coinMetadata,
  });

  return `ipfs://${metadataRes.IpfsHash}`;
};

export const generateTokenUri = async (name: string, params: TokenUriParams) => {
  // 1. get base64Image from imageUrl
  const imageRes = await axios.get(params.metadata.imageUrl, {
    responseType: "arraybuffer",
  });
  const base64Image = Buffer.from(imageRes.data).toString("base64");

  // 2. generate token uri
  const tokenUri = await generateTokenUriBase64Image(name, {
    pinataConfig: params.pinataConfig,
    metadata: {
      base64Image,
      description: params.metadata.description,
      websiteUrl: params.metadata.websiteUrl,
      discordUrl: params.metadata.discordUrl,
      twitterUrl: params.metadata.twitterUrl,
      telegramUrl: params.metadata.telegramUrl,
    },
  });

  return tokenUri;
};

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
  const flaunchHooks = FlaunchPositionManagerAddress[params.chainId];

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

export const getBuyAmountsFromLog = ({
  filteredPoolSwapEvent,
  coinAddress,
  chainId,
}: {
  filteredPoolSwapEvent: PoolSwapEventArgs;
  coinAddress: Address;
  chainId: number;
}) => {
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
  const flETHIsCurrencyZero = coinAddress > FLETHAddress[chainId];

  if (flETHIsCurrencyZero) {
    feesIsInFLETH = currency0Fees < 0;
  } else {
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

  const coinsBought = flETHIsCurrencyZero
    ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
    : absCurrency0Delta - (!fees.isInFLETH ? fees.amount : 0n);
  const ethSold = flETHIsCurrencyZero
    ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
    : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n);

  return {
    coinsBought,
    ethSold,
  };
};

export const getBuyAmountsFromReceipt = ({
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
        if (log.address.toLowerCase() !== FlaunchPositionManagerAddress[chainId].toLowerCase()) {
          return null;
        }

        const event = decodeEventLog({
          abi: POSITION_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "PoolSwap" ? event.args : null;
      } catch {
        return null;
      }
    })
    .filter((event): event is NonNullable<typeof event> => event !== null)[0];

  return getBuyAmountsFromLog({
    filteredPoolSwapEvent,
    coinAddress,
    chainId,
  });
};
