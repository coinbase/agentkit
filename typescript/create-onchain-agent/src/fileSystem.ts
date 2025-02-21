import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { optimizedCopy, toValidPackageName } from "./utils.js";

const sourceDir = path.resolve(fileURLToPath(import.meta.url), "../../../templates/next");

const renameFiles: Record<string, string | undefined> = {
  _gitignore: ".gitignore",
  "_env.local": ".env.local",
};

const excludeDirs = ["node_modules", ".next"];
const excludeFiles = [".DS_Store", "Thumbs.db"];

function getSourceDir() {
  return sourceDir;
}

async function copyDir(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, renameFiles[entry.name] || entry.name);

    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        await copyDir(srcPath, destPath);
      }
    } else {
      if (!excludeFiles.includes(entry.name)) {
        await optimizedCopy(srcPath, destPath);
      }
    }
  }
}

export async function copyTemplate(projectName: string, packageName: string) {
  const root = path.join(process.cwd(), projectName);
  await copyDir(getSourceDir(), root);
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"));
  pkg.name = packageName || toValidPackageName(projectName);
  await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2));

  return root;
}
