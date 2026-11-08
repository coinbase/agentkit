import { musedinActionProvider, MusedInActionProvider } from "./musedinActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { TOKEN_MISSING_ERROR } from "./constants";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

const MOCK_TOKEN = "musedin_tok_testtesttesttesttesttesttesttesttesttes";
const MOCK_WALLET = "0x1234567890123456789012345678901234567890";

const mockRegisterPolicy = jest.fn();
const mockX402Client = { registerPolicy: mockRegisterPolicy };
const mockFetchWithPayment = jest.fn();

jest
  .mocked(x402Client)
  .mockImplementation(() => mockX402Client as unknown as InstanceType<typeof x402Client>);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);

const mockResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  }) as unknown as Response;

const makeMockWalletProvider = () => {
  const provider = Object.create(EvmWalletProvider.prototype);
  provider.getAddress = jest.fn().mockReturnValue(MOCK_WALLET);
  provider.toSigner = jest.fn().mockReturnValue({ address: MOCK_WALLET });
  provider.readContract = jest.fn();
  provider.getNetwork = jest
    .fn()
    .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" });
  return provider as EvmWalletProvider;
};

const MOCK_ROLES = {
  ok: true,
  status: "open",
  open: 2,
  next: null,
  roles: [
    {
      slug: "task-recheck",
      title: "Re-check a delivery",
      skills: ["research", "testing"],
      pay: null,
      budget: null,
      rail: null,
      done: "A re-check posted with each step and its result.",
      seats: 5,
      seats_taken: 1,
    },
    {
      slug: "job-f160",
      title: "Weekly check: Example app",
      skills: ["testing"],
      pay: null,
      budget: "3000000",
      rail: "usdc-base",
      done: "A report with steps to reproduce each failure.",
      seats: 1,
      seats_taken: 0,
    },
  ],
};

describe("MusedInActionProvider", () => {
  let provider: MusedInActionProvider;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.MUSEDIN_API_TOKEN;
    provider = musedinActionProvider();
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.clearAllMocks();
    fetchMock.mockRestore();
    delete process.env.MUSEDIN_API_TOKEN;
  });

  describe("constructor", () => {
    it("should start without a token", () => {
      expect(provider["token"]).toBeUndefined();
    });

    it("should take the token from the config", () => {
      expect(musedinActionProvider({ apiToken: MOCK_TOKEN })["token"]).toBe(MOCK_TOKEN);
    });

    it("should take the token from MUSEDIN_API_TOKEN", () => {
      process.env.MUSEDIN_API_TOKEN = MOCK_TOKEN;
      expect(musedinActionProvider()["token"]).toBe(MOCK_TOKEN);
    });
  });

  describe("supportsNetwork", () => {
    it("should support Base mainnet", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as Network),
      ).toBe(true);
    });

    it("should not support Base Sepolia", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" } as Network),
      ).toBe(false);
    });

    it("should not support other networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
        } as Network),
      ).toBe(false);
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" } as Network),
      ).toBe(false);
    });
  });

  describe("listJobs", () => {
    it("should list open jobs with links", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, MOCK_ROLES));

      const result = JSON.parse(await provider.listJobs({}));

      expect(fetchMock).toHaveBeenCalledWith("https://musedin.com/api/roles", expect.any(Object));
      expect(result.success).toBe(true);
      expect(result.open).toBe(2);
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0]).toEqual({
        title: "Re-check a delivery",
        slug: "task-recheck",
        skills: ["research", "testing"],
        pay: null,
        budget: null,
        rail: null,
        done: "A re-check posted with each step and its result.",
        seats: 5,
        seatsTaken: 1,
        link: "https://musedin.com/jobs/task-recheck",
      });
      expect(result.jobs[1].budget).toBe("3000000");
    });

    it("should filter by skill", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, { ...MOCK_ROLES, roles: [] }));

      await provider.listJobs({ skill: "sql" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://musedin.com/api/roles?skill=sql",
        expect.any(Object),
      );
    });

    it("should return an error on a failed response", async () => {
      fetchMock.mockResolvedValue(mockResponse(503, { ok: false, error: "busy", retry_after: 5 }));

      const result = JSON.parse(await provider.listJobs({}));

      expect(result).toEqual({
        success: false,
        message: "Error listing MusedIn jobs",
        status: 503,
        error: "busy",
        retry_after: 5,
      });
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const result = await provider.listJobs({});

      expect(result).toBe("Error listing MusedIn jobs: Network error");
    });
  });

  describe("join", () => {
    const JOIN_RESPONSE = {
      ok: true,
      created: true,
      muse_id: "agent_abc123",
      token: MOCK_TOKEN,
      auth: "token",
      joined: true,
      profile: "https://musedin.com/m/agent_abc123",
      verified: false,
      next: [{ call: "GET /api/roles" }],
    };

    it("should join with src agentkit and keep the token in memory", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, JOIN_RESPONSE));

      const result = JSON.parse(
        await provider.join({ name: "Test Agent", headline: "Tests things", skills: "testing" }),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "https://musedin.com/api/quickstart",
        expect.objectContaining({ method: "POST" }),
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({
        name: "Test Agent",
        headline: "Tests things",
        skills: "testing",
        src: "agentkit",
      });
      expect(result.success).toBe(true);
      expect(result.museId).toBe("agent_abc123");
      expect(result.token).toBe(MOCK_TOKEN);
      expect(provider["token"]).toBe(MOCK_TOKEN);
      expect(provider["museId"]).toBe("agent_abc123");
    });

    it("should leave skills out when not given", async () => {
      fetchMock.mockResolvedValue(mockResponse(200, JOIN_RESPONSE));

      await provider.join({ name: "Test Agent", headline: "Tests things" });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.skills).toBeUndefined();
    });

    it("should not create a second agent while a token is set", async () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });

      const result = JSON.parse(
        await joined.join({ name: "Test Agent", headline: "Tests things" }),
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.alreadyJoined).toBe(true);
      expect(JSON.stringify(result)).not.toContain(MOCK_TOKEN);
    });

    it("should return suggestions when the name is taken", async () => {
      fetchMock.mockResolvedValue(
        mockResponse(409, {
          ok: false,
          error: "name is taken: Test Agent",
          suggestions: ["Test Agent 2"],
        }),
      );

      const result = JSON.parse(await provider.join({ name: "Test Agent", headline: "Tests" }));

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.suggestions).toEqual(["Test Agent 2"]);
      expect(provider["token"]).toBeUndefined();
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const result = await provider.join({ name: "Test Agent", headline: "Tests" });

      expect(result).toBe("Error joining MusedIn: Network error");
    });
  });

  describe("apply", () => {
    it("should need a token", async () => {
      const result = await provider.apply({ role: "task-recheck", note: "I re-check work" });

      expect(result).toBe(TOKEN_MISSING_ERROR);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should apply with the bearer token", async () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });
      fetchMock.mockResolvedValue(
        mockResponse(200, { ok: true, status: "applied", role: "task-recheck", terms_version: 2 }),
      );

      const result = JSON.parse(await joined.apply({ role: "task-recheck", note: "I re-check" }));

      expect(fetchMock).toHaveBeenCalledWith(
        "https://musedin.com/api/apply",
        expect.objectContaining({ method: "POST" }),
      );
      const init = fetchMock.mock.calls[0][1];
      expect(init.headers.Authorization).toBe(`Bearer ${MOCK_TOKEN}`);
      expect(JSON.parse(init.body)).toEqual({ role: "task-recheck", note: "I re-check" });
      expect(result).toEqual({
        success: true,
        role: "task-recheck",
        status: "applied",
        link: "https://musedin.com/jobs/task-recheck",
      });
    });

    it("should pass did_you_mean on an unknown slug", async () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });
      fetchMock.mockResolvedValue(
        mockResponse(404, { ok: false, error: "no such role", did_you_mean: "task-recheck" }),
      );

      const result = JSON.parse(await joined.apply({ role: "task-rechek" }));

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.did_you_mean).toBe("task-recheck");
    });
  });

  describe("verify", () => {
    it("should need a token", async () => {
      const result = await provider.verify(makeMockWalletProvider(), {});

      expect(result).toBe(TOKEN_MISSING_ERROR);
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
    });

    it("should pay over x402 with the wallet and return the verification", async () => {
      const walletProvider = makeMockWalletProvider();
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });
      mockFetchWithPayment.mockResolvedValue(
        mockResponse(200, {
          ok: true,
          verified: true,
          wallet: MOCK_WALLET,
          network: "base",
          paid: true,
          receipt: "https://musedin.com/api/payment/41",
        }),
      );

      const result = JSON.parse(await joined.verify(walletProvider, {}));

      expect(registerExactEvmScheme).toHaveBeenCalledWith(mockX402Client, {
        signer: expect.objectContaining({ address: MOCK_WALLET }),
      });
      expect(mockRegisterPolicy).toHaveBeenCalled();
      expect(mockFetchWithPayment).toHaveBeenCalledWith(
        "https://musedin.com/api/verify",
        expect.objectContaining({ method: "POST" }),
      );
      const init = mockFetchWithPayment.mock.calls[0][1];
      expect(init.headers.Authorization).toBe(`Bearer ${MOCK_TOKEN}`);
      expect(JSON.parse(init.body)).toEqual({ wallet: MOCK_WALLET });
      expect(result).toEqual({
        success: true,
        verified: true,
        wallet: MOCK_WALLET,
        network: "base",
        paid: true,
        founding: null,
        receipt: "https://musedin.com/api/payment/41",
      });
    });

    it("should only accept 1 USDC on Base", () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });
      joined["createX402Client"](makeMockWalletProvider());
      const policy = mockRegisterPolicy.mock.calls[0][0];

      const base = {
        scheme: "exact",
        network: "eip155:8453",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount: "1000000",
      };
      const robinhood = {
        scheme: "exact",
        network: "eip155:4663",
        asset: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
        amount: "1000000",
      };
      const tooMuch = { ...base, amount: "5000000" };

      expect(policy(2, [robinhood, base, tooMuch])).toEqual([base]);

      const baseV1 = {
        scheme: "exact",
        network: "base",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        maxAmountRequired: "1000000",
      };
      expect(policy(1, [baseV1])).toEqual([baseV1]);
    });

    it("should not pay hosts other than MusedIn", async () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });

      await expect(joined["musedinOnlyFetch"]("https://example.com/pay")).rejects.toThrow(
        "This client pays MusedIn only",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should say not to pay again while settlement is pending", async () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });
      joined["museId"] = "agent_abc123";
      mockFetchWithPayment.mockResolvedValue(
        mockResponse(
          409,
          { ok: false, error: "settlement_pending", receipt: "https://musedin.com/api/payment/42" },
          { "retry-after": "30" },
        ),
      );

      const result = JSON.parse(await joined.verify(makeMockWalletProvider(), {}));

      expect(result.success).toBe(false);
      expect(result.pending).toBe(true);
      expect(result.checkStatus).toBe("https://musedin.com/api/verify/agent_abc123");
      expect(result.retryAfterSeconds).toBe(30);
    });

    it("should return the error when payment is refused", async () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });
      mockFetchWithPayment.mockResolvedValue(
        mockResponse(402, { ok: false, error: "insufficient_funds" }),
      );

      const result = JSON.parse(await joined.verify(makeMockWalletProvider(), {}));

      expect(result).toEqual({
        success: false,
        message: "Error verifying on MusedIn",
        status: 402,
        error: "insufficient_funds",
      });
    });

    it("should handle payment client errors", async () => {
      const joined = musedinActionProvider({ apiToken: MOCK_TOKEN });
      mockFetchWithPayment.mockRejectedValue(new Error("No payment requirements matched"));

      const result = await joined.verify(makeMockWalletProvider(), {});

      expect(result).toBe("Error verifying on MusedIn: No payment requirements matched");
    });
  });
});
