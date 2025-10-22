import fs from "fs";
import path from "path";

/**
 * Upload response from Flaunch API
 */
interface UploadResponse {
  IpfsHash: string;
  tokenURI: string;
}

interface CoinMetadata {
  name: string;
  symbol: string;
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
}

interface TokenUriParams {
  metadata: {
    image: string;
    description: string;
    websiteUrl?: string;
    discordUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
  };
}

/**
 * Reads a local file and converts it to base64
 *
 * @param imageFileName - Path to the local file
 * @returns Base64 encoded file and mime type
 */
async function readFileAsBase64(
  imageFileName: string,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    fs.readFile(imageFileName, (err, data) => {
      if (err) {
        reject(new Error(`Failed to read file: ${err.message}`));
        return;
      }

      // Determine mime type based on file extension
      const extension = path.extname(imageFileName).toLowerCase();
      let mimeType = "application/octet-stream"; // default

      if (extension === ".png") mimeType = "image/png";
      else if (extension === ".jpg" || extension === ".jpeg") mimeType = "image/jpeg";
      else if (extension === ".gif") mimeType = "image/gif";
      else if (extension === ".svg") mimeType = "image/svg+xml";

      const base64 = data.toString("base64");
      resolve({ base64, mimeType });
    });
  });
}

/**
 * Uploads a base64 image to IPFS using Flaunch API
 * Rate Limit: Maximum 4 image uploads per minute per IP address
 *
 * @param params - Configuration and base64 image data
 * @param params.base64Image - Base64 encoded image data
 * @param params.name - Optional name for the uploaded file
 * @param params.metadata - Optional metadata key-value pairs
 * @returns Upload response with CID and other details
 */
const uploadImageToIPFS = async (params: {
  base64Image: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<UploadResponse> => {
  try {
    const response = await fetch("https://web2-api.flaunch.gg/api/v1/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64Image: params.base64Image }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload image to IPFS: ${error.message || response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Failed to upload image to IPFS: ${data.error || "Unknown error"}`);
    }

    return {
      IpfsHash: data.ipfsHash,
      tokenURI: data.tokenURI,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload image to IPFS: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Uploads JSON data to IPFS using Flaunch API
 *
 * @param params - Configuration and JSON data
 * @param params.json - JSON data to upload
 * @param params.name - Optional name for the uploaded file
 * @param params.metadata - Optional metadata key-value pairs
 * @returns Upload response with CID and other details
 */
const uploadJsonToIPFS = async (params: {
  json: Record<string, unknown> | CoinMetadata;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<UploadResponse> => {
  try {
    const response = await fetch("https://web2-api.flaunch.gg/api/v1/upload-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: params.json.name,
        symbol: params.json.symbol,
        description: params.json.description,
        imageIpfs: params.json.image,
        websiteUrl: params.json.external_link,
        discordUrl: params.json.discordUrl,
        twitterUrl: params.json.twitterUrl,
        telegramUrl: params.json.telegramUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload JSON to IPFS: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Failed to upload metadata: ${data.error}`);
    }

    return {
      IpfsHash: data.ipfsHash,
      tokenURI: data.tokenURI,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload JSON to IPFS: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Converts a remote image URL to a properly formatted base64 data URL
 *
 * @param imageUrl - URL of the image to fetch and convert
 * @returns Base64 data URL with proper MIME type detection
 */
const convertImageUrlToBase64 = async (imageUrl: string): Promise<string> => {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    // Detect MIME type from response headers
    const contentType = response.headers.get("content-type");
    let mimeType = "image/jpeg"; // default fallback

    if (contentType && contentType.startsWith("image/")) {
      mimeType = contentType;
    } else {
      // Try to detect from URL extension as fallback
      const urlLower = imageUrl.toLowerCase();
      if (urlLower.includes(".png")) {
        mimeType = "image/png";
      } else if (urlLower.includes(".gif")) {
        mimeType = "image/gif";
      } else if (urlLower.includes(".webp")) {
        mimeType = "image/webp";
      } else if (urlLower.includes(".svg")) {
        mimeType = "image/svg+xml";
      }
    }

    return `data:${mimeType};base64,${base64Data}`;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to convert image URL to base64: ${error.message}`);
    }
    throw error;
  }
};

const generateTokenUriBase64Image = async (name: string, symbol: string, params: IPFSParams) => {
  // 1. upload image to IPFS
  const imageRes = await uploadImageToIPFS({
    base64Image: params.metadata.base64Image,
  });

  // 2. upload metadata to IPFS
  const coinMetadata: CoinMetadata = {
    name,
    symbol,
    description: params.metadata.description,
    image: `ipfs://${imageRes.IpfsHash}`,
    external_link: params.metadata.websiteUrl || "",
    collaborators: [],
    discordUrl: params.metadata.discordUrl || "",
    twitterUrl: params.metadata.twitterUrl || "",
    telegramUrl: params.metadata.telegramUrl || "",
  };

  const metadataRes = await uploadJsonToIPFS({
    json: coinMetadata,
  });

  return `ipfs://${metadataRes.IpfsHash}`;
};

export const generateTokenUri = async (name: string, symbol: string, params: TokenUriParams) => {
  // 1. get base64Image from image (url or local path)
  let base64Image: string;
  const image = params.metadata.image;

  if (image.startsWith("https://") || image.startsWith("http://")) {
    base64Image = await convertImageUrlToBase64(image);
  } else {
    // assume local file
    const { base64, mimeType } = await readFileAsBase64(image);
    base64Image = `data:${mimeType};base64,${base64}`;
  }

  // 2. generate token uri
  const tokenUri = await generateTokenUriBase64Image(name, symbol, {
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
