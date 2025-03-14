import {
    Signer,
    type DID as W3DID,
} from "@storacha/client/principal/ed25519";
import * as Proof from "@storacha/client/proof";
import type {
    Client,
    EmailAddress,
    FileLike,
    ProgressStatus,
} from "@storacha/client/types";

export type DownloadProgress = {
    percent: number;
    transferredBytes: number;

    /**
    Note: If it's not possible to retrieve the body size, it will be `0`.
    */
    totalBytes: number;
};

import * as DID from "@ipld/dag-ucan/did";
import type { ServiceAbility } from "@storacha/client/types";

import { create } from "@storacha/client";
import { StoreMemory } from "@storacha/client/stores/memory";

// enable sync methods
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

export type StorachaInitParams = {
    keyString: string;
    proofString: string;
    store?: StoreMemory;
};

export type FileParams<T> = {
    files: T[];
    uploadProgressCallback?: (data: DownloadProgress) => void;
};

//@ts-ignore
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export interface StorachaConfig {
    client: Client;
    spaceDid: W3DID;
}

// @w3ui use indexed DB with unextractable `CryptoKey`s.
// https://github.com/storacha/w3ui/blob/main/packages/core/src/index.ts#L69

export const createClient = async (options: any): Promise<Client> => {
    const store = new StoreMemory();

    const client = await create({
        ...options,
        store,
    });
    return client;
};

export const authWithEmail = async (client: Client, email: EmailAddress) => {
    const account = await client.login(email);

    return account;
};

export const listFiles = async ({ client, spaceDid }: StorachaConfig) => {
    await client.setCurrentSpace(spaceDid);
    return await client.capability.upload.list({ cursor: "", size: 25 });
};

export const uploadFiles = async (
    config: StorachaConfig,
    { files, uploadProgressCallback }: FileParams<FileLike>,
) => {
    const { client } = config;
    let link;
    const onUploadProgress = (progress: ProgressStatus) => {
        uploadProgressCallback?.({
            transferredBytes: progress.loaded,
            totalBytes: progress.total,
            percent: progress.loaded / progress.total,
        });
    };
    if (files.length == 1) {
        const [file] = files;
        link = await client.uploadFile(file, {
            onUploadProgress,
        });
    } else {
        // seems wont return actual progress
        link = await client.uploadDirectory(files, {
            onUploadProgress,
        });
    }

    if (uploadProgressCallback) {
        uploadProgressCallback({
            transferredBytes: link.byteLength,
            totalBytes: link.byteLength,
            percent: 1,
        });
    }
    return link;
};

export const createDelegation = async (
    config: StorachaConfig,
    {
        userDid,
    }: {
        userDid: string;
    },
) => {
    const { client } = config;

    const audience = DID.parse(userDid);

    const abilities = [
        "space/blob/add",
        "space/index/add",
        "filecoin/offer",
        "upload/add",
    ] as ServiceAbility[];
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours from now
    const delegation = await client.createDelegation(audience, abilities, {
        expiration,
    });

    const archive = await delegation.archive();
    return archive.ok;
};

export const initStorachaClient = async ({
    keyString,
    proofString,
    store = new StoreMemory(),
}: StorachaInitParams) => {
    const principal = Signer.parse(keyString);
    const client = await createClient({
        principal,
    });

    const proof = await Proof.parse(proofString);
    const space = await client.addSpace(proof);

    await client.setCurrentSpace(space.did());

    console.log(
        `storcha init: principal ${principal.did()} space ${space.did()}`,
    );

    return {
        client,
        space,
    };
};
