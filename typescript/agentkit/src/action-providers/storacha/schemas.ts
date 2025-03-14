import { z } from "zod";

/**
 * Input schema for retrieving file stored on storacha.
 */
export const StorachaRetrieveFileSchema = z
    .object({})
    .strip()
    .describe("Input schema for retrieving file on storacha");

/**
 * Input schema for uploading file to storacha.
 */
export const StorachaUploadFilesSchema = z
    .object({})
    .strip()
    .describe("Input schema for uploading file on storacha");
