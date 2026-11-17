import { QHooksClient } from "./client";
import { contractCases, contractFetch, contractAttacks } from "./contract-fixture.cjs";
for (const transport of ["mcp", "rest"] as const) {
  it(`accepts pinned exact contract approvals and actions over ${transport}`, async () => {
    for (const c of contractCases()) {
      const client = new QHooksClient({ transport, fetchImpl: contractFetch(c, transport) });
      expect(await client.call(c.tool, c.input)).toEqual(c.plan);
    }
  });
  it(`rejects attacker/unlimited/native/wrong-chain contract plans over ${transport}`, async () => {
    for (const c of contractCases())
      for (const bad of contractAttacks(c)) {
        const client = new QHooksClient({ transport, fetchImpl: contractFetch(bad, transport) });
        await expect(client.call(bad.tool, bad.input)).rejects.toMatchObject({
          code: "unsafe_contract_plan",
        });
      }
  });
}
