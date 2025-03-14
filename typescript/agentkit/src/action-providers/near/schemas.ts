import { z } from "zod";

import { NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID } from "../../network/near";
import { DEFAULT_KEY_VERSION, DEFAULT_PATH, SUPPORTED_ADDRESS_TYPES } from "./constants";

export const GetCrossChainAddressInput = z.object({
  accountId: z
    .string()
    .optional()
    .describe("The NEAR account id. If not provided, uses the wallet's default address."),
  networkId: z
    .enum([NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID])
    .optional()
    .describe(
      `The NEAR network. If not provided, uses the wallet's network id, which defaults to ${NEAR_MAINNET_NETWORK_ID}.`,
    ),
  path: z
    .string()
    .optional()
    .describe(
      `The derivation path to compute the public key, e.g. "Ethereum-1". If not provided, uses the default derivation path: "${DEFAULT_PATH}"`,
    ),
  addressType: z
    .string()
    .describe(
      "The address type based on the target chain and type of address for networks like Bitcoin and Ethereum (e.g., 'evm' or 'bitcoin-mainnet-legacy').",
    )
    .refine(val => SUPPORTED_ADDRESS_TYPES.includes(val as any), {
      message: `Unsupported address type. Supported address types are: ${SUPPORTED_ADDRESS_TYPES.join(", ")}`,
    }),
});

export const GetCrossChainPublicKeyInput = z.object({
  accountId: z
    .string()
    .optional()
    .describe("The NEAR account id. If not provided, uses the wallet's default address."),
  networkId: z
    .enum([NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID])
    .optional()
    .describe(
      `The NEAR network. If not provided, uses the wallet's network id, which defaults to ${NEAR_MAINNET_NETWORK_ID}.`,
    ),
  path: z
    .string()
    .optional()
    .describe(
      `The derivation path to compute the public key, e.g. "Ethereum-1". If not provided, uses the default derivation path: "${DEFAULT_PATH}"`,
    ),
});

export const SignPayloadInput = z.object({
  networkId: z
    .enum([NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID])
    .optional()
    .describe(
      `The NEAR network. If not provided, uses the wallet's network id, which defaults to ${NEAR_MAINNET_NETWORK_ID}.`,
    ),
  path: z
    .string()
    .optional()
    .describe(
      `The derivation path used to sign the payload. If not provided, uses the default derivation path: "${DEFAULT_PATH}"`,
    ),
  keyVersion: z
    .number()
    .optional()
    .describe(
      `The key version used to sign the payload. If not provided, uses the default key version: "${DEFAULT_KEY_VERSION}"`,
    ),
  payload: z.string().describe("The transaction data or message to be signed."),
});
