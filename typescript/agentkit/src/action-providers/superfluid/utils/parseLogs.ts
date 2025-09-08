import { SuperTokenFactoryABI } from "../constants";
import { decodeEventLog, getAddress, type Hex } from "viem";

type RawLog = {
  address: `0x${string}`;
  data: Hex;
  topics: readonly `0x${string}`[];
};

type TxReceipt = {
  to?: `0x${string}` | null;
  logs: RawLog[];
};

/**
 * Casts the topics to a tuple
 *
 * @param topics - the topics to search for
 * @returns - A tuple of topics
 */
function asTopicTuple(topics: readonly `0x${string}`[]): [`0x${string}`, ...`0x${string}`[]] {
  if (!topics.length) {
    throw new Error("Log has no topics (anonymous event?)");
  }
  return [topics[0], ...topics.slice(1)] as [`0x${string}`, ...`0x${string}`[]];
}

/**
 * Checks for records to avoid any cast
 *
 * @param value - The value to check
 * @returns - A boolean if the record is valid
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TOKEN_KEYS = ["token", "superToken", "proxy"] as const;
type TokenKey = (typeof TOKEN_KEYS)[number];

/**
 * Pulls a 0x-address string from decoded args under one of: token | superToken | proxy
 *
 * @param args - The unknown value to check
 * @returns - A contract address of the super token, or null
 */
function pickTokenLike(args: unknown): `0x${string}` | null {
  if (!isRecord(args)) return null;
  for (const key of TOKEN_KEYS) {
    const v = args[key as TokenKey];
    if (typeof v === "string" && v.startsWith("0x")) {
      return v as `0x${string}`;
    }
  }
  return null;
}

/**
 * Extracts the super token address using the contract abi
 *
 * @param receipt - the transaction receipt from creating the super token
 * @returns - The contract address of the created Super Token
 */
export function extractCreatedSuperTokenAddressAbi(receipt: TxReceipt): `0x${string}` {
  const factory = receipt.to?.toLowerCase();
  if (!factory) throw new Error("Missing receipt.to (factory address)");

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factory) continue;
    if (!log.topics.length) continue; // skip anonymous logs

    try {
      const { eventName, args } = decodeEventLog({
        abi: SuperTokenFactoryABI,
        data: log.data,
        topics: asTopicTuple(log.topics),
      });

      if (eventName === "SuperTokenCreated") {
        const token = pickTokenLike(args);
        if (!token) throw new Error("Token arg missing on SuperTokenCreated");
        return getAddress(token);
      }
    } catch {
      // not a matching event for this signature — ignore
    }
  }
  throw new Error("SuperTokenCreated not found on factory logs");
}
