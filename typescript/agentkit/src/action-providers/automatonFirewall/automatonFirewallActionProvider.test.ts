import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyTypedData } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  automatonFirewallActionProvider,
  AUTOMATON_PAY_TO,
  USDC_BASE,
} from "./automatonFirewallActionProvider";
import { SimulateAndGuardInputSchema } from "./schemas";

const PAYER = "0x1111111111111111111111111111111111111111";
const STRANGER = "0x2222222222222222222222222222222222222222";
const ARGS = SimulateAndGuardInputSchema.parse({
  targetContract: "0x3333333333333333333333333333333333333333",
  calldata: "0x",
  fromAddress: null,
  valueWei: null,
  tokenAddress: null,
});
const VERDICT = { verdict: "SAFE", riskScore: 3 };

const accept = (overrides: Record<string, unknown> = {}) => ({
  scheme: "exact",
  network: "eip155:8453",
  asset: USDC_BASE,
  amount: "20000",
  payTo: AUTOMATON_PAY_TO,
  ...overrides,
});

const response = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  json: async () => body,
});

const fetchMock = jest.fn();
global.fetch = fetchMock;

/**
 * First call answers 402 with the given accepts in the payment-required header; a paid retry answers 200.
 *
 * @param accepts - The x402 accepts[] entries of the challenge.
 */
function mock402(accepts: unknown[]) {
  const challenge = { x402Version: 2, accepts };
  fetchMock.mockImplementation(async (url: string, init: { headers: Record<string, string> }) => {
    // Only the firewall answers 402; anything else (e.g. AgentKit analytics) gets an empty 200.
    if (!String(url).endsWith("/v2/firewall/simulate-tx")) return response(200, {});
    if (init.headers["X-PAYMENT-AUTH"] || init.headers["X-PAYMENT"]) return response(200, VERDICT);
    return response(402, challenge, {
      "payment-required": Buffer.from(JSON.stringify(challenge)).toString("base64"),
    });
  });
}

const makeWalletProvider = (signature = `0x${"ab".repeat(65)}`) => {
  const wallet = Object.create(EvmWalletProvider.prototype);
  wallet.getAddress = jest.fn().mockReturnValue(PAYER);
  wallet.signTypedData = jest.fn().mockResolvedValue(signature);
  wallet.getName = jest.fn().mockReturnValue("mock_wallet_provider");
  wallet.getNetwork = jest
    .fn()
    .mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" });
  return wallet as EvmWalletProvider & { signTypedData: jest.Mock };
};

const paidRetryHeaders = () => {
  const call = fetchMock.mock.calls.find(
    ([, init]) => init.headers["X-PAYMENT"] || init.headers["X-PAYMENT-AUTH"],
  );
  expect(call).toBeDefined();
  return call![1].headers as Record<string, string>;
};
const decode = (header: string) => JSON.parse(Buffer.from(header, "base64").toString("utf8"));

describe("AutomatonFirewallActionProvider", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("payment guards (checked before any signature)", () => {
    const expectRefused = (out: Record<string, unknown>, wallet: { signTypedData: jest.Mock }) => {
      expect(wallet.signTypedData).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(out.status).toBe("payment_refused");
      expect(out.verdict).toBeNull();
      expect(out.riskScore).toBeNull();
    };

    it("refuses when the cap is below the challenge amount", async () => {
      mock402([accept()]);
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider({
          maxAmountUnits: 19999,
        }).simulateAndGuardTransaction(wallet, ARGS),
      );
      expectRefused(out, wallet);
      expect(out.error).toBe("amount_above_cap");
    });

    it("signs value 20000 to the treasury when the cap equals the challenge amount", async () => {
      mock402([accept()]);
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider({
          maxAmountUnits: 20000,
        }).simulateAndGuardTransaction(wallet, ARGS),
      );
      expect(wallet.signTypedData).toHaveBeenCalledTimes(1);
      const typedData = wallet.signTypedData.mock.calls[0][0];
      expect(typedData.message.value).toBe("20000");
      expect(typedData.message.to).toBe(AUTOMATON_PAY_TO);
      expect(typedData.domain.verifyingContract).toBe(USDC_BASE);
      expect(typedData.domain.chainId).toBe(8453);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(out).toEqual(VERDICT);
    });

    it("refuses an accept on another network", async () => {
      mock402([accept({ network: "eip155:1" })]);
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS),
      );
      expectRefused(out, wallet);
      expect(out.error).toBe("no_supported_requirement");
    });

    it("refuses an accept whose asset is not USDC on Base", async () => {
      mock402([accept({ asset: STRANGER })]);
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS),
      );
      expectRefused(out, wallet);
      expect(out.error).toBe("no_supported_requirement");
    });

    it("refuses a payTo outside the treasury", async () => {
      mock402([accept({ payTo: STRANGER })]);
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS),
      );
      expectRefused(out, wallet);
      expect(out.error).toBe("payto_not_allowed");
    });

    it("refuses a missing amount instead of falling back to a fixed value", async () => {
      mock402([accept({ amount: undefined })]);
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS),
      );
      expectRefused(out, wallet);
      expect(out.error).toBe("bad_amount");
    });

    it("skips a hostile first accept and signs the valid USDC/Base/treasury one", async () => {
      mock402([accept({ network: "eip155:1", payTo: STRANGER, amount: "999999999" }), accept()]);
      const wallet = makeWalletProvider();
      await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS);
      expect(wallet.signTypedData).toHaveBeenCalledTimes(1);
      expect(wallet.signTypedData.mock.calls[0][0].message.to).toBe(AUTOMATON_PAY_TO);
      expect(wallet.signTypedData.mock.calls[0][0].message.value).toBe("20000");
    });

    it("sends no payment header of any kind when a guard refuses", async () => {
      for (const bad of [
        accept({ amount: "20001" }),
        accept({ network: "eip155:1" }),
        accept({ asset: STRANGER }),
        accept({ payTo: STRANGER }),
      ]) {
        fetchMock.mockReset();
        mock402([bad]);
        await automatonFirewallActionProvider().simulateAndGuardTransaction(
          makeWalletProvider(),
          ARGS,
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers["X-PAYMENT"]).toBeUndefined();
        expect(headers["X-PAYMENT-AUTH"]).toBeUndefined();
      }
    });
  });

  describe("wire format of the paid retry", () => {
    it("sends X-PAYMENT-AUTH with the FLAT envelope (six fields in payload, signature on top)", async () => {
      mock402([accept()]);
      const wallet = makeWalletProvider();
      await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS);
      const envelope = decode(paidRetryHeaders()["X-PAYMENT-AUTH"]);
      expect(Object.keys(envelope.payload).sort()).toEqual([
        "from",
        "nonce",
        "to",
        "validAfter",
        "validBefore",
        "value",
      ]);
      expect(envelope.payload.authorization).toBeUndefined();
      expect(envelope.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
      expect(envelope.network).toBe("eip155:8453");
      expect(envelope.scheme).toBe("exact");
      for (const field of ["value", "validAfter", "validBefore"]) {
        expect(typeof envelope.payload[field]).toBe("string");
      }
      expect(envelope.payload).toEqual(wallet.signTypedData.mock.calls[0][0].message);
    });

    it("keeps X-PAYMENT with the same envelope for backward compatibility", async () => {
      mock402([accept()]);
      await automatonFirewallActionProvider().simulateAndGuardTransaction(
        makeWalletProvider(),
        ARGS,
      );
      const headers = paidRetryHeaders();
      expect(headers["X-PAYMENT"]).toBe(headers["X-PAYMENT-AUTH"]);
    });

    it("produces an EIP-712 signature that recovers to the payer", async () => {
      const account = privateKeyToAccount(generatePrivateKey());
      const wallet = Object.create(EvmWalletProvider.prototype);
      wallet.getAddress = () => account.address;
      wallet.getName = () => "viem_account";
      wallet.getNetwork = () => ({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      });
      wallet.signTypedData = (typedData: Parameters<typeof account.signTypedData>[0]) =>
        account.signTypedData(typedData);
      mock402([accept()]);
      await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS);
      const envelope = decode(paidRetryHeaders()["X-PAYMENT-AUTH"]);
      const valid = await verifyTypedData({
        address: account.address,
        domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC_BASE },
        types: {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: {
          ...envelope.payload,
          value: BigInt(envelope.payload.value),
          validAfter: BigInt(envelope.payload.validAfter),
          validBefore: BigInt(envelope.payload.validBefore),
        },
        signature: envelope.signature,
      });
      expect(valid).toBe(true);
    });
  });

  describe("results that are not a paid verdict", () => {
    it("returns an explicit unavailable state on a network error, never REJECT with a risk score", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS),
      );
      expect(wallet.signTypedData).not.toHaveBeenCalled();
      expect(out.status).toBe("unavailable");
      expect(out.verdict).toBeNull();
      expect(out.riskScore).toBeNull();
      expect(out.error).toBe("firewall_unavailable");
    });

    it("passes a non-402 answer (free trial) through without signing", async () => {
      fetchMock.mockResolvedValue(response(200, VERDICT, { "x-free-trial": "true" }));
      const wallet = makeWalletProvider();
      const out = JSON.parse(
        await automatonFirewallActionProvider().simulateAndGuardTransaction(wallet, ARGS),
      );
      expect(wallet.signTypedData).not.toHaveBeenCalled();
      expect(out).toEqual(VERDICT);
    });
  });

  describe("provider wiring", () => {
    it("supports Base mainnet only", () => {
      const provider = automatonFirewallActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })).toBe(
        false,
      );
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        false,
      );
    });

    it("exposes simulate_and_guard_transaction through getActions and injects the wallet", async () => {
      mock402([accept()]);
      const wallet = makeWalletProvider();
      const actions = automatonFirewallActionProvider().getActions(wallet);
      const action = actions.find(a => a.name.endsWith("simulate_and_guard_transaction"));
      expect(action).toBeDefined();
      expect(JSON.parse(await action!.invoke(ARGS))).toEqual(VERDICT);
      expect(wallet.signTypedData).toHaveBeenCalledTimes(1);
    });

    it("rejects a malformed target address and fills nullable defaults", () => {
      expect(() =>
        SimulateAndGuardInputSchema.parse({ ...ARGS, targetContract: "0x12" }),
      ).toThrow();
      const parsed = SimulateAndGuardInputSchema.parse({
        targetContract: ARGS.targetContract,
        calldata: null,
        fromAddress: null,
        valueWei: null,
        tokenAddress: null,
      });
      expect(parsed.calldata).toBe("0x");
      expect(parsed.valueWei).toBe("0");
    });
  });
});
