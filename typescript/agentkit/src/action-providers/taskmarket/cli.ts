import { spawn } from "child_process";

export interface CliResult {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export interface TaskmarketCli {
  run(args: string[]): Promise<CliResult>;
}

export interface SpawnCliOptions {
  command?: string;
  timeoutMs?: number;
}

/**
 * Runs the first-party Taskmarket CLI. Callers must not retry when timedOut is true
 * or when exitCode is null — settlement status is unknown.
 */
export class SpawnTaskmarketCli implements TaskmarketCli {
  private readonly command: string;
  private readonly timeoutMs: number;

  constructor(options: SpawnCliOptions = {}) {
    this.command = options.command ?? process.env.TASKMARKET_CLI_PATH ?? "taskmarket";
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  run(args: string[]): Promise<CliResult> {
    return new Promise(resolve => {
      const child = spawn(this.command, args, {
        shell: false,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => {
        child.kill();
        finish({
          exitCode: null,
          timedOut: true,
          stdout,
          stderr: stderr + "\nCLI timed out; settlement status unknown. Do not retry.",
        });
      }, this.timeoutMs);

      const finish = (result: CliResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      child.stdout.on("data", chunk => {
        stdout += String(chunk);
      });
      child.stderr.on("data", chunk => {
        stderr += String(chunk);
      });
      child.on("error", error => {
        finish({
          exitCode: null,
          timedOut: false,
          stdout,
          stderr: error.message,
        });
      });
      child.on("close", code => {
        finish({
          exitCode: code,
          timedOut: false,
          stdout,
          stderr,
        });
      });
    });
  }
}
