import * as crypto from "node:crypto";

/**
 * Generate random keys for the agent.
 *
 * @returns Object containing random wallet and encryption keys
 */
function generateRandomKeys() {
  // This is used for development/testing only
  const randomBytes = crypto.randomBytes(32);
  const walletKey = `0x${randomBytes.toString("hex")}`;

  const randomBytesForEncryption = crypto.randomBytes(32);
  const encryptionKey = `0x${randomBytesForEncryption.toString("hex")}`;

  return { walletKey, encryptionKey };
}

/**
 * Main function to generate and display XMTP keys.
 */
async function main() {
  try {
    console.log("🔑 Generating random XMTP keys...\n");

    // Generate random keys
    const { walletKey, encryptionKey } = generateRandomKeys();

    console.log("📋 Your XMTP keys:");
    console.log(`WALLET_KEY=${walletKey}`);
    console.log(`ENCRYPTION_KEY=${encryptionKey}`);
    console.log("\n✨ Copy these keys and add them to your .env file");
  } catch (error) {
    console.error("❌ Error generating keys:", error);
    process.exit(1);
  }
}

// Call main directly since this is the entry point
main();
