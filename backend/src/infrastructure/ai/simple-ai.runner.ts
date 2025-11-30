import { exec } from 'child_process';
import * as util from 'util';
import * as path from 'path';
import { AiRunner, AiRunnerResult } from '../../application/ports/ai-runner';

const execAsync = util.promisify(exec);

export class SimpleAiRunner implements AiRunner {
  constructor(private readonly commandTemplate: string) {}

  async run(repoPath: string, filePath: string): Promise<AiRunnerResult> {
    const absoluteTarget = path.join(repoPath, filePath);
    const cmd = this.commandTemplate
      .replace('{repo}', repoPath)
      .replace('{file}', absoluteTarget);
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: repoPath });
      const output = [stdout, stderr].filter(Boolean).join('\n');
      return { success: true, output };
    } catch (err: any) {
      return {
        success: false,
        output: err?.stderr || err?.message || 'AI CLI failed',
      };
    }
  }
}
