import { execSync } from "child_process";
import fs from "fs"
import { includes } from "zod";

export function safeStatSync(path: string) {
  try {
    return fs.statSync(path);
  } catch {
    return null;
  }
}

export const execToString = (cmd: string, cwd?: string) => execSync(cmd, { encoding: "utf8", cwd }).trim();

export const COVERAGE_FILE_SUMMARY_NAME = 'ts-coverage-improver.summary.json';


export const COVERAGE_FILE_FORMAT_EXAMPLE = {
    "path/to/file1.ts": {
      include: true,
      filePath: "path/to/file1.ts",
      coveragePct: 85.5
    },
    "path/to/file2.ts": {
      include: true,
      filePath: "path/to/file2.ts",
      coveragePct: 90.0
    }
};