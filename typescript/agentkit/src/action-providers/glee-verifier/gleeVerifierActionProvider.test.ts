import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import {
  gleeVerifierActionProvider,
  GleeVerifierActionProvider,
  BASE_CHAIN_ID,
  BASE_USDC_MAINNET_ADDRESS,
  GLEE_VERIFIER_URL,
} from "./gleeVerifierActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import fixture from "./receipt.fixture.json";

jest.mock("../../analytics", () => ({ sendAnalyticsEvent: jest.fn() }));

const PAY_TO = fixture.body.acceptance_receipt.payment.pay_to;
const PUBLIC_KEY = fixture.body.acceptance_receipt.key.public_key_hex;
const PAYER = fixture.body.acceptance_receipt.payment.payer;

/**
 * Makes an isolated JSON copy for adversarial mutation.
 *
 * @param value - JSON fixture
 * @returns Independent copy
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Constructs the service's x402 V2 quote using local test recipients.
 *
 * @returns Exact approved challenge
 */
function challenge() {
  return {
    x402Version: 2,
    resource: { url: GLEE_VERIFIER_URL },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "50000",
        asset: BASE_USDC_MAINNET_ADDRESS,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
  };
}

describe("GleeVerifierActionProvider", () => {
  const fetchMock = jest.fn();
  let provider: GleeVerifierActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
    provider = gleeVerifierActionProvider({
      trustedPayTo: PAY_TO,
      trustedReceiptPublicKeyHex: PUBLIC_KEY,
    });
    wallet = {
      getName: jest.fn().mockReturnValue("local-mock-wallet"),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
      getAddress: jest.fn().mockReturnValue(PAYER),
      signTypedData: jest.fn().mockResolvedValue("0xabcdef123456"),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("authenticates a real locally signed service fixture after approved mock payment", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(challenge()), { status: 402 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.body), { status: 200 }));
    const result = JSON.parse(await provider.verifyPatch(wallet, fixture.request));
    expect(result.receipt_verified).toBe(true);
    expect(result.result.verdict).toBe("PASS");
    expect(wallet.signTypedData).toHaveBeenCalledTimes(1);
    expect(wallet.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: {
          name: "USD Coin",
          version: "2",
          chainId: BASE_CHAIN_ID,
          verifyingContract: BASE_USDC_MAINNET_ADDRESS,
        },
        message: expect.objectContaining({ to: PAY_TO, value: "50000" }),
      }),
    );
    const authorization = wallet.signTypedData.mock.calls[0][0].message;
    expect(authorization.validBefore - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(300);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[1][1].redirect).toBe("error");
    const payment = JSON.parse(
      Buffer.from(fetchMock.mock.calls[1][1].headers["PAYMENT-SIGNATURE"], "base64").toString(),
    );
    expect(payment.accepted).toEqual(challenge().accepts[0]);
  });

  it.each(["fail"] as const)(
    "authenticates the service's %s verdict without promoting it to PASS",
    async kind => {
      const example = fixture[kind];
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify(challenge()), { status: 402 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(example.body), { status: 200 }));
      const result = JSON.parse(await provider.verifyPatch(wallet, example.request));
      expect(result.receipt_verified).toBe(true);
      expect(result.result.verdict).toBe("FAIL");
    },
  );

  it.each([{ patch: "" }, { patch: "   " }, { ...fixture.request, job_id: "x".repeat(129) }])(
    "rejects unsupported input before payment",
    async request => {
      expect(JSON.parse(await provider.verifyPatch(wallet, request)).error).toBeDefined();
      expect(wallet.signTypedData).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["higher amount", "amount", "5000000"],
    ["lower amount", "amount", "1"],
    ["noncanonical amount", "amount", "050000"],
    ["numeric amount", "amount", 50000],
    ["recipient", "payTo", "0x3333333333333333333333333333333333333333"],
    ["malformed recipient", "payTo", "bad"],
    ["asset", "asset", "0x3333333333333333333333333333333333333333"],
    ["missing asset", "asset", undefined],
    ["other chain", "network", "eip155:1"],
    ["testnet", "network", "eip155:84532"],
    ["missing network", "network", undefined],
    ["scheme", "scheme", "upto"],
    ["missing scheme", "scheme", undefined],
    ["timeout", "maxTimeoutSeconds", 86400],
    ["negative timeout", "maxTimeoutSeconds", -1],
    ["domain name", "extra", { name: "Evil Coin", version: "2" }],
    ["domain version", "extra", { name: "USD Coin", version: "1" }],
  ])("rejects %s without signing", async (_name, field, value) => {
    const quote = challenge();
    Object.assign(quote.accepts[0], { [field as string]: value });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(quote), { status: 402 }));
    expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toBeDefined();
    expect(wallet.signTypedData).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["version", "resource", "missing offers", "multiple offers", "null"])(
    "rejects bad %s without signing",
    async kind => {
      const quote = challenge();
      if (kind === "version") quote.x402Version = 1;
      if (kind === "resource") quote.resource.url = "https://other.example/verify";
      if (kind === "missing offers") quote.accepts = [];
      if (kind === "multiple offers") quote.accepts.push(quote.accepts[0]);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(kind === "null" ? null : quote), { status: 402 }),
      );
      expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toBeDefined();
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "", "bad"])(
    "requires trusted configuration (%s) before payment",
    async key => {
      provider = gleeVerifierActionProvider({
        trustedPayTo: PAY_TO,
        trustedReceiptPublicKeyHex: key,
      });
      expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toContain(
        "configure",
      );
      expect(wallet.signTypedData).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("requires an approved recipient and fails closed for legacy endpoint-only callers", async () => {
    for (const config of [{ trustedReceiptPublicKeyHex: PUBLIC_KEY }, GLEE_VERIFIER_URL]) {
      expect(
        JSON.parse(await gleeVerifierActionProvider(config).verifyPatch(wallet, fixture.request))
          .error,
      ).toContain("configure");
    }
    expect(wallet.signTypedData).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["1", "84532", undefined])(
    "rejects wallet chain %s even with a Base alias",
    async chainId => {
      wallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId,
      });
      expect(provider.supportsNetwork(wallet.getNetwork())).toBe(false);
      expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toContain(
        "Base mainnet",
      );
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    },
  );

  it("rejects a wallet network change during challenge retrieval", async () => {
    fetchMock.mockImplementationOnce(async () => {
      wallet.getNetwork.mockReturnValue({ protocolFamily: "evm", chainId: "1" });
      return new Response(JSON.stringify(challenge()), { status: 402 });
    });
    expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toContain(
      "network changed",
    );
    expect(wallet.signTypedData).not.toHaveBeenCalled();
  });

  it.each([200, 400, 500])("rejects initial HTTP %s including an unsigned PASS", async status => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(fixture.body), { status }));
    expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toContain(
      "Expected HTTP 402",
    );
    expect(wallet.signTypedData).not.toHaveBeenCalled();
  });

  it.each([402, 400, 500, 202])(
    "rejects paid HTTP %s even with a signed PASS body",
    async status => {
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify(challenge()), { status: 402 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(fixture.body), { status }));
      const result = JSON.parse(await provider.verifyPatch(wallet, fixture.request));
      expect(result.error).toContain(`HTTP ${status}`);
      expect(result.receipt_verified).toBeUndefined();
      expect(result.result).toBeUndefined();
    },
  );

  it.each([
    "missing",
    "placeholder signature",
    "forged signature",
    "outcome",
    "score",
    "findings",
    "files",
    "stats",
    "limitations",
    "methodology",
    "key",
  ])("rejects tampered %s", async kind => {
    const body = clone(fixture.body);
    if (kind === "missing") delete (body as Partial<typeof body>).acceptance_receipt;
    if (kind === "placeholder signature") body.acceptance_receipt.signature = "ed25519_sig_test";
    if (kind === "forged signature") body.acceptance_receipt.signature = "00".repeat(64);
    if (kind === "outcome") body.result.verdict = "FAIL";
    if (kind === "score") body.result.score = 0;
    if (kind === "findings")
      body.result.findings.push({
        severity: "CRITICAL",
        rule: "test",
        message: "tampered",
      } as never);
    if (kind === "files") body.result.modified_files.push("secrets.txt");
    if (kind === "stats") body.result.stats.added_lines++;
    if (kind === "limitations") body.result.limitations = [];
    if (kind === "methodology") body.acceptance_receipt.methodology_hash = "00".repeat(32);
    if (kind === "key") body.acceptance_receipt.key.public_key_hex = "00".repeat(32);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(challenge()), { status: 402 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    const result = JSON.parse(await provider.verifyPatch(wallet, fixture.request));
    expect(result.error).toContain("Receipt verification");
    expect(result.result).toBeUndefined();
  });

  it.each(["patch", "policy", "assertions", "job"])(
    "rejects a valid signature for a different %s",
    async field => {
      const request = clone(fixture.request);
      if (field === "patch") request.patch += "\n";
      if (field === "policy") request.path_policy.allowed_paths = ["other/"];
      if (field === "assertions") request.assertions[0].pattern = "different";
      if (field === "job") request.job_id = "different-job";
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify(challenge()), { status: 402 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(fixture.body), { status: 200 }));
      expect(JSON.parse(await provider.verifyPatch(wallet, request)).error).toContain(
        "binding mismatch",
      );
    },
  );

  it("rejects a self-consistent receipt signed by an untrusted key", async () => {
    const body = clone(fixture.body);
    const pair = generateKeyPairSync("ed25519");
    const publicKey = pair.publicKey
      .export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("hex");
    const fingerprint = createHash("sha256").update(publicKey).digest("hex");
    body.acceptance_receipt.key = {
      algorithm: "Ed25519",
      public_key_hex: publicKey,
      fingerprint_sha256: fingerprint,
      key_id: `glee-acceptance-${fingerprint.slice(0, 16)}`,
    };
    const { signature: _signature, ...payload } = body.acceptance_receipt;
    const sorted = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(sorted)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([k, v]) => [k, sorted(v)]),
            )
          : value;
    const digest = createHash("sha256")
      .update(JSON.stringify(sorted(payload)))
      .digest("hex");
    body.acceptance_receipt.signature = sign(
      null,
      Buffer.from(digest),
      createPrivateKey(pair.privateKey.export({ type: "pkcs8", format: "pem" })),
    ).toString("hex");
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(challenge()), { status: 402 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toContain(
      "untrusted signing key",
    );
  });

  it("uses a snapshot of the request for both calls and receipt binding", async () => {
    const request = clone(fixture.request);
    fetchMock
      .mockImplementationOnce(async () => {
        request.patch += "mutated";
        return new Response(JSON.stringify(challenge()), { status: 402 });
      })
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture.body), { status: 200 }));
    expect(JSON.parse(await provider.verifyPatch(wallet, request)).receipt_verified).toBe(true);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });

  it("returns a clear error on unavailable or malformed verification", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network connection refused"));
    expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toContain(
      "Network connection refused",
    );
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(challenge()), { status: 402 }))
      .mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(JSON.parse(await provider.verifyPatch(wallet, fixture.request)).error).toContain(
      "verification failed",
    );
  });
});
