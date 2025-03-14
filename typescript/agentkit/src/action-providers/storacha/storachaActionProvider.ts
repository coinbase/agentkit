import { ActionProvider } from "../actionProvider";

import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
    StorachaRetrieveFileSchema,
    StorachaUploadFilesSchema,
} from "./schemas";
import { initStorachaClient } from "./client";
import type { Client } from "@storacha/client";

/**
 * Configuration options for the StorachaActionProvider.
 */
export interface StorachaActionProviderConfig {
    /**
     * Storacha Private Key
     */
    key?: string;

    /**
     * Storacha Space Proof
     */
    proof?: string;


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

        config.key ||= process.env.STORACHA_PRIVATE_KEY;
        config.proof ||= process.env.STORACHA_PROOF;

        if (!config.key) {
            throw new Error("STORACHA_PRIVATE_KEY is not configured.");
        }

        if (!config.proof) {
            throw new Error("STORACHA_PROOF is not configured.");
        }
        this.config = config;


    }



    private createGatewayUrl() {
        // TODO
    }

    private getClient = async () => {

        if (!this.client) {
            const { client } = await initStorachaClient({
                keyString: this.config.key!,
                proofString: this.config.proof!,
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
    [{"cid":"bafybeib"}]
`,
        schema: StorachaUploadFilesSchema,
    })
    async uploadFiles(args: z.infer<typeof StorachaUploadFilesSchema>): Promise<string> {

        // TODO

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