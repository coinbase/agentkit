import { ActionProvider } from "../actionProvider";

import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
    StorachaRetrieveFileSchema,
    StorachaUploadFilesSchema,
} from "./schemas";
import { initStorachaClient } from "./client";
import type { Client } from "@web3-storage/w3up-client/client";

/**
 * Configuration options for the StorachaActionProvider.
 */
export interface StorachaActionProviderConfig {
    /**
     * Storacha Agent Private Key
     */
    agentPrivateKey?: string;

    /**
     * Storacha Agent Delegation
     */
    agentDelegation?: string;

}


/**
 * StorachaActionProvider is an action provider for interacting with Storacha
 *
 * @augments ActionProvider
 */
export class StorachaActionProvider extends ActionProvider {

    private config: StorachaActionProviderConfig;
    private client?: Client;

    constructor(config: StorachaActionProviderConfig = {}) {
        super("storacha", []);

        config.agentPrivateKey ||= process.env.STORACHA_AGENT_PRIVATE_KEY;
        config.agentDelegation ||= process.env.STORACHA_AGENT_DELEGATION;



        if (!config.agentPrivateKey) {
            throw new Error("Agent private key is missing from the storage client configuration");
        }
        if (!config.agentDelegation) {
            throw new Error("Agent delegation is missing from the storage client configuration");
        }

        this.config = config;


    }



    private createGatewayUrl() {
        // TODO
    }

    // https://github.com/storacha/elizaos-plugin/blob/main/src/utils.ts#L8

    private getClient = async () => {

        if (!this.client) {
            const { client } = await initStorachaClient({
                privateKeyString: this.config.agentPrivateKey!,
                delegationString: this.config.agentDelegation!,
            });



            this.client = client;
        }

        return this.client;
    }


    /**
      * Upload Files to Storacha
      *
      * @param args - The arguments containing file path
      * @returns The root CID of the uploaded files
      */
    @CreateAction({
        name: "upload",
        description: `
This tool will upload files to Storacha

A successful response will return a message with root data CID for in the JSON payload:
    [{"cid":"bafybeib..."}]
`,
        schema: StorachaUploadFilesSchema,
    })
    async uploadFiles(args: z.infer<typeof StorachaUploadFilesSchema>): Promise<string> {

        // TODO

        // this.client.

        return '';
    }


    /**
 * Checks if the Storacha action provider supports the given network.
 * Storacha actions don't depend on blockchain networks, so always return true.
 *
 * @param _ - The network to check (not used)
 * @returns Always returns true as Storacha actions are network-independent
 */
    supportsNetwork(_: Network): boolean {
        return true;
    }

}