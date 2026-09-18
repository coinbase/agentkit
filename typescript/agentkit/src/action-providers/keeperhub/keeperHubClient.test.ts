import { deriveIdempotencyKey } from "./keeperHubClient";

const base = {
  taskId: "invoice-2026-0042",
  chainId: 84532,
  recipientAddress: "0x33b1499a92793B3e634f2D8B9e83A7185f4eC44D",
  amount: "1.5",
  tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

describe("deriveIdempotencyKey", () => {
  it("yields the same key for the same work", () => {
    // This is the property that prevents paying twice: a second attempt at the
    // same work must produce exactly the same key.
    expect(deriveIdempotencyKey(base)).toBe(deriveIdempotencyKey({ ...base }));
  });

  it("yields different keys for different taskIds", () => {
    // Two payments that really are different must never merge.
    expect(deriveIdempotencyKey(base)).not.toBe(
      deriveIdempotencyKey({ ...base, taskId: "invoice-2026-0043" }),
    );
  });

  it.each([
    ["amount", { amount: "1.6" }],
    ["recipientAddress", { recipientAddress: "0x0000000000000000000000000000000000000001" }],
    ["chainId", { chainId: 8453 }],
    ["tokenAddress", { tokenAddress: "0x0000000000000000000000000000000000000002" }],
  ])("changes when %s changes", (_field, patch) => {
    // Fields that determine the onchain effect are part of the key, so a taskId
    // reused with different details is caught as a conflict instead of being
    // silently replayed.
    expect(deriveIdempotencyKey(base)).not.toBe(deriveIdempotencyKey({ ...base, ...patch }));
  });

  it("is a valid UUID v4", () => {
    // Some layers below reject keys that are not UUID v4.
    expect(deriveIdempotencyKey(base)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("treats a missing tokenAddress as its own value", () => {
    // A native transfer and an ERC-20 transfer of the same amount are different
    // work.
    const { tokenAddress: _tokenAddress, ...native } = base;
    expect(deriveIdempotencyKey(native)).not.toBe(deriveIdempotencyKey(base));
  });

  it("is stable across processes (a fixed value, not random)", () => {
    // The key must be rebuildable after the process dies and restarts. This
    // fixed value pins the algorithm; if it changes, old retries will no longer
    // match old executions.
    expect(deriveIdempotencyKey(base)).toBe("4b92288e-4690-4ad4-970e-8a8787520266");
  });
});
