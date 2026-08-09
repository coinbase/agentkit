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
 * True when hostname is a literal IP in a non-global range (loopback, RFC1918,
 * link-local/metadata, CGNAT, benchmarking). DNS rebinding is out of scope
 * here; hostname literals and https-only reduce the agent-tool SSRF surface.
 */
export function isBlockedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
  }

  // IPv6 unique-local / link-local
  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}

/**
 * Fail closed before fetching a remote token image (SSRF).
 * Only https:// with a non-blocked host is allowed.
 */
export function assertSafeRemoteImageUrl(imageUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error(`Invalid image URL: ${imageUrl}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Remote token images must use https://");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Image URL must not include credentials");
  }
  if (!parsed.hostname || isBlockedImageHost(parsed.hostname)) {
    throw new Error(`Image URL host is not allowed: ${parsed.hostname || "(empty)"}`);
  }
  return parsed;
}

/**
 * Resolve a local image path and require it to stay under process.cwd()
 * (realpath), so agent-supplied paths cannot read arbitrary files for IPFS.
 */
export function resolveSafeLocalImagePath(imageFileName: string): string {
  const root = fs.realpathSync(process.cwd());
  const resolved = path.resolve(root, imageFileName);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Local image path must be within the working directory");
  }
  const real = fs.realpathSync(resolved);
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error("Local image path escapes the working directory");
  }
  return real;
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
  const safePath = resolveSafeLocalImagePath(imageFileName);
  return new Promise((resolve, reject) => {
    fs.readFile(safePath, (err, data) => {
      if (err) {
        reject(new Error(`Failed to read file: ${err.message}`));
        return;
      }

      // Determine mime type based on file extension
      const extension = path.extname(safePath).toLowerCase();
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
    assertSafeRemoteImageUrl(imageUrl);
    // Do not follow redirects: Location could point at a blocked host after
    // the initial URL check.
    const response = await fetch(imageUrl, { redirect: "error" });

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
    // http:// rejected inside assertSafeRemoteImageUrl (https only).
    base64Image = await convertImageUrlToBase64(image);
  } else {
    // Local file: path must resolve under process.cwd().
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
