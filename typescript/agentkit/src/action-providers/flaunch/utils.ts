import axios from "axios";

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
