import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  assertSafeRemoteImageUrl,
  isBlockedImageHost,
  resolveSafeLocalImagePath,
} from "./metadata_utils";

describe("flaunch image URL / path guards", () => {
  describe("isBlockedImageHost", () => {
    it("blocks loopback, private, link-local, and CGNAT literals", () => {
      expect(isBlockedImageHost("localhost")).toBe(true);
      expect(isBlockedImageHost("127.0.0.1")).toBe(true);
      expect(isBlockedImageHost("10.0.0.5")).toBe(true);
      expect(isBlockedImageHost("192.168.1.10")).toBe(true);
      expect(isBlockedImageHost("169.254.169.254")).toBe(true);
      expect(isBlockedImageHost("100.64.0.1")).toBe(true);
      expect(isBlockedImageHost("img.localhost")).toBe(true);
    });

    it("allows public hostnames and public IPs", () => {
      expect(isBlockedImageHost("cdn.example.com")).toBe(false);
      expect(isBlockedImageHost("8.8.8.8")).toBe(false);
    });
  });

  describe("assertSafeRemoteImageUrl", () => {
    it("accepts https public hosts", () => {
      const u = assertSafeRemoteImageUrl("https://cdn.example.com/token.png");
      expect(u.hostname).toBe("cdn.example.com");
    });

    it("rejects http, credentials, and blocked hosts", () => {
      expect(() => assertSafeRemoteImageUrl("http://cdn.example.com/a.png")).toThrow(/https/i);
      expect(() =>
        assertSafeRemoteImageUrl("https://user:pass@cdn.example.com/a.png"),
      ).toThrow(/credentials/i);
      expect(() => assertSafeRemoteImageUrl("https://127.0.0.1/a.png")).toThrow(/not allowed/i);
      expect(() => assertSafeRemoteImageUrl("https://169.254.169.254/latest")).toThrow(
        /not allowed/i,
      );
    });
  });

  describe("resolveSafeLocalImagePath", () => {
    it("allows files under cwd and rejects escapes", () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flaunch-img-"));
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
});
