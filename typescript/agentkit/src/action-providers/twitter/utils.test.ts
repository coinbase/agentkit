import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { resolveSafeLocalMediaPath } from "./utils";

describe("resolveSafeLocalMediaPath", () => {
  it("allows files under cwd and rejects escapes", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "twitter-media-"));
    const prev = process.cwd();
    try {
      process.chdir(tmp);
      const inside = path.join(tmp, "image.jpg");
      fs.writeFileSync(inside, "x");
      expect(resolveSafeLocalMediaPath("image.jpg")).toBe(fs.realpathSync(inside));
      expect(() => resolveSafeLocalMediaPath("../outside.jpg")).toThrow(/working directory/i);
      expect(() => resolveSafeLocalMediaPath("/etc/passwd")).toThrow(/working directory/i);
    } finally {
      process.chdir(prev);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
