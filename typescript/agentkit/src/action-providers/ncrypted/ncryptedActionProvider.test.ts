import { EvmWalletProvider } from "../../wallet-providers";
import { CreateSecretSchema, ReadSecretSchema, SecretStatusSchema } from "./schemas";
import { ncryptedActionProvider } from "./ncryptedActionProvider";
import { encrypt, decrypt, parseLink } from "./crypto";

// Produced by the reference ncrypted SDK (packages/sdk/src/crypto.ts) to pin wire compatibility.
const VECTORS = {
  plain: {
    payload: {
      v: 1,
      ciphertext: "kFNZu_BU9xM8m4GRK53jA6hOmF8Mq1c2CnYrGj136ZsuyzONTJTH9TXkWk6vk8k4rBjRJIMY",
      iv: "33Fjq7lxFUmXuM71",
      salt: "UkaVCia8qWbeIx5SK9D2qA",
      hasPassphrase: false,
    },
    key: "zgICISoCRbSa-mGci1-Z60-iHJ_hARrs9Z57P-gmKfw",
    plaintext: "agentkit test vector: sk_test_FAKE_123",
  },
  pass: {
    payload: {
      v: 1,
      ciphertext: "SzsQtDqSGl8uDosTVv3qsGaIVDwmIqWzjYGAuWhA7g",
      iv: "zVZKw7Yh833hlcna",
      salt: "4_I2rdk0o2txmTwCPBXoVQ",
      hasPassphrase: true,
    },
    key: "3ohmNT_mSf8G_XJUR7Um3SYiaRAw5TASgqgef4NxPuc",
    passphrase: "correct horse",
    plaintext: "with passphrase",
  },
};

const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const SECRET_ID = "AbCdEfGhIjKlMnOpQrStUv";

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

describe("ncrypted crypto", () => {
  it("decrypts payloads produced by the reference SDK", async () => {
    expect(await decrypt(VECTORS.plain.payload, VECTORS.plain.key)).toBe(VECTORS.plain.plaintext);
    expect(await decrypt(VECTORS.pass.payload, VECTORS.pass.key, VECTORS.pass.passphrase)).toBe(
      VECTORS.pass.plaintext,
    );
  });

  it("round-trips and rejects a wrong key or passphrase", async () => {
    const { payload, key } = await encrypt("hunter2", "pw");
    expect(await decrypt(payload, key, "pw")).toBe("hunter2");
    await expect(decrypt(payload, key, "nope")).rejects.toThrow("Decryption failed");
    await expect(decrypt(payload, key)).rejects.toThrow("requires a passphrase");
    const other = await encrypt("x");
    await expect(decrypt(payload, other.key, "pw")).rejects.toThrow("Decryption failed");
  });

  it("parses links", () => {
    expect(parseLink(`https://ncrypted.ai/s/${SECRET_ID}#key123`)).toEqual({
      origin: "https://ncrypted.ai",
      id: SECRET_ID,
      key: "key123",
    });
    expect(() => parseLink(`https://ncrypted.ai/s/${SECRET_ID}`)).toThrow(
      "Not a valid ncrypted link",
    );
  });
});

describe("ncrypted schemas", () => {
  it("validates create input", () => {
    expect(CreateSecretSchema.safeParse({ secret: "s" }).success).toBe(true);
    expect(CreateSecretSchema.safeParse({ secret: "" }).success).toBe(false);
    expect(CreateSecretSchema.safeParse({ secret: "s", ttlSeconds: 10 }).success).toBe(false);
    expect(CreateSecretSchema.safeParse({ secret: "s", emailTo: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("validates read and status input", () => {
    expect(ReadSecretSchema.safeParse({ link: "https://ncrypted.ai/s/x#k" }).success).toBe(true);
    expect(ReadSecretSchema.safeParse({}).success).toBe(false);
    expect(SecretStatusSchema.safeParse({ id: "x", receiptToken: "t" }).success).toBe(true);
    expect(SecretStatusSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

/**
 * Normalizes a recorded fetch call, which may be (url, init) or a single Request.
 *
 * @param call - The recorded fetch arguments
 * @returns The url, headers and body text
 */
async function requestOf(
  call: unknown[],
): Promise<{ url: string; headers: Headers; body: string }> {
  const [input, init] = call as [RequestInfo | URL, RequestInit | undefined];
  if (input instanceof Request)
    return { url: input.url, headers: input.headers, body: await input.clone().text() };
  return {
    url: String(input),
    headers: new Headers(init?.headers),
    body: (init?.body as string) ?? "",
  };
}

describe("ncrypted actions", () => {
  const provider = ncryptedActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let fetchMock: jest.SpyInstance;
  const signTypedData = jest.fn();

  beforeEach(() => {
    signTypedData.mockReset();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
      toSigner: jest.fn().mockReturnValue({ address: MOCK_ADDRESS, signTypedData }),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => fetchMock.mockRestore());

  it("creates a free secret and returns a link whose key decrypts what was uploaded", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          id: SECRET_ID,
          url: `https://ncrypted.ai/s/${SECRET_ID}`,
          expiresAt: "2026-01-01T00:00:00Z",
          receiptToken: "rt",
          free: true,
        },
        201,
      ),
    );
    const out = JSON.parse(
      await provider.createSecret(mockWallet, { secret: "db-password", ttlSeconds: 600 }),
    );
    expect(out).toMatchObject({ id: SECRET_ID, receiptToken: "rt", emailed: false, paid: false });

    const req = await requestOf(fetchMock.mock.calls[0]);
    expect(req.url).toBe("https://ncrypted.ai/api/v1/secrets");
    expect(req.headers.get("x-ncrypted-client")).toBe("agentkit/1");
    const uploaded = JSON.parse(req.body);
    expect(uploaded.ttl).toBe(600);
    expect(JSON.stringify(uploaded)).not.toContain("db-password");
    expect(await decrypt(uploaded, parseLink(out.link).key)).toBe("db-password");
    expect(signTypedData).not.toHaveBeenCalled();
  });

  it("skips the free tier and emails the link when emailTo is set", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: SECRET_ID,
            url: `https://ncrypted.ai/s/${SECRET_ID}`,
            expiresAt: "x",
            receiptToken: "rt",
          },
          201,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ emailed: true }));
    const out = JSON.parse(
      await provider.createSecret(mockWallet, { secret: "s", emailTo: "ops@example.com" }),
    );
    expect(out.emailed).toBe(true);
    expect((await requestOf(fetchMock.mock.calls[0])).headers.get("x-ncrypted-no-free")).toBe("1");
    const email = await requestOf(fetchMock.mock.calls[1]);
    expect(email.url).toBe(`https://ncrypted.ai/api/v1/secrets/${SECRET_ID}/email`);
    expect(JSON.parse(email.body).to).toBe("ops@example.com");
  });

  it("refuses to pay more than the cap", async () => {
    const paymentRequired = {
      x402Version: 2,
      error: "Payment required",
      resource: { url: "https://ncrypted.ai/api/v1/secrets" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "1000000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0x60fd3907f066782a08e9ee4ab0d09d274bd0b2d5",
          maxTimeoutSeconds: 300,
          extra: { name: "USD Coin", version: "2" },
        },
      ],
    };
    fetchMock.mockResolvedValue(
      new Response("{}", {
        status: 402,
        headers: {
          "payment-required": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
        },
      }),
    );
    const out = await provider.createSecret(mockWallet, { secret: "s" });
    expect(out).toMatch(/^Error creating secret/);
    expect(signTypedData).not.toHaveBeenCalled();
  });

  it("reads and decrypts a secret", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VECTORS.plain.payload));
    const link = `https://ncrypted.ai/s/${SECRET_ID}#${VECTORS.plain.key}`;
    expect(await provider.readSecret(mockWallet, { link })).toBe(VECTORS.plain.plaintext);
    expect((await requestOf(fetchMock.mock.calls[0])).url).toBe(
      `https://ncrypted.ai/api/v1/secrets/${SECRET_ID}/reveal`,
    );
  });

  it("reports a secret that was already read", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "gone" }, 410));
    const out = await provider.readSecret(mockWallet, {
      link: `https://ncrypted.ai/s/${SECRET_ID}#k`,
    });
    expect(out).toContain("already been read");
  });

  it("returns secret status", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "read", readAt: "2026-01-01T00:00:00Z" }),
    );
    const out = JSON.parse(
      await provider.secretStatus(mockWallet, { id: SECRET_ID, receiptToken: "rt" }),
    );
    expect(out.status).toBe("read");
    expect((await requestOf(fetchMock.mock.calls[0])).headers.get("authorization")).toBe(
      "Bearer rt",
    );
  });

  it("supports Base mainnet only", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
      false,
    );
    expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
      false,
    );
  });
});
