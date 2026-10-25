import { prismActionProvider, DEFAULT_API_BASE } from "./prismActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

const mockRegisterPolicy = jest.fn();
const mockPay = jest.fn();

jest.mock("@x402/fetch", () => ({
  x402Client: jest.fn().mockImplementation(() => ({
    registerPolicy: mockRegisterPolicy,
  })),
  wrapFetchWithPayment: jest.fn(() => mockPay),
  decodePaymentResponseHeader: jest.fn((header: string) =>
    JSON.parse(Buffer.from(header, "base64").toString()),
  ),
}));

jest.mock("@x402/evm/exact/client", () => ({
  registerExactEvmScheme: jest.fn(),
}));

/**
 * Builds a Response-like object the provider can read.
 *
 * @param status - HTTP status code.
 * @param body - Parsed JSON body.
 * @param settlement - Optional decoded payment-response header value.
 * @returns A minimal Response stand-in.
 */
function response(status: number, body: unknown, settlement?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: {
      get: (name: string) =>
        name === "payment-response" && settlement
          ? Buffer.from(JSON.stringify(settlement)).toString("base64")
          : null,
    },
  };
}

describe("PrismActionProvider", () => {
  const provider = prismActionProvider();

  const mockWallet = {
    getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
    getNetwork: jest.fn().mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
      chainId: "8453",
    }),
    getName: jest.fn().mockReturnValue("test-wallet"),
    readContract: jest.fn(),
    toSigner: jest.fn().mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      signTypedData: jest.fn(),
    }),
  } as unknown as EvmWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("supportsNetwork", () => {
    it("supports EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("rejects non-EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
    });
  });

  describe("getModels", () => {
    it("returns the model list without paying", async () => {
      const models = { models: ["llama3.2:3b"], state: "warm" };
      (global.fetch as jest.Mock).mockResolvedValue(response(200, models));

      const result = await provider.getModels(mockWallet, {});

      expect(global.fetch).toHaveBeenCalledWith(`${DEFAULT_API_BASE}/inference/v1/models`);
      expect(mockPay).not.toHaveBeenCalled();
      expect(JSON.parse(result)).toEqual(models);
    });

    it("reports a failing status", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(response(500, {}));

      await expect(provider.getModels(mockWallet, {})).resolves.toContain("answered 500");
    });
  });

  describe("runInference", () => {
    it("pays for a generation and returns the settlement", async () => {
      const settlement = { success: true, transaction: "0xabc", network: "eip155:8453" };
      mockPay.mockResolvedValue(
        response(200, { model: "llama3.2:3b", response: "hello", lease_id: 7 }, settlement),
      );

      const result = await provider.runInference(mockWallet, {
        prompt: "say hello",
        model: "llama3.2:3b",
        maxTokens: 16,
      });

      const [url, init] = mockPay.mock.calls[0];
      expect(url).toBe(`${DEFAULT_API_BASE}/inference/v1/inference`);
      expect(JSON.parse(init.body)).toEqual({
        prompt: "say hello",
        model: "llama3.2:3b",
        options: { num_predict: 16 },
      });
      expect(JSON.parse(result)).toMatchObject({ response: "hello", settlement });
    });

    it("omits model and options when not given", async () => {
      mockPay.mockResolvedValue(response(200, { response: "hi" }));

      await provider.runInference(mockWallet, { prompt: "hi" });

      expect(JSON.parse(mockPay.mock.calls[0][1].body)).toEqual({ prompt: "hi" });
    });

    it.each([429, 503])(
      "reports a cold GPU as unbilled rather than as a failure (%i)",
      async status => {
        mockPay.mockResolvedValue(
          response(status, { error: "warming_up", detail: "leasing", retry_after_seconds: 300 }),
        );

        const result = JSON.parse(await provider.runInference(mockWallet, { prompt: "hi" }));

        expect(result).toEqual({ charged: false, retryAfterSeconds: 300, detail: "leasing" });
      },
    );

    it("survives a gateway answering with something that is not JSON", async () => {
      mockPay.mockResolvedValue({
        status: 502,
        ok: false,
        text: jest.fn().mockResolvedValue("<html>bad gateway</html>"),
        headers: { get: () => null },
      });

      await expect(provider.runInference(mockWallet, { prompt: "hi" })).resolves.toContain(
        "bad gateway",
      );
    });

    it("returns a readable message when the payment throws", async () => {
      mockPay.mockRejectedValue(new Error("insufficient funds"));

      await expect(provider.runInference(mockWallet, { prompt: "hi" })).resolves.toContain(
        "insufficient funds",
      );
    });
  });

  describe("runBatch", () => {
    it("sends every prompt in one paid call", async () => {
      mockPay.mockResolvedValue(response(200, { count: 2, items: [] }));

      await provider.runBatch(mockWallet, { prompts: ["a", "b"], maxTokens: 8 });

      const [url, init] = mockPay.mock.calls[0];
      expect(url).toBe(`${DEFAULT_API_BASE}/inference/v1/batch`);
      expect(JSON.parse(init.body)).toEqual({ prompts: ["a", "b"], options: { num_predict: 8 } });
    });
  });

  describe("runGpuCommand", () => {
    it("queues the command and returns the job handle", async () => {
      const job = { job_id: "abc", status: "queued", token: "t0k", poll: "/jobs/abc" };
      mockPay.mockResolvedValue(response(202, job));

      const result = JSON.parse(
        await provider.runGpuCommand(mockWallet, { command: "nvidia-smi" }),
      );

      expect(mockPay.mock.calls[0][0]).toBe(`${DEFAULT_API_BASE}/x402/run`);
      expect(result).toMatchObject(job);
    });
  });

  describe("getGpuJob", () => {
    it("polls with the job token and pays nothing", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        response(200, { status: "succeeded", stdout: "H100" }),
      );

      const result = await provider.getGpuJob(mockWallet, { jobId: "abc", token: "t0k" });

      expect(global.fetch).toHaveBeenCalledWith(`${DEFAULT_API_BASE}/x402/jobs/abc`, {
        headers: { authorization: "Bearer t0k" },
      });
      expect(mockPay).not.toHaveBeenCalled();
      expect(JSON.parse(result)).toMatchObject({ status: "succeeded" });
    });

    it("reports an unknown job", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(response(404, { error: "job_not_found" }));

      await expect(
        provider.getGpuJob(mockWallet, { jobId: "nope", token: "t0k" }),
      ).resolves.toContain("answered 404");
    });
  });

  describe("spend cap", () => {
    /**
     * Runs the policy the provider registers against a set of options.
     *
     * @param maxPaymentUsdc - The cap to configure.
     * @param amounts - Atomic USDC amounts to offer.
     * @returns The amounts the policy allowed through.
     */
    async function filterAmounts(maxPaymentUsdc: number | undefined, amounts: string[]) {
      mockPay.mockResolvedValue(response(200, {}));
      await prismActionProvider(
        maxPaymentUsdc === undefined ? {} : { maxPaymentUsdc },
      ).runInference(mockWallet, { prompt: "hi" });

      const policy = mockRegisterPolicy.mock.calls[0][0];
      return policy(
        2,
        amounts.map(amount => ({ amount })),
      ).map((option: { amount: string }) => option.amount);
    }

    it("drops options priced above the cap", async () => {
      await expect(filterAmounts(0.01, ["6096", "20000"])).resolves.toEqual(["6096"]);
    });

    it("defaults to a 1 USDC ceiling", async () => {
      await expect(filterAmounts(undefined, ["999999", "1000001"])).resolves.toEqual(["999999"]);
    });

    it("drops options with no readable amount", async () => {
      await expect(filterAmounts(1, ["not-a-number"])).resolves.toEqual([]);
    });
  });
});
