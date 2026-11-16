import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QHooksClient, type QHooksOptions } from "./client";
const root = __dirname;
const call = (
  name: Parameters<QHooksClient["call"]>[0],
  args: unknown,
  options: QHooksOptions = {},
) => new QHooksClient(options).call(name, args);
const check = (value: unknown, expected: unknown) => expect(value).toEqual(expected);
const run = (
  file: string = join(root, "definitions.ts"),
  catalog: string = join(root, "fixtures/tools-list.json"),
) =>
  execFileSync(
    process.execPath,
    [
      join(root, "scripts/qhooks-pin.mjs"),
      "--check",
      file,
      "--catalog",
      catalog,
      "--names",
      join(root, "fixtures/reviewed-tool-names.json"),
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
it("pins all31schemas and rejects schema/name drift without network", () => {
  check(run().includes("31 tools"), true);
  const dir = mkdtempSync(join(tmpdir(), "qhooks-drift-"));
  try {
    const source = readFileSync(join(root, "definitions.ts"), "utf8"),
      file = join(dir, "definitions.ts");
    writeFileSync(
      file,
      source
        .replace('"configuration": {', '"removed_configuration": {')
        .replace("configuration: {", "removed_configuration: {"),
    );
    let refused = false;
    try {
      run(file);
    } catch {
      refused = true;
    }
    check(refused, true);
    const catalog = JSON.parse(readFileSync(join(root, "fixtures/tools-list.json"), "utf8"));
    catalog.tools.push({ ...catalog.tools[0], name: "unreviewed_send" });
    const input = join(dir, "catalog.json");
    writeFileSync(input, JSON.stringify(catalog));
    refused = false;
    try {
      run(undefined, input);
    } catch {
      refused = true;
    }
    check(refused, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("uses all six newly pinned routes with explicit feedback opt-in on both transports", async () => {
  const cases = [
    ["compete_join", { wallet: "0x" + "1".repeat(40), client: "fixture" }, "compete-join", "POST"],
    [
      "compete_standings",
      { board: "pnl", period: "week", agents: true },
      "compete-standings",
      "GET",
    ],
    [
      "prepare_board_post",
      {
        wallet: "0x" + "1".repeat(40),
        client: "fixture",
        chain: "4663",
        address: "0x" + "2".repeat(40),
        text: "Local fixture",
      },
      "prepare-board-post",
      "POST",
    ],
    [
      "prepare_agent_profile",
      {
        wallet: "0x" + "1".repeat(40),
        name: "Fixture",
        operator: "Fixture",
        tools: ["quote"],
        revision: 0,
      },
      "prepare-agent-profile",
      "POST",
    ],
    ["agent_profile", { wallet: "0x" + "1".repeat(40) }, "agent-profile", "GET"],
    [
      "send_feedback",
      { text: "Local controlled fixture", kind: "docs", client: "fixture" },
      "feedback",
      "POST",
    ],
  ] as const;
  for (const transport of ["mcp", "rest"] as const)
    for (const [name, input, route, method] of cases) {
      let calls = 0;
      const out = { ok: true, partial: true };
      const data = await call(name, input, {
        transport,
        allowFeedback: true,
        fetchImpl: async (url, init) => {
          calls++;
          const body = init?.body ? JSON.parse(String(init.body)) : undefined;
          if (transport === "mcp") {
            check(body.params.name, name);
            check(body.params.arguments, input);
            return Response.json({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                structuredContent: out,
                content: [{ type: "text", text: JSON.stringify(out) }],
              },
            });
          }
          check(new URL(String(url)).pathname, "/api/v1/agent/" + route);
          check(init?.method, method);
          if (method === "POST") check(body, input);
          return Response.json(out);
        },
      });
      check(data, out);
      check(calls, 1);
    }
});
it("feedback defaults off and argument text cannot enable it", async () => {
  let calls = 0;
  for (const input of [{ text: "Local fixture" }, { text: "Local fixture", allowFeedback: true }]) {
    let code = "";
    try {
      await call("send_feedback", input, {
        fetchImpl: async () => {
          calls++;
          throw Error("No real feedback");
        },
      });
    } catch (e) {
      code = e instanceof Error && "code" in e ? String(e.code) : "";
    }
    check(code, "feedback_disabled");
  }
  check(calls, 0);
});
it("validates token quote, launch configuration and unique profile tools before transport", async () => {
  let calls = 0;
  const out = { partial: true };
  const options = {
    fetchImpl: async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: { structuredContent: out, content: [{ type: "text", text: JSON.stringify(out) }] },
      });
    },
  };
  for (const input of [
    { chain: "4663", token: "0x" + "1".repeat(40), side: "buy", amountIn: "1" },
    { chain: "4663", pool: "0x" + "2".repeat(64), zeroForOne: true, amountIn: "1" },
  ])
    check(await call("quote", input, options), out);
  check(
    await call(
      "prepare_launch",
      { name: "N".repeat(64), ticker: "FX", configuration: '{"name":"public configuration"}' },
      options,
    ),
    out,
  );
  check(calls, 3);
  for (const [name, input] of [
    ["quote", { chain: "4663", amountIn: "1" }],
    ["prepare_launch", { name: "N".repeat(33), ticker: "FX" }],
    ["prepare_launch", { name: "Fixture", ticker: "FX", configuration: { name: "wrong shape" } }],
    [
      "prepare_agent_profile",
      {
        wallet: "0x" + "1".repeat(40),
        name: "Fixture",
        operator: "Fixture",
        tools: ["quote", "quote"],
        revision: 0,
      },
    ],
  ] as const) {
    let code = "";
    try {
      await call(name, input, options);
    } catch (e) {
      code = e instanceof Error && "code" in e ? String(e.code) : "";
    }
    check(code, "invalid_arguments");
  }
  check(calls, 3);
});
