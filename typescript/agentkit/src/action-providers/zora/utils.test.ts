import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { generateZoraTokenUri, resolveSafeLocalImagePath } from "./utils";

describe("zora image path / URI guards", () => {
  describe("resolveSafeLocalImagePath", () => {
    it("allows files under cwd and rejects escapes", () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zora-img-"));
      const prev = process.cwd();
      try {
        process.chdir(tmp);
        const inside = path.join(tmp, "token.png");
        fs.writeFileSync(inside, "x");
        expect(resolveSafeLocalImagePath("token.png")).toBe(fs.realpathSync(inside));
        expect(() => resolveSafeLocalImagePath("../outside.png")).toThrow(/working directory/i);
        expect(() => resolveSafeLocalImagePath("/etc/passwd")).toThrow(/working directory/i);
      } finally {
        process.chdir(prev);
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe("generateZoraTokenUri", () => {
    const pinataConfig = { jwt: "test-jwt" };

    it("rejects non-https remote schemes before reading as a local file", async () => {
      await expect(
        generateZoraTokenUri({
          name: "t",
          symbol: "T",
          description: "d",
          image: "http://127.0.0.1/secret.png",
          pinataConfig,
        }),
      ).rejects.toThrow(/https:\/\/ or ipfs:\/\//i);
    });
  });
});
