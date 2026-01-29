import { z } from "zod";
import { Hex, encodeFunctionData, toHex, decodeEventLog } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  RegisterAgentSchema,
  SetAgentRegistrationSchema,
  GetAgentIdentitySchema,
  SetMetadataSchema,
  GetMetadataSchema,
  RegisterAgentCompleteSchema,
} from "./identitySchemas";
import { getChainIdFromNetwork, getRegistryAddress, isNetworkSupported } from "./constants";
import { IDENTITY_REGISTRY_ABI } from "./abi";
import { PinataConfig, ipfsToHttpUrl } from "./utils";
import { uploadAgentRegistration } from "./utils_id";

/**
 * Configuration options for the ERC8004 Identity Action Provider
 */
export interface ERC8004IdentityActionProviderConfig {
  pinataJwt?: string;
}

/**
 * ERC8004IdentityActionProvider provides actions for the ERC-8004 Identity Registry.
 * This includes agent registration, URI management, and on-chain metadata.
 */
export class ERC8004IdentityActionProvider extends ActionProvider<EvmWalletProvider> {
  private pinataConfig?: PinataConfig;

  /**
   * Constructor for the ERC8004IdentityActionProvider.
   *
   * @param config - Optional configuration including Pinata JWT for IPFS uploads
   */
  constructor(config?: ERC8004IdentityActionProviderConfig) {
    super("erc8004_identity", []);
    if (config?.pinataJwt) {
      this.pinataConfig = { jwt: config.pinataJwt };
    }
  }

  /**
   * Registers a new agent by minting an agent NFT.
   * Use only when user provides no input at all.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param _args - Empty args (no input required)
   * @returns A message with the new agent ID
   */
  @CreateAction({
    name: "register_agent",
    description: `
Registers a new agent on the ERC-8004 Identity Registry by minting an agent NFT.
USE ONLY when user provides no input at all (no name, description, or image).

If the user provides any registration details (name, description, image), use register_agent_complete instead.

After registration, you will receive an agentId. You can then use set_agent_registration 
to upload metadata and set the URI on-chain.
`,
    schema: RegisterAgentSchema,
  })
  async registerAgent(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof RegisterAgentSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("identity", chainId);

      const hash = await walletProvider.sendTransaction({
        to: registryAddress,
        data: encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "register",
          args: [],
        }),
      });

      const receipt = await walletProvider.waitForTransactionReceipt(hash);

      // Parse the Registered event to get the agentId
      let agentId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: IDENTITY_REGISTRY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "Registered") {
            agentId = (decoded.args as unknown as { agentId: bigint }).agentId.toString();
            break;
          }
        } catch {
          // Not the event we're looking for
        }
      }

      if (!agentId) {
        return `Agent registered successfully! Transaction hash: ${hash}\nNote: Could not parse agentId from event logs. Check the transaction on a block explorer.`;
      }

      return `Agent registered successfully!\n\nAgent ID: ${agentId}\nNetwork: ${network.networkId}\nTransaction hash: ${hash}\n\nNext step: Use set_agent_registration with agentId "${agentId}" to upload metadata and set the URI on-chain.`;
    } catch (error) {
      return `Error registering agent: ${error}`;
    }
  }

  /**
   * Sets agent registration by uploading metadata to IPFS and setting the URI on-chain.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param args - Registration details including agentId and name
   * @returns A message with the registration details
   */
  @CreateAction({
    name: "set_agent_registration",
    description: `
Uploads registration metadata to IPFS and sets the agent URI on-chain in one action.
Use when you already have an agentId (from register_agent) and want to set its metadata.

Requires PINATA_JWT environment variable to be set.

The registration JSON follows the ERC-8004 specification and includes:
- type: The ERC-8004 registration type URI
- name: Your agent's name
- description: (optional) Your agent's description
- image: (optional) Image URL
- registrations: Array containing your agentId and registry address
`,
    schema: SetAgentRegistrationSchema,
  })
  async setAgentRegistration(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SetAgentRegistrationSchema>,
  ): Promise<string> {
    try {
      if (!this.pinataConfig) {
        return "Error: PINATA_JWT is required for IPFS uploads. Please configure the provider with a Pinata JWT.";
      }

      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("identity", chainId);

      // Step 1: Upload registration to IPFS
      const ipfsUri = await uploadAgentRegistration(this.pinataConfig, {
        agentId: parseInt(args.agentId, 10),
        chainId,
        registryAddress,
        name: args.name,
        description: args.description,
        image: args.image,
      });

      // Step 2: Set agent URI on-chain
      const hash = await walletProvider.sendTransaction({
        to: registryAddress,
        data: encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "setAgentURI",
          args: [BigInt(args.agentId), ipfsUri],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      const httpUrl = ipfsToHttpUrl(ipfsUri);

      return `Agent registration set successfully!\n\nAgent ID: ${args.agentId}\nName: ${args.name}\nMetadata URI: ${ipfsUri}\nHTTP Gateway: ${httpUrl}\nTransaction hash: ${hash}`;
    } catch (error) {
      return `Error setting agent registration: ${error}`;
    }
  }

  /**
   * Gets the identity information for an agent.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - The agentId to look up
   * @returns A message with the agent's owner and URI
   */
  @CreateAction({
    name: "get_agent_identity",
    description: `
Gets the owner and metadata URI for an agent from the ERC-8004 Identity Registry.
This is a read-only operation that doesn't require gas.
`,
    schema: GetAgentIdentitySchema,
  })
  async getAgentIdentity(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentIdentitySchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("identity", chainId);

      const owner = await walletProvider.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [BigInt(args.agentId)],
      });

      const uri = await walletProvider.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "tokenURI",
        args: [BigInt(args.agentId)],
      });

      const httpUrl = uri ? ipfsToHttpUrl(uri as string) : "Not set";

      return `Agent Identity\n\nAgent ID: ${args.agentId}\nOwner: ${owner}\nURI: ${uri || "Not set"}\nHTTP Gateway: ${httpUrl}`;
    } catch (error) {
      const errorStr = String(error);
      if (errorStr.includes("ERC721NonexistentToken")) {
        return `Agent ID ${args.agentId} does not exist on this network.`;
      }
      return `Error getting agent identity: ${error}`;
    }
  }

  /**
   * Sets an on-chain metadata key-value pair for an agent.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param args - The agentId, key, and value
   * @returns A message confirming the metadata was set
   */
  @CreateAction({
    name: "set_agent_metadata",
    description: `
Sets an on-chain key-value metadata entry for an agent.
Only the agent owner can set metadata.
The value is stored as bytes on-chain and can be used for
arbitrary data like endpoints, capabilities, or version info.
`,
    schema: SetMetadataSchema,
  })
  async setMetadata(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SetMetadataSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("identity", chainId);

      const valueBytes = toHex(args.value);

      const hash = await walletProvider.sendTransaction({
        to: registryAddress,
        data: encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "setMetadata",
          args: [BigInt(args.agentId), args.key, valueBytes],
        }),
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Metadata set successfully!\n\nAgent ID: ${args.agentId}\nKey: ${args.key}\nValue: ${args.value}\nTransaction hash: ${hash}`;
    } catch (error) {
      return `Error setting metadata: ${error}`;
    }
  }

  /**
   * Gets an on-chain metadata value for an agent.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - The agentId and key
   * @returns A message with the metadata value
   */
  @CreateAction({
    name: "get_agent_metadata",
    description: `
Gets an on-chain metadata value for an agent by key.
This is a read-only operation that doesn't require gas.
`,
    schema: GetMetadataSchema,
  })
  async getMetadata(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetMetadataSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("identity", chainId);

      const valueBytes = await walletProvider.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "getMetadata",
        args: [BigInt(args.agentId), args.key],
      });

      // Convert bytes back to string
      let value = "";
      if (valueBytes && (valueBytes as Hex) !== "0x") {
        const bytes = valueBytes as Hex;
        // Remove 0x prefix and convert hex to string
        const hexString = bytes.slice(2);
        for (let i = 0; i < hexString.length; i += 2) {
          const charCode = parseInt(hexString.slice(i, i + 2), 16);
          if (charCode !== 0) {
            value += String.fromCharCode(charCode);
          }
        }
      }

      return `Agent Metadata\n\nAgent ID: ${args.agentId}\nKey: ${args.key}\nValue: ${value || "(empty)"}`;
    } catch (error) {
      return `Error getting metadata: ${error}`;
    }
  }

  /**
   * Complete agent registration in one action (register + upload + set URI).
   *
   * @param walletProvider - The wallet provider to use
   * @param args - The agent name and optional description/image
   * @returns A message with the complete registration details
   */
  @CreateAction({
    name: "register_agent_complete",
    description: `
Complete agent registration in one action:
1. Registers a new agent (mints NFT)
2. Generates and uploads registration JSON to IPFS
3. Sets the agent URI onchain
`,
    schema: RegisterAgentCompleteSchema,
  })
  async registerAgentComplete(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RegisterAgentCompleteSchema>,
  ): Promise<string> {
    try {
      if (!this.pinataConfig) {
        return "Error: PINATA_JWT is required for complete registration. Please configure the provider with a Pinata JWT, or use register_agent followed by set_agent_registration.";
      }

      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const registryAddress = getRegistryAddress("identity", chainId);

      // Step 1: Register agent
      const registerHash = await walletProvider.sendTransaction({
        to: registryAddress,
        data: encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "register",
          args: [],
        }),
      });

      const receipt = await walletProvider.waitForTransactionReceipt(registerHash);

      // Parse the Registered event to get the agentId
      let agentId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: IDENTITY_REGISTRY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "Registered") {
            agentId = (decoded.args as unknown as { agentId: bigint }).agentId.toString();
            break;
          }
        } catch {
          // Not the event we're looking for
        }
      }

      if (!agentId) {
        return `Agent registered but could not parse agentId from event logs.\nRegister transaction: ${registerHash}\nPlease use get_agent_identity or check the transaction on a block explorer to find your agentId.`;
      }

      // Step 2: Upload registration to IPFS
      const ipfsUri = await uploadAgentRegistration(this.pinataConfig, {
        agentId: parseInt(agentId, 10),
        chainId,
        registryAddress,
        name: args.name,
        description: args.description,
        image: args.image,
      });

      // Step 3: Set agent URI
      const setUriHash = await walletProvider.sendTransaction({
        to: registryAddress,
        data: encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "setAgentURI",
          args: [BigInt(agentId), ipfsUri],
        }),
      });

      await walletProvider.waitForTransactionReceipt(setUriHash);

      const httpUrl = ipfsToHttpUrl(ipfsUri);

      return `Agent registration complete!\n\nAgent ID: ${agentId}\nName: ${args.name}\nNetwork: ${network.networkId}\n\nMetadata URI: ${ipfsUri}\nHTTP Gateway: ${httpUrl}\n\nTransactions:\n- Register: ${registerHash}\n- Set URI: ${setUriHash}`;
    } catch (error) {
      return `Error during complete registration: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True if the network is supported for ERC-8004
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && isNetworkSupported(network);
}

/**
 * Factory function to create an ERC8004IdentityActionProvider
 *
 * @param config - Optional configuration including Pinata JWT
 * @returns A new ERC8004IdentityActionProvider instance
 */
export const erc8004IdentityActionProvider = (config?: ERC8004IdentityActionProviderConfig) =>
  new ERC8004IdentityActionProvider(config);
