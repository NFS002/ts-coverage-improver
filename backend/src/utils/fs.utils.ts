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


// Relative to the repository root of cloned repositories (.ie in the .workspace directory)
export const CUSTOM_AGENT_INSTRUCTIONS_FILE_PATH = '../../AGENTS.ts-coverage-improver.md';


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

export const mdTemplate = (template: string, variables: Record<string, string>) => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`;;${key};;`, 'g'), value);
  }
  return result;
}
  