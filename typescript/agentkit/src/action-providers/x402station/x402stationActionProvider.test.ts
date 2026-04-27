import { X402stationActionProvider } from "./x402stationActionProvider";
import { WatchSubscribeSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const mockFetchWithPayment = jest.fn();
const mockX402Client = { registerScheme: jest.fn() };

jest
  .mocked(x402Client)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);
jest
  .mocked(registerExactEvmScheme)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);

const mockFetch = jest.fn();
global.fetch = mockFetch;

const buildMockEvmWallet = (): EvmWalletProvider =>
  ({
    toSigner: () => ({
      address: "0x30d2b1f9bcEdE5F13136b56Ff199A8ad6E4f50de",
      signTypedData: jest.fn(),
    }),
    readContract: jest.fn(),
    getName: () => "mock",
    getAddress: () => "0x30d2b1f9bcEdE5F13136b56Ff199A8ad6E4f50de",
    getNetwork: (): Network => ({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
  }) as unknown as EvmWalletProvider;

describe("X402stationActionProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("uses the canonical x402station.io URL by default", () => {
      const provider = new X402stationActionProvider();
      expect((provider as unknown as { baseUrl: string }).baseUrl).toBe(
        "https://x402station.io",
      );
    });

    it("accepts an http(s)://localhost dev URL", () => {
      const p1 = new X402stationActionProvider({ baseUrl: "http://localhost:3002" });
      expect((p1 as unknown as { baseUrl: string }).baseUrl).toBe(
        "http://localhost:3002",
      );
      const p2 = new X402stationActionProvider({ baseUrl: "http://127.0.0.1:9999" });
      expect((p2 as unknown as { baseUrl: string }).baseUrl).toBe(
        "http://127.0.0.1:9999",
      );
    });

    it("strips trailing slashes from the configured URL", () => {
      const provider = new X402stationActionProvider({
        baseUrl: "https://x402station.io///",
      });
      expect((provider as unknown as { baseUrl: string }).baseUrl).toBe(
        "https://x402station.io",
      );
    });

    it("rejects a non-canonical, non-localhost URL", () => {
      expect(() => new X402stationActionProvider({ baseUrl: "https://evil.example" })).toThrow(
        /baseUrl must be/i,
      );
    });

    it("rejects a malformed URL", () => {
      expect(() => new X402stationActionProvider({ baseUrl: "not a url" })).toThrow(
        /not a valid URL/i,
      );
    });

    it("does not let a non-default port bypass the canonical check", () => {
      // u.hostname strips ports, u.host keeps them — the implementation
      // must use u.host so this case fails. (Mirrors the x402station-mcp
      // 2026-04-26 audit finding M-2.)
      expect(
        () => new X402stationActionProvider({ baseUrl: "https://x402station.io:9999" }),
      ).toThrow(/baseUrl must be/i);
    });

    it("accepts IPv6 loopback dev URL [::1] (Greptile P2)", () => {
      const provider = new X402stationActionProvider({ baseUrl: "http://[::1]:3002" });
      expect((provider as unknown as { baseUrl: string }).baseUrl).toBe("http://[::1]:3002");
    });

    it("rejects localhost.attacker.com (CodeRabbit: prefix-match bypass)", () => {
      // u.host.startsWith("localhost") would PASS this attacker domain.
      // Implementation must use u.hostname exact-match.
      expect(
        () => new X402stationActionProvider({ baseUrl: "http://localhost.attacker.com" }),
      ).toThrow(/baseUrl must be/i);
    });

    it("rejects 127.0.0.1.evil.example (CodeRabbit: prefix-match bypass)", () => {
      expect(
        () => new X402stationActionProvider({ baseUrl: "http://127.0.0.1.evil.example" }),
      ).toThrow(/baseUrl must be/i);
    });

    it("rejects localhost-impersonation suffixes", () => {
      expect(
        () => new X402stationActionProvider({ baseUrl: "http://localhost-evil.example" }),
      ).toThrow(/baseUrl must be/i);
    });
  });

  describe("supportsNetwork", () => {
    const provider = new X402stationActionProvider();

    it("returns true for Base mainnet", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
          chainId: "8453",
        }),
      ).toBe(true);
    });

    it("returns true for Base Sepolia", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-sepolia",
          chainId: "84532",
        }),
      ).toBe(true);
    });

    it("returns false for Ethereum mainnet", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
          chainId: "1",
        }),
      ).toBe(false);
    });

    it("returns false for non-EVM networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "svm",
          networkId: "solana-mainnet",
          chainId: "mainnet",
        }),
      ).toBe(false);
    });
  });

  describe("preflight", () => {
    it("posts to /api/v1/preflight with the URL and returns parsed JSON + receipt", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      const fakeBody = {
        ok: false,
        warnings: ["dead", "zombie"],
        metadata: { url: "https://api.venice.ai/api/v1/chat/completions" },
      };
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(fakeBody)),
        headers: { get: () => null },
      });

      const result = await provider.preflight(wallet, {
        url: "https://api.venice.ai/api/v1/chat/completions",
      });

      const parsed = JSON.parse(result);
      expect(parsed.result).toEqual(fakeBody);
      expect(parsed.paymentReceipt).toBeNull();
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        "https://x402station.io/api/v1/preflight",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: "https://api.venice.ai/api/v1/chat/completions",
          }),
        }),
      );
    });

    it("decodes the x-payment-response header into paymentReceipt", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      const receipt = { transaction: "0xabc", network: "eip155:8453" };
      const headerVal = btoa(JSON.stringify(receipt));
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ ok: true })),
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "x-payment-response" ? headerVal : null,
        },
      });

      const result = await provider.preflight(wallet, { url: "https://x" });
      expect(JSON.parse(result).paymentReceipt).toEqual(receipt);
    });

    it("returns an error envelope on non-2xx status", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      mockFetchWithPayment.mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue("upstream timeout"),
        headers: { get: () => null },
      });

      const result = await provider.preflight(wallet, { url: "https://x" });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.status).toBe(503);
      expect(parsed.details).toContain("upstream timeout");
    });
  });

  describe("forensics + catalog_decoys + watch_subscribe", () => {
    it("forensics posts to /api/v1/forensics", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue("{}"),
        headers: { get: () => null },
      });
      await provider.forensics(wallet, { url: "https://x" });
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        "https://x402station.io/api/v1/forensics",
        expect.any(Object),
      );
    });

    it("catalog_decoys posts to /api/v1/catalog/decoys with empty body", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue("{}"),
        headers: { get: () => null },
      });
      await provider.catalogDecoys(wallet, {});
      const call = mockFetchWithPayment.mock.calls[0];
      expect(call[0]).toBe("https://x402station.io/api/v1/catalog/decoys");
      expect(call[1].body).toBe("{}");
    });

    it("watch_subscribe omits signals when not provided", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue("{}"),
        headers: { get: () => null },
      });
      await provider.watchSubscribe(wallet, {
        url: "https://x",
        webhookUrl: "https://hook",
      });
      const body = JSON.parse(mockFetchWithPayment.mock.calls[0][1].body);
      expect(body).toEqual({ url: "https://x", webhookUrl: "https://hook" });
      expect(body).not.toHaveProperty("signals");
    });

    it("watch_subscribe includes signals when provided", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue("{}"),
        headers: { get: () => null },
      });
      await provider.watchSubscribe(wallet, {
        url: "https://x",
        webhookUrl: "https://hook",
        signals: ["zombie", "decoy_price_extreme"],
      });
      const body = JSON.parse(mockFetchWithPayment.mock.calls[0][1].body);
      expect(body.signals).toEqual(["zombie", "decoy_price_extreme"]);
    });

    it("watch_subscribe rejects http:// webhookUrl via zod (Greptile P1)", () => {
      // Schema-level guard: HMAC-signed alert payloads must not travel
      // unencrypted. Validator runs before any wallet round-trip so
      // the agent never signs a $0.01 challenge for a doomed call.
      expect(() =>
        WatchSubscribeSchema.parse({
          url: "https://endpoint.example",
          webhookUrl: "http://insecure-webhook.example",
        }),
      ).toThrow(/HTTPS/i);
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      // Sanity: still accepts https://
      expect(() =>
        WatchSubscribeSchema.parse({
          url: "https://endpoint.example",
          webhookUrl: "https://secure-webhook.example",
        }),
      ).not.toThrow();
    });

    it("preflight surfaces a malformed payment-response header with malformed:true (Greptile P2)", async () => {
      const provider = new X402stationActionProvider();
      const wallet = buildMockEvmWallet();
      mockFetchWithPayment.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ ok: true })),
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "x-payment-response"
              ? "not-base64-and-not-json!!!"
              : null,
        },
      });
      const result = await provider.preflight(wallet, { url: "https://x" });
      const parsed = JSON.parse(result);
      expect(parsed.paymentReceipt).toEqual({
        raw: "not-base64-and-not-json!!!",
        malformed: true,
      });
    });
  });

  describe("watch_status (free, secret-gated)", () => {
    it("does NOT use the paying-fetch wrapper", async () => {
      const provider = new X402stationActionProvider();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ isActive: true })),
      });
      await provider.watchStatus({
        watchId: "0a44f6b8-3b7d-4f2a-9e3a-2c5fd1b0aa11",
        secret: "a".repeat(64),
      });
      expect(mockFetchWithPayment).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://x402station.io/api/v1/watch/0a44f6b8-3b7d-4f2a-9e3a-2c5fd1b0aa11",
        expect.objectContaining({
          method: "GET",
          headers: { "x-x402station-secret": "a".repeat(64) },
        }),
      );
    });

    it("returns the parsed body on 200", async () => {
      const provider = new X402stationActionProvider();
      const fakeBody = { isActive: true, alertsRemaining: 100 };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(fakeBody)),
      });
      const result = await provider.watchStatus({
        watchId: "0a44f6b8-3b7d-4f2a-9e3a-2c5fd1b0aa11",
        secret: "b".repeat(64),
      });
      expect(JSON.parse(result)).toEqual(fakeBody);
    });

    it("returns an error envelope on 404 (wrong secret OR missing watch)", async () => {
      const provider = new X402stationActionProvider();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('{"error":"watch not found"}'),
      });
      const result = await provider.watchStatus({
        watchId: "0a44f6b8-3b7d-4f2a-9e3a-2c5fd1b0aa11",
        secret: "c".repeat(64),
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.status).toBe(404);
    });
  });

  describe("watch_unsubscribe (free, secret-gated)", () => {
    it("issues DELETE", async () => {
      const provider = new X402stationActionProvider();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"isActive":false}'),
      });
      await provider.watchUnsubscribe({
        watchId: "0a44f6b8-3b7d-4f2a-9e3a-2c5fd1b0aa11",
        secret: "d".repeat(64),
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://x402station.io/api/v1/watch/0a44f6b8-3b7d-4f2a-9e3a-2c5fd1b0aa11",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
