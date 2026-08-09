import fs from "fs";
import path from "path";

/**
 * Resolve a local media path and require it to stay under process.cwd()
 * (realpath), so agent-supplied paths cannot read arbitrary files for
 * Twitter media upload. Twin of zora/flaunch resolveSafeLocalImagePath.
 */
export function resolveSafeLocalMediaPath(filePath: string): string {
  const root = fs.realpathSync(process.cwd());
  const resolved = path.resolve(root, filePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Local media path must be within the working directory");
  }
  const real = fs.realpathSync(resolved);
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error("Local media path escapes the working directory");
  }
  return real;
}
