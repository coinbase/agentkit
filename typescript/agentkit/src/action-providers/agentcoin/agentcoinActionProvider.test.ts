import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  agentcoinActionProvider,
  AgentCoinActionProvider,
  canonicalJson,
  verifyAgentCoinSignature,
} from "./agentcoinActionProvider";
import {
  FindServiceSchema,
  PlaceOrderSchema,
  RefundSchema,
  RouteTaskSchema,
  VerifySchema,
} from "./schemas";
import { AGENTCOIN_ESCROW, AGENTCOIN_USDC, ERC20_APPROVE_ABI, ESCROW_ABI } from "./constants";

const BUYER = "0x78e2C0164A80F3e337AE17e3bA4b8EA2C0Fa488e";
const PROVIDER = "0x6A32bC3Bb5eA1dc814f14E29e6f026535129A84f";
const EVALUATOR = "0x1111111111111111111111111111111111111111";
const SPEC_HASH = `0x${"ab".repeat(32)}` as `0x${string}`;
const TX1 = `0x${"01".repeat(32)}` as `0x${string}`;
const TX2 = `0x${"02".repeat(32)}` as `0x${string}`;

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const escrowOrder = (overrides: Record<string, unknown> = {}) => ({
  orderId: "ord_0123456789abcdef",
  serviceId: "svc_962928f654d2a8a1",
  mode: "escrow",
  escrow: {
    chainId: 84532,
    contract: AGENTCOIN_ESCROW,
    token: AGENTCOIN_USDC,
    amount: "10000",
    provider: PROVIDER,
    evaluator: EVALUATOR,
  },
  transactions: [
    {
      label: "approve",
      chainId: 84532,
      to: AGENTCOIN_USDC,
      value: "0",
      data: encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [AGENTCOIN_ESCROW, 10000n],
      }),
    },
    {
      label: "createAndFundFor",
      chainId: 84532,
      to: AGENTCOIN_ESCROW,
      value: "0",
      data: encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "createAndFundFor",
        args: [BUYER, PROVIDER, EVALUATOR, 10000n, 1900000000n, SPEC_HASH],
      }),
    },
  ],
  sellerCall: { method: "POST", url: "https://seller.example/v1/notarize" },
  ...overrides,
});

const jobCreatedLog = () => ({
  address: AGENTCOIN_ESCROW,
  topics: encodeEventTopics({
    abi: ESCROW_ABI,
    eventName: "JobCreated",
    args: { jobId: 42n, client: BUYER, provider: PROVIDER },
  }),
  data: encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "uint64" },
      { type: "bytes32" },
      { type: "uint32" },
    ],
    [EVALUATOR, 10000n, 1900000000n, SPEC_HASH, 1],
  ),
});

describe("AgentCoin schemas", () => {
  it("accepts a valid search", () => {
    expect(FindServiceSchema.safeParse({ q: "notary", maxPrice: "10000" }).success).toBe(true);
  });

  it("rejects a non-numeric price", () => {
    expect(FindServiceSchema.safeParse({ maxPrice: "0.01" }).success).toBe(false);
  });

  it("requires a task for route_task", () => {
    expect(RouteTaskSchema.safeParse({}).success).toBe(false);
  });

  it("requires a serviceId for place_order", () => {
    expect(PlaceOrderSchema.safeParse({ body: {} }).success).toBe(false);
  });

  it("rejects a non-decimal jobId", () => {
    expect(RefundSchema.safeParse({ jobId: "0x10" }).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(VerifySchema.safeParse({ serviceId: "svc_1", extra: true }).success).toBe(false);
  });
});

describe("canonicalJson", () => {
  it("sorts keys and drops undefined members (RFC 8785)", () => {
    expect(
      canonicalJson({ b: 1, a: [true, null, "x"], c: undefined, d: { z: 1e-7, y: 0.00001 } }),
    ).toBe('{"a":[true,null,"x"],"b":1,"d":{"y":0.00001,"z":1e-7}}');
  });
});

describe("verifyAgentCoinSignature", () => {
  const account = privateKeyToAccount(`0x${"11".repeat(32)}`);

  const sign = async (doc: Record<string, unknown>) => {
    const digest = keccak256(toBytes(canonicalJson(doc)));
    const value = await account.signMessage({ message: { raw: digest } });
    return {
      ...doc,
      signature: { scheme: "eip191", signer: account.address, signedDigest: digest, value },
    };
  };

  it("accepts a valid signature", async () => {
    const result = await verifyAgentCoinSignature(await sign({ v: "x", n: 1 }));
    expect(result.valid).toBe(true);
    expect(result.signer).toBe(account.address);
    expect(result.signerIsOperator).toBe(false);
  });

  it("rejects a modified document", async () => {
    const doc = await sign({ v: "x", n: 1 });
    const result = await verifyAgentCoinSignature({ ...doc, n: 2 });
    expect(result.valid).toBe(false);
  });

  it("reports a missing signature", async () => {
    expect((await verifyAgentCoinSignature({ v: "x" })).valid).toBe(false);
  });
});

describe("AgentCoinActionProvider", () => {
  let provider: AgentCoinActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    provider = agentcoinActionProvider({ baseUrl: "https://router.example/" });
    wallet = {
      getAddress: jest.fn().mockReturnValue(BUYER),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-sepolia", chainId: "84532" }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      signTypedData: jest.fn(),
      getPublicClient: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("supportsNetwork", () => {
    it("supports Base Sepolia", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        true,
      );
    });

    it("does not support Base mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        false,
      );
    });

    it("does not support non-EVM networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-devnet" })).toBe(
        false,
      );
    });
  });

  describe("findService", () => {
    it("builds the search query", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
      await provider.findService({ q: "notary", maxPrice: "10000" });
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://router.example/v1/services?q=notary&maxPrice=10000",
      );
    });

    it("fetches one listing by id", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: "svc_1" }));
      const out = JSON.parse(await provider.findService({ id: "svc_1" }));
      expect(fetchMock.mock.calls[0][0]).toBe("https://router.example/v1/services/svc_1");
      expect(out.id).toBe("svc_1");
    });

    it("returns HTTP errors as JSON", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "not found" }, 404));
      const out = JSON.parse(await provider.findService({ id: "svc_x" }));
      expect(out.success).toBe(false);
      expect(out.error).toContain("404");
    });
  });

  describe("routeTask", () => {
    it("defaults the network constraint to Base Sepolia", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ candidates: [] }));
      await provider.routeTask({ task: "timestamp notary", budget: "10000" });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({
        task: "timestamp notary",
        budget: "10000",
        constraints: { network: "eip155:84532" },
      });
    });
  });

  describe("placeOrder", () => {
    it("checks, funds and records an escrow order", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(escrowOrder()))
        .mockResolvedValueOnce(jsonResponse({ status: "funded", verdict: null }))
        .mockResolvedValueOnce(jsonResponse({ receipt: { v: "agentcoin-notary/v1" } }));
      wallet.sendTransaction.mockResolvedValueOnce(TX1).mockResolvedValueOnce(TX2);
      wallet.waitForTransactionReceipt
        .mockResolvedValueOnce({ status: "success", logs: [] })
        .mockResolvedValueOnce({ status: "success", logs: [jobCreatedLog()] });

      const out = JSON.parse(
        await provider.placeOrder(wallet, {
          serviceId: "svc_962928f654d2a8a1",
          body: { sha256: SPEC_HASH },
        }),
      );

      expect(out.jobId).toBe("42");
      expect(out.status).toBe("funded");
      expect(out.transactions).toEqual([
        { label: "approve", hash: TX1 },
        { label: "createAndFundFor", hash: TX2 },
      ]);
      expect(wallet.sendTransaction).toHaveBeenCalledTimes(2);
      const orderBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(orderBody).toEqual({
        serviceId: "svc_962928f654d2a8a1",
        mode: "escrow",
        buyer: BUYER,
      });
      expect(fetchMock.mock.calls[1][0]).toBe(
        "https://router.example/v1/orders/ord_0123456789abcdef/receipt",
      );
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ jobId: "42", paymentTx: TX2 });
      const header = fetchMock.mock.calls[2][1].headers["PAYMENT-SIGNATURE"];
      expect(JSON.parse(Buffer.from(header, "base64").toString())).toEqual({
        x402Version: 2,
        accepted: { scheme: "agentcoin-escrow", network: "eip155:84532" },
        payload: { jobId: "42", txHash: TX2 },
      });
    });

    it("refuses an amount above maxPayment", async () => {
      const order = escrowOrder();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ ...order, escrow: { ...order.escrow, amount: "60000" } }),
      );
      const out = JSON.parse(
        await provider.placeOrder(wallet, { serviceId: "svc_962928f654d2a8a1" }),
      );
      expect(out.success).toBe(false);
      expect(out.error).toContain("maxPayment");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses an unexpected escrow contract", async () => {
      const order = escrowOrder();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ ...order, escrow: { ...order.escrow, contract: EVALUATOR } }),
      );
      const out = JSON.parse(
        await provider.placeOrder(wallet, { serviceId: "svc_962928f654d2a8a1" }),
      );
      expect(out.success).toBe(false);
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("refuses a funding transaction for another client", async () => {
      wallet.getAddress.mockReturnValue(PROVIDER);
      fetchMock.mockResolvedValueOnce(jsonResponse(escrowOrder()));
      const out = JSON.parse(
        await provider.placeOrder(wallet, { serviceId: "svc_962928f654d2a8a1" }),
      );
      expect(out.success).toBe(false);
      expect(out.error).toContain("client");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("respects allowedServiceIds", async () => {
      const limited = agentcoinActionProvider({ allowedServiceIds: ["svc_a"] });
      const out = JSON.parse(await limited.placeOrder(wallet, { serviceId: "svc_b" }));
      expect(out.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("getOrder", () => {
    it("reads the order", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ orderId: "ord_1", verdict: "complete" }));
      const out = JSON.parse(await provider.getOrder({ orderId: "ord_1" }));
      expect(fetchMock.mock.calls[0][0]).toBe("https://router.example/v1/orders/ord_1");
      expect(out.verdict).toBe("complete");
    });
  });

  describe("claimListing", () => {
    it("returns the claim challenge without signing", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ typedData: {} }));
      await provider.claimListing(wallet, { serviceId: "svc_1" });
      expect(fetchMock.mock.calls[0][0]).toBe("https://router.example/v1/services/svc_1/claim");
      expect(wallet.signTypedData).not.toHaveBeenCalled();
    });

    it("signs and submits an EIP-712 claim", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ id: "svc_1", metadataHash: SPEC_HASH }))
        .mockResolvedValueOnce(jsonResponse({ claimed: true }));
      wallet.signTypedData.mockResolvedValue("0xsig");
      const out = JSON.parse(
        await provider.claimListing(wallet, { serviceId: "svc_1", sign: true }),
      );
      expect(out.claimed).toBe(true);
      expect(wallet.signTypedData.mock.calls[0][0].primaryType).toBe("Claim");
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).signature).toBe("0xsig");
    });
  });

  describe("refund", () => {
    const job = (state: number, extra: Record<string, unknown> = {}) => ({
      client: BUYER,
      state,
      accepted: true,
      deadline: 1n,
      ...extra,
    });

    it("sends claimRefund for a funded job past its deadline", async () => {
      wallet.readContract.mockResolvedValue(job(2));
      const simulateContract = jest.fn().mockResolvedValue({});
      wallet.getPublicClient.mockReturnValue({ simulateContract } as never);
      wallet.sendTransaction.mockResolvedValue(TX1);
      wallet.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
      const out = JSON.parse(await provider.refund(wallet, { jobId: "42" }));
      expect(out).toMatchObject({ action: "claimRefund", sent: true, tx: TX1 });
      expect(simulateContract.mock.calls[0][0].functionName).toBe("claimRefund");
    });

    it("returns the reason when no refund applies", async () => {
      wallet.readContract.mockResolvedValue(job(8));
      const out = JSON.parse(await provider.refund(wallet, { jobId: "42" }));
      expect(out.sent).toBe(false);
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });

    it("does not send when the simulation reverts", async () => {
      wallet.readContract.mockResolvedValue(job(3));
      wallet.getPublicClient.mockReturnValue({
        simulateContract: jest.fn().mockRejectedValue(new Error("EvalWindowOpen")),
      } as never);
      const out = JSON.parse(await provider.refund(wallet, { jobId: "42" }));
      expect(out.sent).toBe(false);
      expect(out.reason).toContain("simulation reverted");
      expect(wallet.sendTransaction).not.toHaveBeenCalled();
    });
  });
});
