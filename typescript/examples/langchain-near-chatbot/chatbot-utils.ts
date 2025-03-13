import {
  getTestnetRpcProvider,
  getProviderByNetwork,
  getAccountState,
  getEndpointsByNetwork,
} from "@near-js/client";
import type { FinalExecutionOutcome } from "@near-js/types";
import { NEAR_MAINNET_NETWORK_ID, NEAR_NETWORK_ID } from "@coinbase/agentkit";

import * as readline from "readline";
import crypto from "node:crypto";

/**
 * Generates a random NEAR account ID.
 *
 * @returns Random NEAR account ID
 */
export function generateNearAccountId(): string {
  // Generate a random length between 10 and 32 using a cryptographically secure source.
  const length = getRandomInt(10, 32);
  const allowedChars = "abcdefghijklmnopqrstuvwxyz0123456789";

  // Function to get a random character from the given charset using crypto.getRandomValues.
  const getRandomChar = (charset: string) => {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    return charset[Math.floor((randomBuffer[0] / 2 ** 32) * charset.length)];
  };

  // Ensure the first character is a letter, the last is alphanumeric,
  // and generate the middle characters from the allowed set.
  const firstChar = getRandomChar("abcdefghijklmnopqrstuvwxyz");
  const middleChars = Array.from({ length: length - 2 }, () => getRandomChar(allowedChars)).join(
    "",
  );
  const lastChar = getRandomChar("abcdefghijklmnopqrstuvwxyz0123456789");

  return `${firstChar}${middleChars}${lastChar}.testnet`;
}

/**
 * Generates a random integer between min and max (inclusive) using crypto.getRandomValues.
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns A random integer between min and max
 */
function getRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  return min + (randomBuffer[0] % range);
}

/**
 * Returns the NEAR provider based on the network
 *
 * @param network
 * @returns NEAR provider
 */
export function getNearProvider(network: NEAR_NETWORK_ID): any {
  const rpcProvider =
    network === NEAR_MAINNET_NETWORK_ID
      ? getProviderByNetwork("mainnet")
      : getProviderByNetwork("testnet");
  return rpcProvider;
}

/**
 *
 * @param network
 */
export function getEndpointsByNetworkId(network: NEAR_NETWORK_ID): string {
  const nearNetwork = network === NEAR_MAINNET_NETWORK_ID ? "mainnet" : "testnet";
  return getEndpointsByNetwork(nearNetwork)[0];
}

/**
 *
 * @param network
 */
export function getNearKeyStoreKey(network: NEAR_NETWORK_ID): string {
  return network === NEAR_MAINNET_NETWORK_ID ? "mainnet" : "testnet";
}

/**
 * Choose the account to use for the chatbot
 *
 * @returns NEAR account ID
 */
export async function chooseAccount(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const accountId = await question("Enter your NEAR account ID (leave blank for a random one): ");

    if (accountId.trim().length === 0) {
      let generatedId: string;
      let exists: boolean;

      do {
        generatedId = generateNearAccountId();
        exists = await isRegisteredAccount(generatedId);
      } while (exists);

      console.log(`✅ No account ID provided. Generated NEAR account: ${generatedId}`);
      rl.close();
      return generatedId;
    } else {
      const exists = await isRegisteredAccount(accountId);
      if (!exists) {
        console.log(`✅ The account "${accountId}" is available and can be used.`);
        rl.close();
        return accountId;
      } else {
        console.log(
          `❌ The account "${accountId}" is already taken. Please enter a different account.`,
        );
      }
    }
  }
}

/**
 * Check if an account is already registered
 *
 * @param account
 * @returns True if the account is already registered, false otherwise
 */
export async function isRegisteredAccount(account: string) {
  try {
    await getAccountState({
      account,
      deps: {
        rpcProvider: getTestnetRpcProvider(),
      },
    });
  } catch (e: any) {
    if (e.type === "AccountDoesNotExist" || e.type === "RetriesExceeded") {
      return false;
    }
  }

  return true;
}

/**
 * Create a funded testnet account
 *
 * @param newAccountId - the new account ID
 * @param newPublicKey - the public key of the new account
 *
 * @returns the final outcome of the transaction
 */
export async function createFundedTestnetAccount(newAccountId: string, newPublicKey: string) {
  const NEAR_WALLET_FAUCET_URL = "https://near-faucet.io/api/faucet/accounts";

  const res = await fetch(NEAR_WALLET_FAUCET_URL, {
    method: "POST",
    body: JSON.stringify({
      newAccountId,
      newPublicKey,
    }),
    headers: { "Content-Type": "application/json" },
  });

  const { ok, status } = res;
  if (!ok) {
    throw new Error(`Failed to create account: ${status}`);
  }

  return (await res.json()) as FinalExecutionOutcome;
}
