import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { JobRepository } from '../../domain/repositories/job.repository';
import { RepositorySummaryDto } from '../dto/repository-summary.dto';

export class ListRepositoriesUseCase {
  constructor(
    private readonly repositoryRepo: RepositoryRepository,
    private readonly jobRepo: JobRepository,
  ) {}

  async execute(): Promise<RepositorySummaryDto[]> {
    const [repositories, stats] = await Promise.all([
      this.repositoryRepo.list(),
      this.jobRepo.statsByRepo(),
    ]);
    const statsByRepo = new Map(stats.map((s) => [s.repoId, s]));
    return repositories.map((repo) => {
      const repoStats = statsByRepo.get(repo.id);
      return {
        id: repo.id,
        createdAt: repo.createdAt,
        updatedAt: repo.updatedAt,
        openJobs: repoStats?.open ?? 0,
        queuedJobs: repoStats?.queued ?? 0,
        totalJobs: repoStats?.total ?? 0,
      };
    });
  }
}
