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
  isDuplicate?: boolean;
}

/**
 * Zora coin metadata structure
 */
interface ZoraMetadata {
  name: string;
  description: string;
  symbol: string;
  image: string;
  content: {
    uri: string;
    mime: string;
  };
  properties: {
    category: string;
  };
}

/**
 * Parameters for generating token URI
 */
interface TokenUriParams {
  name: string;
  symbol: string;
  description: string;
  image: string; // A URI (https:// or ipfs://) or a data: URI
  category?: string;
  pinataConfig: PinataConfig;
}

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/**
 * Parses a base64-encoded data URI into its mime type and payload.
 *
 * @param dataUri - A data URI of the form `data:<mimeType>;base64,<data>`
 * @returns The decoded mime type and base64 payload
 */
function parseBase64DataUri(dataUri: string): { base64: string; mimeType: string } {
  const match = dataUri.match(/^data:([^;,]+);base64,([\s\S]*)$/);

  if (!match) {
    throw new Error(
      "Invalid data URI: expected the form `data:<mimeType>;base64,<data>` (e.g. data:image/png;base64,...).",
    );
  }

  return { mimeType: match[1], base64: match[2] };
}

/**
 * Uploads a file to IPFS using Pinata
 *
 * @param params - Configuration and file data
 * @param params.pinataConfig - Pinata configuration including JWT
 * @param params.fileData - Base64 encoded file data
 * @param params.fileName - Name for the uploaded file
 * @param params.mimeType - MIME type of the file
 * @returns Upload response with CID and other details
 */
async function uploadFileToIPFS(params: {
  pinataConfig: PinataConfig;
  fileData: string;
  fileName: string;
  mimeType: string;
}): Promise<UploadResponse> {
  try {
    const formData = new FormData();

    // Convert base64 to Blob and then to File
    const byteCharacters = atob(params.fileData);
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

    const blob = new Blob(byteArrays, { type: params.mimeType });
    const file = new File([blob], params.fileName, { type: params.mimeType });

    formData.append("file", file);

    const pinataMetadata = {
      name: params.fileName,
    };
    formData.append("pinataMetadata", JSON.stringify(pinataMetadata));

    const pinataOptions = {
      cidVersion: 1,
    };
    formData.append("pinataOptions", JSON.stringify(pinataOptions));

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.pinataConfig.jwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload file to IPFS: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      IpfsHash: data.IpfsHash,
      PinSize: data.PinSize,
      Timestamp: data.Timestamp,
      isDuplicate: data.isDuplicate || false,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload file to IPFS: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Uploads JSON data to IPFS using Pinata
 *
 * @param params - Configuration and JSON data
 * @param params.pinataConfig - Pinata configuration including JWT
 * @param params.json - JSON data to upload
 * @returns Upload response with CID and other details
 */
async function uploadJsonToIPFS(params: {
  pinataConfig: PinataConfig;
  json: ZoraMetadata;
}): Promise<UploadResponse> {
  try {
    const requestBody = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: `${params.json.name}-metadata.json`,
      },
      pinataContent: params.json,
    };

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.pinataConfig.jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload JSON to IPFS: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      IpfsHash: data.IpfsHash,
      PinSize: data.PinSize,
      Timestamp: data.Timestamp,
      isDuplicate: data.isDuplicate || false,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload JSON to IPFS: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generates a Zora token URI from a remote URI or a data URI
 *
 * @param params - Parameters for generating the token URI
 * @returns A promise that resolves to object containing the IPFS URI
 */
export async function generateZoraTokenUri(params: TokenUriParams): Promise<{
  uri: string;
  imageUri: string;
}> {
  try {
    let imageUri: string;

    // Check if image is already a URI (ipfs:// or https://)
    if (params.image.startsWith("ipfs://") || params.image.startsWith("https://")) {
      imageUri = params.image;
    } else if (params.image.startsWith("data:")) {
      // Handle inline image data. Local filesystem paths are intentionally not supported:
      // the image is uploaded to a third party and pinned to public IPFS, so reading
      // caller-supplied paths here would let an agent exfiltrate arbitrary host files.
      const { base64, mimeType } = parseBase64DataUri(params.image);
      const fileName = `${params.symbol}.${MIME_TO_EXTENSION[mimeType] ?? "bin"}`;

      const imageRes = await uploadFileToIPFS({
        pinataConfig: params.pinataConfig,
        fileData: base64,
        fileName,
        mimeType,
      });

      imageUri = `ipfs://${imageRes.IpfsHash}`;
    } else {
      throw new Error(
        "Invalid image: expected an https:// URL, an ipfs:// URI, or a data: URI. Reading " +
          "images from the local filesystem is not supported. To publish a local file, read " +
          'it yourself and pass a data URI, e.g. `data:image/png;base64,${fs.readFileSync(path, "base64")}`.',
      );
    }

    // Create and upload the metadata
    const metadata: ZoraMetadata = {
      name: params.name,
      description: params.description,
      symbol: params.symbol,
      image: imageUri,
      content: {
        uri: imageUri,
        mime:
          imageUri.startsWith("ipfs://") || imageUri.startsWith("https://")
            ? "image/*"
            : "image/png",
      },
      properties: {
        category: params.category || "social",
      },
    };

    const metadataRes = await uploadJsonToIPFS({
      pinataConfig: params.pinataConfig,
      json: metadata,
    });

    const uri = `ipfs://${metadataRes.IpfsHash}`;

    return { uri, imageUri };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate Zora token URI: ${error.message}`);
    }
    throw error;
  }
}
