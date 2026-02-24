/**
 * Shared utilities for ERC-8004 action providers
 */

import {
  SDK as Agent0SDK,
  Agent as Agent0Agent,
  IDENTITY_REGISTRY_ABI as SDK_IDENTITY_ABI,
} from "agent0-sdk";
import type { RegistrationFile } from "agent0-sdk";
import { EvmWalletProvider } from "../../wallet-providers";
import { getChainIdFromNetwork } from "./constants";

/**
 * Configuration for Pinata IPFS service
 */
export interface PinataConfig {
  jwt: string;
}

/**
 * Creates an Agent0SDK instance from a wallet provider.
 *
 *
 * The wallet provider is bridged via {@link toEip1193Provider} so the SDK can
 * send transactions through agentkit's wallet abstraction (including smart wallets).
 *
 * @param walletProvider - The wallet provider to extract chain/RPC/signer from
 * @param pinataJwt - Optional Pinata JWT for IPFS uploads
 * @returns An initialized Agent0SDK instance
 * @throws Error if unable to determine RPC URL
 */
export function getAgent0SDK(walletProvider: EvmWalletProvider, pinataJwt?: string): Agent0SDK {
  const network = walletProvider.getNetwork();
  const chainId = getChainIdFromNetwork(network);

  const publicClient = walletProvider.getPublicClient();
  const rpcUrl = publicClient.transport.url;

  if (!rpcUrl) {
    throw new Error("Unable to determine RPC URL from wallet provider");
  }

  return new Agent0SDK({
    chainId,
    rpcUrl,
    walletProvider: walletProvider.toEip1193Provider(),
    ...(pinataJwt ? { ipfs: "pinata" as const, pinataJwt } : {}),
  });
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
 * Encodes a JSON object as a base64-encoded data: URI.
 *
 * Per ERC-8004 spec this is a valid agentURI for fully on-chain metadata:
 *   data:application/json;base64,eyJ0eXBlIjoi...
 *
 * @param json - The JSON-serialisable object
 * @returns A data URI string
 */
export function jsonToDataUri(json: object): string {
  const jsonString = JSON.stringify(json);
  const base64 = Buffer.from(jsonString).toString("base64");
  return `data:application/json;base64,${base64}`;
}

/**
 * Decodes a base64-encoded data: URI back to a JSON object.
 *
 * @param dataUri - A data URI of the form data:application/json;base64,...
 * @returns The decoded JSON object
 */
export function dataUriToJson<T = Record<string, unknown>>(dataUri: string): T {
  const match = dataUri.match(/^data:application\/json;base64,(.+)$/);
  if (!match) {
    throw new Error(
      `Invalid data URI: expected data:application/json;base64,... but got: ${dataUri.slice(0, 60)}`,
    );
  }
  const jsonString = Buffer.from(match[1], "base64").toString("utf-8");
  return JSON.parse(jsonString) as T;
}

/**
 * Loads an agent via the SDK. Falls back to reading a data: URI from the
 * contract and constructing the Agent manually (the SDK cannot read data URIs).
 *
 * @param sdk - The Agent0SDK instance
 * @param walletProvider - The wallet provider used to read the contract
 * @param fullAgentId - The fully-qualified agent ID (chainId:tokenId)
 * @param tokenId - The numeric token ID string
 * @returns The loaded or hydrated Agent0Agent instance
 */
export async function loadOrHydrateAgent(
  sdk: ReturnType<typeof getAgent0SDK>,
  walletProvider: EvmWalletProvider,
  fullAgentId: string,
  tokenId: string,
): Promise<Agent0Agent> {
  try {
    return await sdk.loadAgent(fullAgentId);
  } catch {
    // loadAgent fails for data: URIs — hydrate manually
  }

  const registryAddress = sdk.identityRegistryAddress();
  const tokenUri = (await walletProvider.readContract({
    address: registryAddress as `0x${string}`,
    abi: SDK_IDENTITY_ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  })) as string;

  let regFile: RegistrationFile;
  if (tokenUri && tokenUri.startsWith("data:")) {
    const decoded = dataUriToJson<Record<string, unknown>>(tokenUri);
    regFile = {
      name: (decoded.name as string) || "",
      description: (decoded.description as string) || "",
      image: decoded.image as string | undefined,
      endpoints: (decoded.endpoints as RegistrationFile["endpoints"]) || [],
      trustModels: (decoded.trustModels as RegistrationFile["trustModels"]) || [],
      owners: (decoded.owners as string[]) || [],
      operators: (decoded.operators as string[]) || [],
      active: (decoded.active as boolean) ?? false,
      x402support: (decoded.x402support as boolean) ?? false,
      metadata: (decoded.metadata as Record<string, unknown>) || {},
      updatedAt: (decoded.updatedAt as number) || Math.floor(Date.now() / 1000),
      agentId: fullAgentId,
      agentURI: tokenUri,
    };
  } else {
    regFile = {
      name: "",
      description: "",
      endpoints: [],
      trustModels: [],
      owners: [],
      operators: [],
      active: false,
      x402support: false,
      metadata: {},
      updatedAt: Math.floor(Date.now() / 1000),
      agentId: fullAgentId,
    };
  }

  return new Agent0Agent(sdk, regFile);
}
