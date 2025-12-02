import { JobRepository } from '../../domain/repositories/job.repository';
import { RepoPreparer } from '../ports/repo-preparer';
import { AiRunner, AiRunnerResult } from '../ports/ai-runner';
import { PullRequestService } from '../ports/pr-service';
import { RepositoryRepository } from '../../domain/repositories/repository.repository';

export class ProcessJobUseCase {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly repositoryRepository: RepositoryRepository,
    private readonly repoPreparer: RepoPreparer,
    private readonly aiRunner: AiRunner,
    private readonly prService: PullRequestService,
  ) { }

  async execute(jobId: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    job.markRunning('Preparing to start')
    this.jobRepository.save(job);

      const repository = await this.repositoryRepository.findById(job.repoId);
      if (!repository) {
        console.error(`Repository not found for job ${jobId}`);
        throw new Error('Repository not found')
      }

      const { owner, repo, path, forkMode, forkOrg, forkOwner } = repository

      this.aiRunner.run({
        filePath: job.filePath,
        repoPath: path,
        owner: forkMode ?  (forkOrg! ?? forkOwner!) : owner,
        repo,
      }).then((res: AiRunnerResult) => {
        const { success, output: prUrl } = res;
        console.info(`AI run completed for job ${job.id}`);
        job.markCompleted(prUrl, `Job completed: success=${success}`);
        this.jobRepository.save(job);
      }).catch((err) => {
        console.error(`AI run failed for job ${job.id}:`, err);
        job.markFailed(`AI run error`);
        this.jobRepository.save(job);
      }).finally(async () => {
        this.jobRepository.save(job);
      });
  }
}
