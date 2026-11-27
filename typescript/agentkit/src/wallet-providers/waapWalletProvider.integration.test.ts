/**
 * Integration tests for WaapWalletProvider.
 *
 * These tests require a real waap-cli installation and valid credentials.
 * They are skipped by default. To run them, set the following environment
 * variables and remove the `.skip` from each `describe` block:
 *
 *   WAAP_CLI_PATH    - Path to the waap-cli binary (default: "waap-cli")
 *   WAAP_EMAIL       - WaaP account email
 *   WAAP_PASSWORD    - WaaP account password
 *   WAAP_CHAIN_ID    - EVM chain ID (default: "84532" for Base Sepolia)
 *   WAAP_RPC_URL     - RPC URL for the chain (optional)
 *
 * Run:
 *   WAAP_EMAIL=you@example.com WAAP_PASSWORD=secret
 *     npx jest --testMatch "**\/*.integration.test.ts" --no-cache
 */

import { WaapWalletProvider, WaapWalletProviderConfig } from "./waapWalletProvider";

const WAAP_CLI_PATH = process.env.WAAP_CLI_PATH ?? "waap-cli";
const WAAP_EMAIL = process.env.WAAP_EMAIL;
const WAAP_PASSWORD = process.env.WAAP_PASSWORD;
const WAAP_CHAIN_ID = process.env.WAAP_CHAIN_ID ?? "84532";
const WAAP_RPC_URL = process.env.WAAP_RPC_URL;

const canRun = Boolean(WAAP_EMAIL && WAAP_PASSWORD);

const describeIntegration = canRun ? describe : describe.skip;

describeIntegration("WaapWalletProvider integration", () => {
  let provider: WaapWalletProvider;

  const config: WaapWalletProviderConfig = {
    cliPath: WAAP_CLI_PATH,
    chainId: WAAP_CHAIN_ID,
    rpcUrl: WAAP_RPC_URL,
    email: WAAP_EMAIL,
    password: WAAP_PASSWORD,
  };

  // =========================================================
  // authentication & setup
  // =========================================================

  describe("authentication & setup", () => {
    it("should log in and create a provider via configureWithWallet", () => {
      provider = WaapWalletProvider.configureWithWallet(config);
      expect(provider).toBeInstanceOf(WaapWalletProvider);
    });
  });

  // =========================================================
  // wallet identity
  // =========================================================

  describe("wallet identity", () => {
    beforeAll(() => {
      provider = WaapWalletProvider.configureWithWallet(config);
    });

    it("should return a valid EVM address from getAddress", () => {
      const address = provider.getAddress();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should return the correct network", () => {
      const network = provider.getNetwork();
      expect(network.protocolFamily).toBe("evm");
      expect(network.chainId).toBe(WAAP_CHAIN_ID);
    });

    it("should return the provider name", () => {
      expect(provider.getName()).toBe("waap_wallet_provider");
    });
  });

  // =========================================================
  // balance
  // =========================================================

  describe("balance", () => {
    beforeAll(() => {
      provider = WaapWalletProvider.configureWithWallet(config);
    });

    it("should fetch balance (>= 0)", async () => {
      const balance = await provider.getBalance();
      expect(balance).toBeGreaterThanOrEqual(BigInt(0));
    });
  });

  // =========================================================
  // signing operations
  // =========================================================

  describe("signing", () => {
    beforeAll(() => {
      provider = WaapWalletProvider.configureWithWallet(config);
    });

    it("should sign a message and return a valid signature", async () => {
      const signature = await provider.signMessage("Hello from AgentKit integration test");
      expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);
      // ECDSA signature is 65 bytes = 130 hex chars + "0x" prefix
      expect(signature.length).toBe(132);
    });

    it("should sign typed data (EIP-712)", async () => {
      const typedData = {
        domain: {
          name: "AgentKit Integration Test",
          version: "1",
          chainId: Number(WAAP_CHAIN_ID),
        },
        types: {
          Greeting: [{ name: "text", type: "string" }],
        },
        primaryType: "Greeting",
        message: { text: "Hello" },
      };

      const signature = await provider.signTypedData(typedData);
      expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(signature.length).toBe(132);
    });

    it("should sign a raw hash", async () => {
      const hash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const signature = await provider.sign(hash);
      expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);
    });
  });

  // =========================================================
  // transaction flow (testnet only)
  // =========================================================

  describe("transaction flow", () => {
    beforeAll(() => {
      provider = WaapWalletProvider.configureWithWallet(config);
    });

    it("should sign a transaction without broadcasting", async () => {
      const address = provider.getAddress() as `0x${string}`;
      const signedTx = await provider.signTransaction({
        to: address, // self-transfer
        value: BigInt(0),
      });
      expect(signedTx).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    // This test sends a real 0-value transaction on testnet.
    // It requires the wallet to have gas funds on the configured chain.
    it(
      "should send a 0-value self-transfer and get a receipt",
      async () => {
        const address = provider.getAddress() as `0x${string}`;
        const balance = await provider.getBalance();

        // Skip if wallet has no gas
        if (balance === BigInt(0)) {
          console.warn("Skipping send-tx test: wallet has no balance for gas.");
          return;
        }

        const txHash = await provider.sendTransaction({
          to: address,
          value: BigInt(0),
        });
        expect(txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

        const receipt = await provider.waitForTransactionReceipt(txHash);
        expect(receipt).toBeDefined();
        expect(receipt.transactionHash).toBe(txHash);
      },
      60_000,
    );
  });

  // =========================================================
  // multi-agent isolation
  // =========================================================

  describe("multi-agent isolation via + email notation", () => {
    it("should create a separate wallet for a + alias email", () => {
      if (!WAAP_EMAIL) return;
      const [localPart, domain] = WAAP_EMAIL.split("@");
      const agentEmail = `${localPart}+agent-integration-test@${domain}`;

      try {
        const agentProvider = WaapWalletProvider.configureWithWallet({
          ...config,
          email: agentEmail,
        });

        const mainAddress = provider.getAddress();
        const agentAddress = agentProvider.getAddress();

        // Each + alias gets its own wallet, so addresses should differ
        expect(agentAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
        expect(agentAddress).not.toBe(mainAddress);
      } catch (error) {
        // Skip if the + alias account is not registered on the server
        const msg = (error as Error).message || "";
        if (msg.includes("401") || msg.includes("Invalid email")) {
          console.warn("Skipping: + alias account not registered on server");
          return;
        }
        throw error;
      }
    });
  });

  // =========================================================
  // contract reads
  // =========================================================

  describe("contract reads", () => {
    beforeAll(() => {
      provider = WaapWalletProvider.configureWithWallet(config);
    });

    it("should return a PublicClient for read-only operations", () => {
      const client = provider.getPublicClient();
      expect(client).toBeDefined();
    });
  });
});
