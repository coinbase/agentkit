import { createHash } from "crypto";
import { privateKeyToAccount } from "viem/accounts";
import { EvmWalletProvider } from "../../wallet-providers";
import { agoreanActionProvider } from "./agoreanActionProvider";

const SITE = "https://agorean.com";
const RESOURCE = "https://api.example.com/weather";
const PAY_TO = `0x${"11".repeat(20)}`;
const TX = `0x${"c4".repeat(32)}`;
const SAFETY =
  "This signature only posts a review on Agorean. It cannot move money or approve spending.";
const owner = privateKeyToAccount(`0x${"5a".repeat(32)}`);

/**
 * Agorean's review link, as it answers: GET returns the eight lines to sign and what the chain
 * shows the wallet paid in the transaction; POST saves.
 *
 * @param wallet - The wallet the link is asked about.
 * @param stars - The stars asked for.
 * @param note - The note asked for.
 * @param paidTo - The wallet the chain shows the transaction paid.
 * @returns The GET reply.
 */
function linkReply(wallet: string, stars: number, note: string, paidTo = PAY_TO) {
  const noteSha = createHash("sha256").update(note).digest("hex");
  return {
    payment: { network: "eip155:84532", paid_to: [paidTo], amounts: ["10000"] },
    wallet,
    issued_at: "2026-09-28T12:00:00.000Z",
    post_to: `${SITE}/r/${TX}`,
    message_to_sign: [
      "Agorean proof of control",
      "purpose: review",
      `wallet: ${wallet}`,
      `subject: ${TX}`,
      "issued_at: 2026-09-28T12:00:00.000Z",
      `stars: ${stars}`,
      `note_sha256: ${noteSha}`,
      SAFETY,
    ].join("\n"),
  };
}

/**
 * A wallet provider whose messages are signed by `signer`, at `address`.
 *
 * @param address - What getAddress returns.
 * @param chainSays - What the chain answers for a contract-wallet signature.
 * @returns The mock provider.
 */
function wallet(address: string, chainSays = false): EvmWalletProvider {
  const provider = Object.create(EvmWalletProvider.prototype);
  provider.getAddress = jest.fn().mockReturnValue(address);
  provider.getName = jest.fn().mockReturnValue("mock_wallet_provider");
  provider.signMessage = jest.fn((message: string) => owner.signMessage({ message }));
  provider.getPublicClient = jest
    .fn()
    .mockReturnValue({ verifyMessage: jest.fn().mockResolvedValue(chainSays) });
  return provider as EvmWalletProvider;
}

describe("AgoreanActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const provider = agoreanActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("supports every network", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
      true,
    );
  });

  describe("searchAgorean", () => {
    it("asks the keyless search and returns the listings with their reviews link", async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          total: 1,
          next_offset: null,
          results: [{ listing_id: "lst_w", title: "Weather now", price_usdc: 0.01 }],
        }),
      });
      const parsed = JSON.parse(await provider.searchAgorean({ query: "weather" }));
      expect(fetchMock).toHaveBeenCalledWith(
        `${SITE}/api/v1/search`,
        expect.objectContaining({ method: "POST" }),
      );
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ query: "weather", limit: 10 });
      expect(parsed.results[0]).toMatchObject({
        listing_id: "lst_w",
        reviews: `${SITE}/reviews/lst_w`,
      });
    });

    it("passes an error through", async () => {
      fetchMock.mockRejectedValueOnce(new Error("offline"));
      const parsed = JSON.parse(await provider.searchAgorean({ query: "weather" }));
      expect(parsed.error.code).toBe("unavailable");
    });
  });

  describe("checkReviews", () => {
    it("asks for the reviews of the URL, about the wallet it asks to be paid", async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          trust_score: 4.5,
          pay_to_matches: true,
          reviews: [{ stars: 5, note: "fast", kind: "signed" }],
        }),
      });
      const parsed = JSON.parse(await provider.checkReviews({ url: RESOURCE, pay_to: PAY_TO }));
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        resource: RESOURCE,
        expect_pay_to: PAY_TO,
        limit: 5,
      });
      expect(parsed).toMatchObject({ trust_score: 4.5, pay_to_matches: true });
      expect(parsed.newest[0]).toMatchObject({ stars: 5, kind: "signed" });
    });
  });

  describe("reviewPayment", () => {
    const args = { url: RESOURCE, tx_hash: TX, stars: 4, note: "Worked.", pay_to: PAY_TO };

    it("signs with the wallet that paid and posts once", async () => {
      const w = owner.address.toLowerCase();
      fetchMock
        .mockResolvedValueOnce({ json: async () => linkReply(w, 4, "Worked.") })
        .mockResolvedValueOnce({ json: async () => ({ saved: true, kind: "signed" }) });
      const parsed = JSON.parse(await provider.reviewPayment(wallet(owner.address), args));
      expect(parsed).toMatchObject({ saved: true, kind: "signed" });
      const [postUrl, post] = fetchMock.mock.calls[1];
      expect(postUrl).toBe(`${SITE}/r/${TX}`);
      expect(JSON.parse(post.body)).toMatchObject({
        stars: 4,
        via: "agentkit",
        resource: RESOURCE,
      });
    });

    it("refuses a tx hash without pay_to before any request", async () => {
      const { pay_to: _payTo, ...hashOnly } = args;
      const parsed = JSON.parse(await provider.reviewPayment(wallet(owner.address), hashOnly));
      expect(parsed).toMatchObject({ saved: false, reason: "pay_to_needed" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("signs nothing when the transaction paid another wallet", async () => {
      const w = owner.address.toLowerCase();
      fetchMock.mockResolvedValueOnce({
        json: async () => linkReply(w, 4, "Worked.", `0x${"99".repeat(20)}`),
      });
      const provider2 = wallet(owner.address);
      const parsed = JSON.parse(await provider.reviewPayment(provider2, args));
      expect(parsed).toMatchObject({ saved: false, reason: "not_sent" });
      expect(provider2.signMessage).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("from an owner-key smart wallet, sends no signature and cites the payment instead", async () => {
      const smart = `0x${"5c".repeat(20)}`;
      fetchMock
        .mockResolvedValueOnce({ json: async () => linkReply(smart, 4, "Worked.") })
        .mockResolvedValueOnce({ json: async () => ({ saved: true, kind: "payment_cited" }) });
      const parsed = JSON.parse(await provider.reviewPayment(wallet(smart, false), args));
      expect(parsed).toMatchObject({ saved: true, kind: "payment_cited", signed: false });
      const [url, post] = fetchMock.mock.calls[1];
      expect(url).toBe(`${SITE}/api/v1/reviewPayment`);
      expect(JSON.parse(post.body)).toEqual({
        tx_hash: TX,
        stars: 4,
        note: "Worked.",
        resource: RESOURCE,
        via: "agentkit",
      });
    });

    it("from a smart wallet whose own signature the chain accepts, sends the signature", async () => {
      const smart = `0x${"5c".repeat(20)}`;
      fetchMock
        .mockResolvedValueOnce({ json: async () => linkReply(smart, 4, "Worked.") })
        .mockResolvedValueOnce({ json: async () => ({ saved: true, kind: "signed" }) });
      const parsed = JSON.parse(await provider.reviewPayment(wallet(smart, true), args));
      expect(parsed).toMatchObject({ saved: true, kind: "signed" });
      expect(fetchMock.mock.calls[1][0]).toBe(`${SITE}/r/${TX}`);
    });
  });
});
