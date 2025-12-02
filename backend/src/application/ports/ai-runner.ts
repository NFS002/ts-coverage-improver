export interface AiRunnerResult {
  success: boolean;
  output: string;
}

export interface AiRunner {
  run(params: {
    repoPath: string,
    filePath: string,
    owner: string,
    repo: string
  }): Promise<AiRunnerResult>;
}
