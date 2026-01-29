/**
 * Shared utilities for ERC-8004 action providers
 */

/**
 * Configuration for Pinata IPFS service
 */
export interface PinataConfig {
  jwt: string;
}

/**
 * Upload response from Pinata
 */
interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

/**
 * Uploads JSON data to IPFS using Pinata
 *
 * @param pinataConfig - Pinata configuration with JWT
 * @param json - The JSON object to upload
 * @param name - Name for the pinned content
 * @returns The IPFS hash (CID)
 */
export async function uploadJsonToIPFS(
  pinataConfig: PinataConfig,
  json: object,
  name: string,
): Promise<string> {
  const requestBody = {
    pinataOptions: {
      cidVersion: 1,
    },
    pinataMetadata: {
      name: `${name}.json`,
    },
    pinataContent: json,
  };

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataConfig.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to upload JSON to IPFS: ${error.message || response.statusText}`);
  }

  const data: PinataUploadResponse = await response.json();
  return data.IpfsHash;
}

/**
 * Uploads a file to IPFS using Pinata
 *
 * @param pinataConfig - Pinata configuration with JWT
 * @param fileData - Base64 encoded file data
 * @param fileName - Name for the file
 * @param mimeType - MIME type of the file
 * @returns The IPFS hash (CID)
 */
export async function uploadFileToIPFS(
  pinataConfig: PinataConfig,
  fileData: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const formData = new FormData();

  // Convert base64 to Blob and then to File
  const byteCharacters = atob(fileData);
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

  const blob = new Blob(byteArrays, { type: mimeType });
  const file = new File([blob], fileName, { type: mimeType });

  formData.append("file", file);

  const pinataMetadata = {
    name: fileName,
  };
  formData.append("pinataMetadata", JSON.stringify(pinataMetadata));

  const pinataOptions = {
    cidVersion: 1,
  };
  formData.append("pinataOptions", JSON.stringify(pinataOptions));

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataConfig.jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to upload file to IPFS: ${error.message || response.statusText}`);
  }

  const data: PinataUploadResponse = await response.json();
  return data.IpfsHash;
}

/**
 * Converts an IPFS URI to an HTTP gateway URL
 *
 * @param ipfsUri - The IPFS URI (ipfs://...)
 * @param gateway - The gateway to use (default: ipfs.io)
 * @returns The HTTP gateway URL
 */
export function ipfsToHttpUrl(ipfsUri: string, gateway = "ipfs.io"): string {
  if (!ipfsUri.startsWith("ipfs://")) {
    return ipfsUri;
  }
  const cid = ipfsUri.replace("ipfs://", "");
  return `https://${gateway}/ipfs/${cid}`;
}

/**
 * Formats a CAIP-10 address identifier
 *
 * @param chainId - The chain ID
 * @param address - The address
 * @returns CAIP-10 formatted string (e.g., "eip155:84532:0x1234...")
 */
export function formatCAIP10Address(chainId: number, address: string): string {
  return `eip155:${chainId}:${address}`;
}
