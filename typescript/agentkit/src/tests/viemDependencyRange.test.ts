import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));

describe("viem dependency", () => {
  it("uses a caret range and is not a peer dependency", () => {
    expect(pkg.dependencies.viem).toMatch(/^\^2\.\d+\.\d+$/);
    expect(pkg.peerDependencies?.viem).toBeUndefined();
  });
});
