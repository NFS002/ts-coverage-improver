export interface AiRunnerResult {
  success: boolean;
  output: string;
}

export interface AiRunner {
  run(repoPath: string, filePath: string): Promise<AiRunnerResult>;
}
