import { crewpayActionProvider, CrewpayActionProvider } from "./crewpayActionProvider";
import { CREWPAY_API_KEY_MISSING_ERROR } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";

const MOCK_KEY = "crew_ak_test";
const LAUNCHER = "0x1234567890123456789012345678901234567890";
const TOKEN = "0x2345678901234567890123456789012345678901";

const mockResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const unsignedPlan = {
  ok: true,
  mint: TOKEN,
  coinUrl: `https://crewpay.dev/coin/${TOKEN}`,
  steps: [
    {
      kind: "zora_create",
      tx: {
        type: 2,
        chainId: 8453,
        to: "0x3456789012345678901234567890123456789012",
        data: "0xabcdef",
        value: "0",
        nonce: 7,
        gas: "500000",
        maxFeePerGas: "1000000000",
        maxPriorityFeePerGas: "1000000",
      },
    },
  ],
};

describe("CrewpayActionProvider", () => {
  let provider: CrewpayActionProvider;
  let wallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.restoreAllMocks();
    provider = crewpayActionProvider({ apiKey: MOCK_KEY });
    wallet = {
      getAddress: jest.fn().mockReturnValue(LAUNCHER),
      getNetwork: jest
        .fn()
        .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
      signTransaction: jest.fn().mockResolvedValue("0xsigned"),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  afterEach(() => {
    delete process.env.CREWPAY_API_KEY;
  });

  describe("constructor", () => {
    it("reads the API key from the environment", () => {
      process.env.CREWPAY_API_KEY = "crew_ak_env";
      expect(crewpayActionProvider()["apiKey"]).toBe("crew_ak_env");
    });
  });

  describe("previewLaunch", () => {
    it("calls the free quickstart endpoint without auth", async () => {
      const providerNoKey = crewpayActionProvider();
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
        mockResponse({
          ok: true,
          feeMap: { crewPoolBps: 6000, agentBps: 1500, platformBps: 2500 },
          crew: [{ handle: "@kol" }],
          costs: {},
        }),
      );

      const result = await providerNoKey.previewLaunch({ name: "Night Owl", ticker: "HOOT" });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.crewpay.dev/api/agent/quickstart?name=Night+Owl&ticker=HOOT");
      expect((init?.headers as Record<string, string>)["x-crew-api-key"]).toBeUndefined();
      expect(JSON.parse(result).feeMap.agentBps).toBe(1500);
    });

    it("returns an error message when the API fails", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse({ ok: false, error: "bad ticker" }, 400));
      const result = await provider.previewLaunch({ name: "Night Owl", ticker: "HOOT" });
      expect(result).toContain("Error previewing CrewPay launch");
      expect(result).toContain("bad ticker");
    });
  });

  describe("launchCoin", () => {
    const args = {
      name: "Night Owl",
      ticker: "HOOT",
      imageUrl: "https://example.com/owl.png",
      platform: "zora" as const,
    };

    it("builds unsigned, signs locally and submits", async () => {
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(mockResponse(unsignedPlan))
        .mockResolvedValueOnce(mockResponse({ ok: true, mint: TOKEN }));

      const result = await provider.launchCoin(wallet, args);

      const buildBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.crewpay.dev/api/agent/launch/unsigned");
      expect(buildBody.launcherPubkey).toBe(LAUNCHER);
      expect(buildBody.platform).toBe("zora");

      expect(wallet.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "eip1559",
          nonce: 7,
          gas: BigInt(500000),
          value: BigInt(0),
        }),
      );

      const submitBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
      expect(fetchMock.mock.calls[1][0]).toBe("https://api.crewpay.dev/api/agent/launch/submit");
      expect(submitBody.signed).toEqual(["0xsigned"]);
      expect(submitBody.mint).toBe(TOKEN);
      expect(result).toContain(`Token: ${TOKEN}`);
      expect(result).toContain("15% this agent");
    });

    it("refuses to sign a transaction for another chain", async () => {
      wallet.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
        chainId: "84532",
      });
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(mockResponse(unsignedPlan));

      const result = await provider.launchCoin(wallet, args);

      expect(result).toContain("targets chain 8453");
      expect(wallet.signTransaction).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("requires an API key", async () => {
      const result = await crewpayActionProvider().launchCoin(wallet, args);
      expect(result).toBe(CREWPAY_API_KEY_MISSING_ERROR);
    });
  });

  describe("listLaunches", () => {
    it("lists launches for the key", async () => {
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse({ ok: true, launches: [{ ticker: "HOOT" }] }));
      const result = await provider.listLaunches({ limit: 5 });
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.crewpay.dev/api/agent/launches?limit=5");
      expect(
        (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)["x-crew-api-key"],
      ).toBe(MOCK_KEY);
      expect(JSON.parse(result)[0].ticker).toBe("HOOT");
    });
  });

  describe("supportsNetwork", () => {
    it("supports Base mainnet and Base Sepolia only", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "84532" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "1" })).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
    });
  });
});
