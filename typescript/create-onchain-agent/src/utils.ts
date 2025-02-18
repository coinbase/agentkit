import fs from 'fs/promises';
import path from 'path';

async function copyFile(src: string, dest: string) {
  await fs.copyFile(src, dest);
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    })
  );
}

export async function optimizedCopy(src: string, dest: string) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await copyDir(src, dest);
  } else {
    await copyFile(src, dest);
  }
}

export function createClickableLink(text: string, url: string): string {
  // OSC 8 ;; URL \a TEXT \a
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}

export function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName
  );
}

export function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z\d\-~]+/g, '-');
}

export function detectPackageManager(): string {
  if (process.env.npm_config_user_agent) {
    if (process.env.npm_config_user_agent.startsWith('yarn')) {
      return 'yarn';
    }
    if (process.env.npm_config_user_agent.startsWith('pnpm')) {
      return 'pnpm';
    }
    if (process.env.npm_config_user_agent.startsWith('npm')) {
      return 'npm';
    }
    if (process.env.npm_config_user_agent.startsWith('bun')) {
      return 'bun';
    }
  }
  return 'npm'; // default to npm if unable to detect
}
