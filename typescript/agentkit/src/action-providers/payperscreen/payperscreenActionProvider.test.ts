import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { payperscreenActionProvider } from "./payperscreenActionProvider";
import { ScreenNameSchema, ScreenWalletSchema, CheckIpSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

jest.mock("@x402/fetch");
jest.mock("@x402/evm/exact/client");

type Requirement = { network: string; asset: string; amount: string };
type Policy = (version: number, requirements: Requirement[]) => Requirement[];

const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const offer = (amount: string, network = "eip155:8453", asset = BASE_USDC): Requirement => ({
  network,
  asset,
  amount,
});

let policy: Policy | null = null;
const mockClient = {
  registerPolicy: jest.fn((p: Policy) => {
    policy = p;
    return mockClient;
  }),
};
const mockFetchWithPayment = jest.fn();

jest.mocked(x402Client).mockImplementation(() => mockClient as unknown as x402Client);
jest.mocked(registerExactEvmScheme).mockImplementation(() => mockClient as unknown as x402Client);
jest.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPayment);

const receipt = Buffer.from(
  JSON.stringify({ success: true, transaction: "0xabc", network: "eip155:8453" }),
).toString("base64");

/**
 * Simulates the x402 client: runs the registered policy on the offered requirements and,
 * when one is selected, returns a paid 200 response.
 *
 * @param offers - The payment requirements the server offers.
 * @param body - The JSON body to return when paid.
 */
function serverOffers(offers: Requirement[], body: unknown = { hits: [] }) {
  mockFetchWithPayment.mockImplementation(async () => {
    const selected = policy ? policy(2, offers) : offers;
    if (!selected.length) throw new Error("No payment requirements matched");
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "payment-response": receipt },
    });
  });
}

describe("PayPerScreenActionProvider", () => {
  const wallet = {
    toSigner: jest.fn().mockReturnValue({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
    readContract: jest.fn(),
    getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", chainId: "8453" }),
  } as unknown as EvmWalletProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    policy = null;
  });

  describe("supportsNetwork", () => {
    it("supports EVM networks only", () => {
      const provider = payperscreenActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
    });
  });

  describe("schemas", () => {
    it("requires a name and bounds the threshold", () => {
      expect(ScreenNameSchema.safeParse({ name: "Jane Doe", dob: "1990-01-01" }).success).toBe(
        true,
      );
      expect(ScreenNameSchema.safeParse({}).success).toBe(false);
      expect(ScreenNameSchema.safeParse({ name: "Jane", threshold: 2 }).success).toBe(false);
    });

    it("requires an address and an IP", () => {
      expect(ScreenWalletSchema.safeParse({}).success).toBe(false);
      expect(CheckIpSchema.safeParse({ ip: "8.8.8.8" }).success).toBe(true);
    });
  });

  describe("screenName", () => {
    it("pays $0.02 and returns the result with a receipt", async () => {
      serverOffers([offer("20000")], { subject: { name: "Jane Doe" }, hitCount: 0 });
      const provider = payperscreenActionProvider({ apiUrl: "https://api.example" });

      const out = JSON.parse(
        await provider.screenName(wallet, { name: "Jane Doe", country: "BR" }),
      );

      expect(out.success).toBe(true);
      expect(out.result.subject.name).toBe("Jane Doe");
      expect(out.payment).toMatchObject({
        paidUsd: 0.02,
        transaction: "0xabc",
        network: "eip155:8453",
      });
      expect(out.note).toMatch(/not a legal determination/);
      const [url, init] = mockFetchWithPayment.mock.calls[0];
      expect(url).toBe("https://api.example/screen?name=Jane+Doe&country=BR");
      expect(init.headers["x-payperscreen-client"]).toMatch(/^payperscreen-agentkit\//);
    });
  });

  describe("payment policy", () => {
    it("refuses a price above the per-check cap without paying", async () => {
      serverOffers([offer("100000")]);
      const provider = payperscreenActionProvider({ maxPriceUsd: 0.05 });

      const out = JSON.parse(await provider.checkIp(wallet, { ip: "8.8.8.8" }));

      expect(out.success).toBe(false);
      expect(out.error).toMatch(/above this agent's per-check cap/);
      expect(out.charged).toBe(false);
    });

    it("only signs USDC payment options", async () => {
      serverOffers([offer("20000", "eip155:8453", "0x0000000000000000000000000000000000000001")]);
      const provider = payperscreenActionProvider();

      const out = JSON.parse(await provider.checkEmail(wallet, { email: "a@example.com" }));

      expect(out.success).toBe(false);
      expect(out.error).toMatch(/No USDC payment option/);
    });

    it("prefers the wallet's own network when offered", () => {
      serverOffers([]);
      const polygonWallet = {
        ...wallet,
        getNetwork: () => ({ protocolFamily: "evm", chainId: "137" }),
      } as unknown as EvmWalletProvider;
      const provider = payperscreenActionProvider();
      void provider.screenWallet(polygonWallet, { address: "0xabc" });

      const polygon = offer("20000", "eip155:137", "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359");
      const selected = policy!(2, [offer("20000"), polygon]);
      expect(selected[0]).toBe(polygon);
    });

    it("stops at the total spending cap", async () => {
      serverOffers([offer("20000")]);
      const provider = payperscreenActionProvider({ maxSpendUsd: 0.03 });

      expect(JSON.parse(await provider.checkIp(wallet, { ip: "1.1.1.1" })).success).toBe(true);
      const second = JSON.parse(await provider.checkIp(wallet, { ip: "1.1.1.1" }));

      expect(second.success).toBe(false);
      expect(second.error).toMatch(/Spending cap reached/);
      expect(mockFetchWithPayment).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors", () => {
    it("reports a non-200 response as not charged", async () => {
      mockFetchWithPayment.mockResolvedValue(
        new Response(JSON.stringify({ error: "name is required" }), { status: 400 }),
      );
      const provider = payperscreenActionProvider();

      const out = JSON.parse(await provider.screenName(wallet, { name: "x" }));

      expect(out).toMatchObject({
        success: false,
        status: 400,
        error: "name is required",
        charged: false,
      });
    });
  });

  describe("listsCoverage", () => {
    it("is free and returns the list metadata", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify({ lists: [{ source: "OFAC" }] }), { status: 200 }),
        );
      const provider = payperscreenActionProvider({ apiUrl: "https://api.example/" });

      const out = JSON.parse(await provider.listsCoverage(wallet, {}));

      expect(out).toEqual({ success: true, data: { lists: [{ source: "OFAC" }] } });
      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.example/lists-meta");
      expect(wrapFetchWithPayment).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
