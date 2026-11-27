import { isValidSolanaPublicKey, rentshieldActionProvider } from "./rentshieldActionProvider";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SAMPLE_WALLET = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV";
const FAKE_SECRET_KEY =
  "5MaiiCavjCmn9Hs1o3eznqDEhRwxo7pXiAYez7keQUviUkauRiTMD8DrESdrNjN8zd9mTmVhRvBJeg5vhyvgrAhG";

describe("RentShieldActionProvider", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("validates 32-byte base58 Solana public keys and rejects secret keys or mnemonics", () => {
    expect(isValidSolanaPublicKey(USDC_MINT)).toBe(true);
    expect(isValidSolanaPublicKey(SAMPLE_WALLET)).toBe(true);
    expect(isValidSolanaPublicKey(FAKE_SECRET_KEY)).toBe(false);
    expect(isValidSolanaPublicKey("word1 word2 word3 word4")).toBe(false);
  });

  it("rejects private keys locally without making network requests", async () => {
    const provider = rentshieldActionProvider();
    const tokenRes = JSON.parse(await provider.checkTokenRugShield({ mint: FAKE_SECRET_KEY }));
    const walletRes = JSON.parse(
      await provider.scanWalletUnclaimedRent({ wallet: FAKE_SECRET_KEY }),
    );
    expect(tokenRes.ok).toBe(false);
    expect(walletRes.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves live_endpoint.json on 404 and returns 11-layer token audit", async () => {
    const provider = rentshieldActionProvider();
    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        text: async () => "Not Found",
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ ok: true, api_base: "https://edge.rentandrugshield.example" }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            mint: USDC_MINT,
            symbol: "USDC",
            name: "USD Coin",
            token_program: "SPL Token",
            score: 100,
            safe_to_buy: true,
            verdict: "SAFE",
            layers_checked: 11,
            layers_passed: 11,
            checklist_summary: "11/11",
            checks: [{ layer: 1, key: "mint_auth", passed: true }],
          }),
      });

    const parsed = JSON.parse(await provider.checkTokenRugShield({ mint: USDC_MINT }));
    expect(parsed.ok).toBe(true);
    expect(parsed.score).toBe(100);
    expect(parsed.safeToBuy).toBe(true);
    expect(parsed.layersChecked).toBe(11);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("scans public wallet for 0%-first-claim reclaimable ATA rent", async () => {
    const provider = rentshieldActionProvider({ apiUrl: "https://edge.rentandrugshield.example" });
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          wallet: SAMPLE_WALLET,
          is_first_free_claim: true,
          effective_fee_bps: 0,
          reclaimable_count: 3,
          empty_count: 3,
          total_reclaimable_sol: 0.006117,
          total_reclaimable_lamports: 6117840,
        }),
    });

    const parsed = JSON.parse(await provider.scanWalletUnclaimedRent({ wallet: SAMPLE_WALLET }));
    expect(parsed.ok).toBe(true);
    expect(parsed.isFirstFreeClaim).toBe(true);
    expect(parsed.effectiveFeeBps).toBe(0);
    expect(parsed.emptyCount).toBe(3);
    expect(parsed.supportsSvm ?? provider.supportsNetwork({ protocolFamily: "svm" })).toBe(true);
  });
});
