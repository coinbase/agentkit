import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { standingWitnessActionProvider } from "./standingWitnessActionProvider";
import { canonical, verifyRecord } from "./verification";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const key = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const request = {
  subject: "target",
  claim: "action",
  provenance: {
    source: "test",
    authority: "test",
    evidence: [{ action: "action", target: "target", valueUsd: 1, timestamp: "exact" }],
  },
};
/**
 * Inspect ordinary records without granting execution.
 *
 * @param input - Input for this check.
 * @param changes - Input for this check.
 * @returns The checked result.
 */
function envelope(input: unknown = request, changes: Record<string, unknown> = {}) {
  const record = {
    type: "WHP-FRONTDOOR-EVALUATION-v1",
    not_sealed_mark: true,
    input,
    input_hash: createHash("sha256").update(canonical(input)).digest("hex"),
    issued_at: now,
    valid_until: now + 300,
    determination: { outcome: "ESTABLISHED" },
    ...changes,
  };
  const bytes = Buffer.from(canonical(record));
  return {
    record,
    record_hash: createHash("sha256").update(bytes).digest("hex"),
    signature: {
      alg: "Ed25519",
      public_key_b64url: key,
      value_b64url: sign(null, bytes, privateKey).toString("base64url"),
    },
  };
}
/**
 * Inspect ordinary records without granting execution.
 *
 * @param data - Input for this check.
 * @param status - Input for this check.
 * @returns The checked result.
 */
function reply(data: unknown, status = 200) {
  return { status, json: async () => data } as Response;
}
const discovery = reply({ signer: { alg: "Ed25519", public_key_b64url: key } });

describe("ordinary signed-record verification", () => {
  it("verifies authentic hash/signature/input and time without granting authority", () => {
    expect(verifyRecord(envelope(), request, key, now)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("rejects missing signature", () => {
    const e = { ...envelope(), signature: undefined };
    expect(() => verifyRecord(e, request, key, now)).toThrow();
  });
  it("rejects bad signature", () => {
    const e = envelope();
    e.signature.value_b64url = Buffer.alloc(64).toString("base64url");
    expect(() => verifyRecord(e, request, key, now)).toThrow("signature");
  });
  it("rejects a different signing key", () => {
    expect(() =>
      verifyRecord(envelope(), request, Buffer.alloc(32).toString("base64url"), now),
    ).toThrow("key");
  });
  it("rejects tampering/hash mismatch", () => {
    const e = envelope();
    e.record_hash = "0".repeat(64);
    expect(() => verifyRecord(e, request, key, now)).toThrow("hash");
  });
  it.each([
    { issued_at: now - 121 },
    { valid_until: now },
    { issued_at: now + 1 },
    { valid_until: now - 1 },
  ])("rejects stale/expired/future window %j", changes => {
    expect(() => verifyRecord(envelope(request, changes), request, key, now)).toThrow("window");
  });
  it.each(["REVOKED", "INSUFFICIENTLY ESTABLISHED", "CLEARED"])(
    "rejects non-positive %s",
    outcome => {
      expect(() =>
        verifyRecord(envelope(request, { determination: { outcome } }), request, key, now),
      ).toThrow("determination");
    },
  );
  it("rejects signed revoked flag", () => {
    expect(() => verifyRecord(envelope(request, { revoked: true }), request, key, now)).toThrow(
      "Revoked",
    );
  });
  it("rejects signed test record", () => {
    expect(() =>
      verifyRecord(envelope(request, { environment: "TEST" }), request, key, now),
    ).toThrow("test");
  });
  it.each(["action", "target", "valueUsd", "timestamp"])(
    "rejects exact %s binding mismatch",
    field => {
      const changed = JSON.parse(JSON.stringify(request));
      changed.provenance.evidence[0][field] = "different";
      expect(() => verifyRecord(envelope(changed), request, key, now)).toThrow("binding");
    },
  );
  it("rejects input hash mismatch", () => {
    expect(() =>
      verifyRecord(envelope(request, { input_hash: "wrong" }), request, key, now),
    ).toThrow("Input hash");
  });
  it("rejects unsafe/noninteger numbers", () => {
    expect(() => canonical({ amount: 1.25 })).toThrow();
  });
});

describe("StandingWitnessActionProvider", () => {
  const provider = standingWitnessActionProvider();
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("supports network", () => {
    expect(provider.supportsNetwork({} as Parameters<typeof provider.supportsNetwork>[0])).toBe(
      true,
    );
  });
  it("uses provider name", () => {
    expect(provider.name).toBe("standing_witness");
  });
  it.each([201, 402, 500])("blocks HTTP %s", async status => {
    jest.spyOn(global, "fetch").mockResolvedValue(reply({}, status));
    expect(
      JSON.parse(await provider.circuitBreakerGate({ proposedAction: "action" })).gate_status,
    ).toBe("BLOCKED");
  });
  it("blocks network error", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    expect(
      JSON.parse(await provider.circuitBreakerGate({ proposedAction: "action" })).gate_status,
    ).toBe("BLOCKED");
  });
  it.each([
    { outcome: "ESTABLISHED" },
    { outcome: "CLEARED" },
    { outcome: "INSUFFICIENTLY ESTABLISHED" },
    { error: "failed" },
    { mock: true },
    { type: "WHP-MOCK-DRY-RUN-v1" },
  ])("blocks unsigned or unexpected response %j", async data => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(reply(data)).mockResolvedValue(discovery);
    expect(
      JSON.parse(await provider.circuitBreakerGate({ proposedAction: "action" })).gate_status,
    ).toBe("BLOCKED");
  });
  it.each([
    { mock: true },
    { mock: true, structurally_complete: false, failed: [] },
    { mock: true, structurally_complete: true, failed: "bad" },
    { mock: true, structurally_complete: true },
    { mock: true, structurally_complete: true, failed: ["missing"] },
    { outcome: "ESTABLISHED" },
  ])("rejects malformed mock or positive to mock request %j", async data => {
    jest.spyOn(global, "fetch").mockResolvedValue(reply(data));
    expect(
      JSON.parse(await provider.circuitBreakerGate({ proposedAction: "action", mock: true }))
        .gate_status,
    ).toBe("BLOCKED");
  });
  it("labels explicit complete mock non-authorizing", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(reply({ mock: true, structurally_complete: true, failed: [] }));
    const result = JSON.parse(
      await provider.circuitBreakerGate({ proposedAction: "action", mock: true }),
    );
    expect(result.gate_status).toBe("DRY_RUN_PASSED");
    expect(result.execution_authorized).toBe(false);
  });
  it("blocks even an authentic fresh request-bound positive without current standing", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async (_url, init) =>
        init?.method === "POST" ? reply(envelope(JSON.parse(init.body as string))) : discovery,
      );
    const result = JSON.parse(
      await provider.circuitBreakerGate({
        proposedAction: "action",
        targetAddress: "target",
        valueUsd: 1,
      }),
    );
    expect(result.gate_status).toBe("BLOCKED");
    expect(result.record_integrity_verified).toBe(true);
    expect(result.current_standing_verified).toBe(false);
    expect(result.execution_authorized).toBe(false);
  });
  it("sends evidence as an array and binds action/target/value/timestamp", async () => {
    const mocked = jest.spyOn(global, "fetch").mockResolvedValue(reply({}, 402));
    await provider.circuitBreakerGate({
      proposedAction: "action",
      targetAddress: "target",
      valueUsd: 1,
    });
    const input = JSON.parse(mocked.mock.calls[0][1]!.body as string);
    expect(input.provenance.evidence).toEqual([
      { action: "action", target: "target", valueUsd: 1, timestamp: expect.any(String) },
    ]);
  });
  it("fails closed on signing-key discovery failure", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(reply(envelope()))
      .mockResolvedValueOnce(reply({}, 500));
    expect(
      JSON.parse(await provider.circuitBreakerGate({ proposedAction: "action" })).gate_status,
    ).toBe("BLOCKED");
  });
  it("audit reports only record integrity not authority", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async (_url, init) =>
        init?.method === "POST" ? reply(envelope(JSON.parse(init.body as string))) : discovery,
      );
    const result = JSON.parse(await provider.standingAudit({ subject: "subject", claim: "claim" }));
    expect(result.status).toBe("record_verified");
    expect(result.execution_authorized).toBe(false);
  });
});
