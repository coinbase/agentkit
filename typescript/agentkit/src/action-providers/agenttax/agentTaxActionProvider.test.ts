import { agentTaxActionProvider, AgentTaxActionProvider } from "./agentTaxActionProvider";
import { AGENTTAX_BUILDER_CODE, AGENTTAX_BUILDER_CODE_SUFFIX, USDC_ADDRESSES } from "./constants";
import {
  CalculateTaxSchema,
  CheckNexusStatusSchema,
  Export1099DaSchema,
  GetLocalRateSchema,
  RemitTaxOnchainSchema,
} from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

// -----------------------------------------------------------------------------
// Test fixtures
// -----------------------------------------------------------------------------

const MOCK_API_KEY = "agenttax_test_key_0123456789";
const MOCK_BASE_URL = "https://test.agenttax.io";
const MOCK_RESERVE_WALLET = "0x1111111111111111111111111111111111111111";
const MOCK_RECIPIENT = "0x2222222222222222222222222222222222222222";
const MOCK_WALLET_ADDRESS = "0x3333333333333333333333333333333333333333";
const MOCK_TX_HASH = "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1";

/**
 * Builds a mocked EvmWalletProvider preconfigured for a given Base network.
 *
 * @param networkId - Network ID to return from `getNetwork()`. Defaults to base-mainnet.
 * @returns A jest-mocked EvmWalletProvider suitable for unit tests.
 */
function makeMockWallet(networkId: string = "base-mainnet"): jest.Mocked<EvmWalletProvider> {
  const wallet = {
    getAddress: jest.fn().mockReturnValue(MOCK_WALLET_ADDRESS),
    getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId }),
    sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
    waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
    getName: jest.fn().mockReturnValue("evm_wallet_provider"),
  } as unknown as jest.Mocked<EvmWalletProvider>;
  return wallet;
}

/**
 * Installs a mock for `global.fetch` and returns the jest mock function so
 * individual tests can configure its return values.
 *
 * @returns The jest.Mock that has been installed as `global.fetch`.
 */
function mockFetch(): jest.Mock {
  const fn = jest.fn();
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

// -----------------------------------------------------------------------------
// Schema validation
// -----------------------------------------------------------------------------

describe("CalculateTaxSchema", () => {
  it("accepts valid input and normalizes state code + isB2B default", () => {
    const parsed = CalculateTaxSchema.safeParse({
      amount: 10.5,
      buyerState: "tx",
      buyerZip: "77001",
      transactionType: "compute",
      counterpartyId: "agent_abc123",
      isB2B: null,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.buyerState).toBe("TX");
    expect(parsed.data?.isB2B).toBe(false);
  });

  it("rejects non-positive amount", () => {
    const parsed = CalculateTaxSchema.safeParse({
      amount: 0,
      buyerState: "TX",
      buyerZip: null,
      transactionType: "compute",
      counterpartyId: "agent_abc",
      isB2B: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid state code length", () => {
    const parsed = CalculateTaxSchema.safeParse({
      amount: 1,
      buyerState: "TEX",
      buyerZip: null,
      transactionType: "compute",
      counterpartyId: "agent_abc",
      isB2B: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid transactionType", () => {
    const parsed = CalculateTaxSchema.safeParse({
      amount: 1,
      buyerState: "TX",
      buyerZip: null,
      transactionType: "not_a_real_type",
      counterpartyId: "agent_abc",
      isB2B: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects missing counterpartyId", () => {
    const parsed = CalculateTaxSchema.safeParse({
      amount: 1,
      buyerState: "TX",
      buyerZip: null,
      transactionType: "compute",
      counterpartyId: "",
      isB2B: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid zip format", () => {
    const parsed = CalculateTaxSchema.safeParse({
      amount: 1,
      buyerState: "TX",
      buyerZip: "ABC",
      transactionType: "compute",
      counterpartyId: "agent_abc",
      isB2B: null,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("GetLocalRateSchema", () => {
  it("accepts 5-digit and 9-digit zips", () => {
    expect(GetLocalRateSchema.safeParse({ zip: "77001" }).success).toBe(true);
    expect(GetLocalRateSchema.safeParse({ zip: "77001-1234" }).success).toBe(true);
  });

  it("rejects non-numeric zip", () => {
    expect(GetLocalRateSchema.safeParse({ zip: "ABCDE" }).success).toBe(false);
  });
});

describe("CheckNexusStatusSchema", () => {
  it("accepts one or more state codes", () => {
    expect(CheckNexusStatusSchema.safeParse({ states: ["TX", "NY", "CA"] }).success).toBe(true);
  });

  it("rejects empty states array", () => {
    expect(CheckNexusStatusSchema.safeParse({ states: [] }).success).toBe(false);
  });
});

describe("Export1099DaSchema", () => {
  it("accepts a valid tax year", () => {
    expect(Export1099DaSchema.safeParse({ year: 2026 }).success).toBe(true);
  });

  it("rejects non-integer year", () => {
    expect(Export1099DaSchema.safeParse({ year: 2026.5 }).success).toBe(false);
  });

  it("rejects out-of-range year", () => {
    expect(Export1099DaSchema.safeParse({ year: 1999 }).success).toBe(false);
  });
});

describe("RemitTaxOnchainSchema", () => {
  it("accepts minimum valid input", () => {
    const parsed = RemitTaxOnchainSchema.safeParse({
      amountUsdc: 1.25,
      recipient: null,
      jurisdiction: null,
      reference: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid recipient address", () => {
    const parsed = RemitTaxOnchainSchema.safeParse({
      amountUsdc: 1.25,
      recipient: "not-an-address",
      jurisdiction: null,
      reference: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-positive amount", () => {
    const parsed = RemitTaxOnchainSchema.safeParse({
      amountUsdc: 0,
      recipient: null,
      jurisdiction: null,
      reference: null,
    });
    expect(parsed.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Builder Code encoding — regression test on the canonical suffix
// -----------------------------------------------------------------------------

describe("Builder Code constants", () => {
  it("raw code matches registered value", () => {
    expect(AGENTTAX_BUILDER_CODE).toBe("bc_626v2pr2");
  });

  it("encoded suffix matches the ERC-8021 hex issued by base.dev", () => {
    expect(AGENTTAX_BUILDER_CODE_SUFFIX).toBe(
      "0x62635f36323676327072320b0080218021802180218021802180218021",
    );
  });

  it("encoded suffix decodes to [ascii code][length 0x0b][magic 0x8021 pattern]", () => {
    const hex = AGENTTAX_BUILDER_CODE_SUFFIX.slice(2);
    // First 11 bytes = ASCII "bc_626v2pr2"
    const codeBytes = hex.slice(0, 22);
    const decodedCode = Buffer.from(codeBytes, "hex").toString("ascii");
    expect(decodedCode).toBe(AGENTTAX_BUILDER_CODE);

    // Next byte = length of the code (11 = 0x0b)
    expect(hex.slice(22, 24)).toBe("0b");

    // Remaining bytes start with 00 then alternating 8021 pattern
    const magic = hex.slice(24);
    expect(magic.startsWith("0080218021")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// calculate_tax
// -----------------------------------------------------------------------------

describe("calculate_tax action", () => {
  let fetchMock: jest.Mock;
  const provider = agentTaxActionProvider({ baseUrl: MOCK_BASE_URL });

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it("returns parsed tax data on success and sends the correct request body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          total_tax: 0.825,
          combined_rate: 0.0825,
          buyer_state: "TX",
          jurisdiction: "TX",
          transaction_type: "compute",
          work_type: "compute",
        }),
    });

    const response = await provider.calculateTax(makeMockWallet(), {
      amount: 10,
      buyerState: "TX",
      buyerZip: null,
      transactionType: "compute",
      counterpartyId: "agent_abc123",
      isB2B: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${MOCK_BASE_URL}/api/v1/calculate`,
      expect.objectContaining({ method: "POST" }),
    );
    // Verify the request body shape matches the AgentTax API contract.
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as { body: string }).body);
    expect(body).toMatchObject({
      role: "seller",
      amount: 10,
      buyer_state: "TX",
      transaction_type: "compute",
      counterparty_id: "agent_abc123",
      is_b2b: false,
    });
    expect(response).toContain('"total_tax": 0.825');
    expect(response).toContain('"buyer_state": "TX"');
  });

  it("surfaces HTTP-level errors as a descriptive error string", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      text: async () => JSON.stringify({ error: "invalid state" }),
    });

    const response = await provider.calculateTax(makeMockWallet(), {
      amount: 10,
      buyerState: "XX",
      buyerZip: null,
      transactionType: "compute",
      counterpartyId: "agent_abc",
      isB2B: false,
    });

    expect(response).toContain("Error (calculate_tax): HTTP 422 — invalid state");
  });

  it("surfaces { success: false, error } 200 responses as errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: false,
          error: 'Invalid transaction_type "foo"',
        }),
    });

    const response = await provider.calculateTax(makeMockWallet(), {
      amount: 10,
      buyerState: "TX",
      buyerZip: null,
      transactionType: "compute",
      counterpartyId: "agent_abc",
      isB2B: false,
    });

    expect(response).toContain('Error (calculate_tax): Invalid transaction_type "foo"');
  });

  it("handles network errors without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const response = await provider.calculateTax(makeMockWallet(), {
      amount: 10,
      buyerState: "TX",
      buyerZip: null,
      transactionType: "compute",
      counterpartyId: "agent_abc",
      isB2B: false,
    });

    expect(response).toContain("Error (calculate_tax)");
    expect(response).toContain("ECONNREFUSED");
  });
});

// -----------------------------------------------------------------------------
// get_local_rate
// -----------------------------------------------------------------------------

describe("get_local_rate action", () => {
  let fetchMock: jest.Mock;
  const provider = agentTaxActionProvider({ baseUrl: MOCK_BASE_URL });

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it("returns parsed rate data", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          state_rate: 0.0625,
          local_rate: 0.02,
          combined_rate: 0.0825,
          jurisdiction: "Harris County",
          confidence: 0.97,
        }),
    });

    const response = await provider.getLocalRate(makeMockWallet(), { zip: "77001" });
    expect(fetchMock).toHaveBeenCalledWith(
      `${MOCK_BASE_URL}/api/v1/rates/local?zip=77001`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(response).toContain('"combined_rate": 0.0825');
  });
});

// -----------------------------------------------------------------------------
// check_nexus_status & export_1099_da — work with or without apiKey.
// Without a key the API returns demo data, with one it returns real data.
// -----------------------------------------------------------------------------

describe("nexus / 1099-da actions without apiKey (demo mode)", () => {
  let fetchMock: jest.Mock;
  const provider = agentTaxActionProvider({ baseUrl: MOCK_BASE_URL });

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it("check_nexus_status sends request without X-API-Key header when no key", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ entity_id: "demo_entity", total_nexus_states: 0 }),
    });
    await provider.checkNexusStatus(makeMockWallet(), { states: ["TX"] });
    const [, options] = fetchMock.mock.calls[0];
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers["X-API-Key"]).toBeUndefined();
  });

  it("export_1099_da sends request without X-API-Key header when no key", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ form: "1099-DA", tax_year: 2026 }),
    });
    await provider.export1099Da(makeMockWallet(), { year: 2026 });
    const [, options] = fetchMock.mock.calls[0];
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers["X-API-Key"]).toBeUndefined();
  });
});

describe("nexus / 1099-da actions with apiKey", () => {
  let fetchMock: jest.Mock;
  const provider = agentTaxActionProvider({
    baseUrl: MOCK_BASE_URL,
    apiKey: MOCK_API_KEY,
  });

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it("check_nexus_status builds a multi-state query and passes the api key", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          nexus: { TX: "triggered", NY: "approaching" },
        }),
    });

    const response = await provider.checkNexusStatus(makeMockWallet(), {
      states: ["TX", "NY"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${MOCK_BASE_URL}/api/v1/nexus?states=TX&states=NY`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "X-API-Key": MOCK_API_KEY }),
      }),
    );
    expect(response).toContain("triggered");
  });

  it("check_nexus_status surfaces { success: false } as an error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: false,
          error: "entity not found",
        }),
    });

    const response = await provider.checkNexusStatus(makeMockWallet(), {
      states: ["TX"],
    });

    expect(response).toContain("Error (check_nexus_status): entity not found");
  });

  it("export_1099_da passes year and returns data", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          year: 2026,
          entity_name: "Example LLC",
          total_proceeds: 12500.0,
        }),
    });

    const response = await provider.export1099Da(makeMockWallet(), { year: 2026 });
    expect(fetchMock).toHaveBeenCalledWith(
      `${MOCK_BASE_URL}/api/v1/export/1099-da?year=2026`,
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": MOCK_API_KEY }),
      }),
    );
    expect(response).toContain('"total_proceeds": 12500');
  });

  it("export_1099_da surfaces { success: false } as an error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: false,
          error: "no transactions found for year",
        }),
    });

    const response = await provider.export1099Da(makeMockWallet(), { year: 2020 });
    expect(response).toContain("Error (export_1099_da): no transactions found for year");
  });
});

// -----------------------------------------------------------------------------
// remit_tax_onchain — the headline Builder Code action
// -----------------------------------------------------------------------------

describe("remit_tax_onchain action", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it("errors when called on a non-Base network", async () => {
    const provider = agentTaxActionProvider({
      baseUrl: MOCK_BASE_URL,
      reserveWallet: MOCK_RESERVE_WALLET,
    });
    const wallet = makeMockWallet("ethereum-mainnet");
    const response = await provider.remitTaxOnchain(wallet, {
      amountUsdc: 1,
      recipient: null,
      jurisdiction: null,
      reference: null,
    });
    expect(response).toContain("only supports base-mainnet and base-sepolia");
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });

  it("errors when no recipient and no reserveWallet", async () => {
    const provider = agentTaxActionProvider({ baseUrl: MOCK_BASE_URL });
    const wallet = makeMockWallet("base-mainnet");
    const response = await provider.remitTaxOnchain(wallet, {
      amountUsdc: 1,
      recipient: null,
      jurisdiction: null,
      reference: null,
    });
    expect(response).toContain("no recipient address provided");
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });

  it("sends USDC transfer with Builder Code suffix appended on base-mainnet", async () => {
    const provider = agentTaxActionProvider({
      baseUrl: MOCK_BASE_URL,
      apiKey: MOCK_API_KEY,
      reserveWallet: MOCK_RESERVE_WALLET,
    });
    const wallet = makeMockWallet("base-mainnet");

    // Best-effort audit log call — mock fetch to succeed
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ logged: true }),
    });

    const response = await provider.remitTaxOnchain(wallet, {
      amountUsdc: 2.5,
      recipient: MOCK_RECIPIENT,
      jurisdiction: "TX",
      reference: "txn_abc123",
    });

    // Verify sendTransaction was called
    expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    const call = wallet.sendTransaction.mock.calls[0][0] as { to: string; data: string };

    // Correct USDC address for base-mainnet
    expect(call.to.toLowerCase()).toBe(USDC_ADDRESSES["base-mainnet"].toLowerCase());

    // Calldata must end with the Builder Code suffix body (without 0x)
    const expectedSuffix = AGENTTAX_BUILDER_CODE_SUFFIX.slice(2);
    expect(call.data.toLowerCase().endsWith(expectedSuffix.toLowerCase())).toBe(true);

    // Calldata should include the ERC20 transfer selector 0xa9059cbb
    expect(call.data.toLowerCase().startsWith("0xa9059cbb")).toBe(true);

    // Audit log was called
    expect(fetchMock).toHaveBeenCalledWith(
      `${MOCK_BASE_URL}/api/v1/transactions`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-API-Key": MOCK_API_KEY }),
      }),
    );

    expect(response).toContain("Remitted 2.5 USDC");
    expect(response).toContain(MOCK_RECIPIENT);
    expect(response).toContain(MOCK_TX_HASH);
    expect(response).toContain("Builder Code: bc_626v2pr2");
    expect(response).toContain("Jurisdiction: TX");
    expect(response).toContain("Reference: txn_abc123");
    expect(response).toContain("Audit log: recorded in AgentTax");
  });

  it("skips audit log when no apiKey is configured but still completes the transfer", async () => {
    const provider = agentTaxActionProvider({
      baseUrl: MOCK_BASE_URL,
      reserveWallet: MOCK_RESERVE_WALLET,
    });
    const wallet = makeMockWallet("base-mainnet");

    const response = await provider.remitTaxOnchain(wallet, {
      amountUsdc: 1,
      recipient: null,
      jurisdiction: null,
      reference: null,
    });

    expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response).toContain("Audit log: skipped");
  });

  it("does NOT append the Builder Code suffix when builderCodeEnabled is false", async () => {
    const provider = agentTaxActionProvider({
      baseUrl: MOCK_BASE_URL,
      reserveWallet: MOCK_RESERVE_WALLET,
      builderCodeEnabled: false,
    });
    const wallet = makeMockWallet("base-mainnet");

    await provider.remitTaxOnchain(wallet, {
      amountUsdc: 1,
      recipient: MOCK_RECIPIENT,
      jurisdiction: null,
      reference: null,
    });

    const call = wallet.sendTransaction.mock.calls[0][0] as { data: string };
    const suffix = AGENTTAX_BUILDER_CODE_SUFFIX.slice(2);
    expect(call.data.toLowerCase().endsWith(suffix.toLowerCase())).toBe(false);
  });

  it("gracefully returns error string on sendTransaction failure", async () => {
    const provider = agentTaxActionProvider({
      baseUrl: MOCK_BASE_URL,
      reserveWallet: MOCK_RESERVE_WALLET,
    });
    const wallet = makeMockWallet("base-mainnet");
    wallet.sendTransaction.mockRejectedValueOnce(new Error("insufficient funds"));

    const response = await provider.remitTaxOnchain(wallet, {
      amountUsdc: 1,
      recipient: MOCK_RECIPIENT,
      jurisdiction: null,
      reference: null,
    });

    expect(response).toContain("Error submitting remittance transaction");
    expect(response).toContain("insufficient funds");
  });
});

// -----------------------------------------------------------------------------
// supportsNetwork
// -----------------------------------------------------------------------------

describe("supportsNetwork", () => {
  const provider = agentTaxActionProvider();

  it("returns true for EVM networks", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" })).toBe(
      true,
    );
  });

  it("returns false for non-EVM networks", () => {
    expect(
      provider.supportsNetwork({ protocolFamily: "solana", networkId: "solana-mainnet" }),
    ).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Provider factory + class sanity
// -----------------------------------------------------------------------------

describe("provider factory", () => {
  it("agentTaxActionProvider() returns an AgentTaxActionProvider instance", () => {
    const provider = agentTaxActionProvider();
    expect(provider).toBeInstanceOf(AgentTaxActionProvider);
    expect(provider.name).toBe("agenttax");
  });
});
