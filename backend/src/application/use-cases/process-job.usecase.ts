import { JobRepository } from '../../domain/repositories/job.repository';
import { RepoPreparer } from '../ports/repo-preparer';
import { AiRunner } from '../ports/ai-runner';
import { PullRequestService } from '../ports/pr-service';
import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { destructureGithubSshUrl } from '@utils';

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
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    const repository = await this.repositoryRepository.findById(jobId);
    if (!repository) {
      job.markFailed('Repository not found for job')
      await this.jobRepository.save(job)
      throw new Error(`Repository not found for job ${jobId}`)
    }

    job.markRunning('Preparing repository workspace')

    try {
      const { owner, repo, forkMode, forkOrg, forkOwner } = repository
      // const repoPath = await this.repoPreparer.prepare({ owner, repo });
      // await this.jobRepository.appendLog(job.id, `Workspace ready at ${repoPath}`);

      // const aiResult = await this.aiRunner.run(repoPath, job.filePath);
      // await this.jobRepository.appendLog(job.id, aiResult.output.trim() || 'AI CLI finished');

      // let prUrl: string | null = null;
      // if (aiResult.success) {
      //   const branchName = `coverage-improvement/${job.id}`;
      //   const pr = await this.prService.openPullRequest(
      //     repository.sshUrl,
      //     branchName,
      //     `Improve tests for ${job.filePath}`,
      //     'Automated test generation job output',
      //   );
      //   prUrl = pr.url;
      //   await this.jobRepository.appendLog(job.id, `PR opened at ${pr.url}`);
      //   await this.jobRepository.updateStatus(job.id, 'completed', prUrl);
      // } else {
      //   await this.jobRepository.appendLog(job.id, 'AI CLI reported failure');
      //   await this.jobRepository.updateStatus(job.id, 'failed');
      // }
    } catch (err: any) {
      job.markFailed(`Error: ${err?.message ?? err}`)
      this.jobRepository.save(job)
    }
  }
}
