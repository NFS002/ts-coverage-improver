import { JobRepository } from '../../domain/repositories/job.repository';
import { RepoPreparer } from '../ports/repo-preparer';
import { AiRunner } from '../ports/ai-runner';
import { PullRequestService } from '../ports/pr-service';
import { RepositoryRepository } from '../../domain/repositories/repository.repository';

export class ProcessJobUseCase {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly repositoryRepository: RepositoryRepository,
    private readonly repoPreparer: RepoPreparer,
    private readonly aiRunner: AiRunner,
    private readonly prService: PullRequestService,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) return;

    const repository = await this.repositoryRepository.findById(job.repoId);
    if (!repository) {
      await this.jobRepository.appendLog(job.id, 'Repository not found for job');
      await this.jobRepository.updateStatus(job.id, 'failed');
      return;
    }

    await this.jobRepository.updateStatus(job.id, 'running');
    await this.jobRepository.appendLog(job.id, 'Preparing repository workspace');

    try {
      const repoPath = await this.repoPreparer.prepare(repository.sshUrl);
      await this.jobRepository.appendLog(job.id, `Workspace ready at ${repoPath}`);

      const aiResult = await this.aiRunner.run(repoPath, job.filePath);
      await this.jobRepository.appendLog(job.id, aiResult.output.trim() || 'AI CLI finished');

      let prUrl: string | null = null;
      if (aiResult.success) {
        const branchName = `coverage-improvement/${job.id}`;
        const pr = await this.prService.openPullRequest(
          repository.sshUrl,
          branchName,
          `Improve tests for ${job.filePath}`,
          'Automated test generation job output',
        );
        prUrl = pr.url;
        await this.jobRepository.appendLog(job.id, `PR opened at ${pr.url}`);
        await this.jobRepository.updateStatus(job.id, 'completed', prUrl);
      } else {
        await this.jobRepository.appendLog(job.id, 'AI CLI reported failure');
        await this.jobRepository.updateStatus(job.id, 'failed');
      }
    } catch (err: any) {
      await this.jobRepository.appendLog(job.id, `Error: ${err?.message ?? err}`);
      await this.jobRepository.updateStatus(job.id, 'failed');
    }
  }
}
