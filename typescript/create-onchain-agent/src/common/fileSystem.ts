import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { optimizedCopy } from "./utils.js";
import { Template } from "./types.js";

const sourceDir = path.resolve(fileURLToPath(import.meta.url), "../../../../templates");

const renameFiles: Record<string, string | undefined> = {
  _gitignore: ".gitignore",
  "_env.local": ".env.local",
};

const excludeDirs = ["node_modules", ".next"];
const excludeFiles = [".DS_Store", "Thumbs.db"];

/**
 * Retrieves the source directory for copying template files.
 *
 * @param template - The template to use.
 * @returns {string} The source directory path.
 */
function getSourceDir(template: Template): string {
  return path.join(sourceDir, template);
}

/**
 * Recursively copies a directory and its contents from the source to the destination.
 *
 * - Creates the destination directory if it does not exist.
 * - Copies files, renaming them if specified in `renameFiles`.
 * - Skips directories listed in `excludeDirs`.
 * - Skips files listed in `excludeFiles`.
 *
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 * @returns {Promise<void>} A promise that resolves when the copy operation is complete.
 */
async function copyDir(src: string, dest: string): Promise<void> {
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

/**
 * Copies a project template to a new directory and optionally updates the package name.
 *
 * - Copies the template from the source directory.
 * - If packageName is provided, updates the `package.json` file with the provided package name.
 *
 * @param {string} projectName - The name of the new project directory.
 * @param {Template} template - The template to use.
 * @param {string} [packageName] - Optional npm package name to use.
 * @returns {Promise<string>} The path of the newly created project directory.
 */
export async function copyTemplate(
  projectName: string,
  template: Template,
  packageName?: string,
): Promise<string> {
  const root = path.join(process.cwd(), projectName);
  await copyDir(getSourceDir(template), root);

  // Only update package.json if packageName is provided
  if (packageName) {
    const pkgPath = path.join(root, "package.json");
    try {
      const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"));
      pkg.name = packageName;
      await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
    } catch (error) {
      // Ignore errors if package.json doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return root;
}
