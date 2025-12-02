import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { JobRepository } from '../../domain/repositories/job.repository';
import { RepositorySummaryDto } from '../dto/repository-summary.dto';

export class ListRepositoriesUseCase {
  constructor(
    private readonly repositoryRepo: RepositoryRepository,
    private readonly jobRepo: JobRepository,
  ) {}

  async execute(): Promise<RepositorySummaryDto[]> {
    const [repositoryDaos, repositoryStats] = await Promise.all([
      this.repositoryRepo.list(),
      this.jobRepo.statsByRepo(),
    ]);
    const statsByRepo = new Map(repositoryStats.map((s) => [s.repoId, s]));
    return repositoryDaos.map((repositoryDao) => {
      const repoStats = statsByRepo.get(repositoryDao.id);
      const { id, repo, owner, forkMode, forkOwner, forkOrg, createdAt, updatedAt } = repositoryDao;
      const { open: openJobs, queued: queuedJobs, total: totalJobs } = repoStats || { open: 0, queued: 0, total: 0 };
      const repoSummary: RepositorySummaryDto =  {
        id,
        repo,
        owner,
        forkMode,
        forkOwner,
        forkOrg,
        createdAt,
        updatedAt,
        openJobs,
        queuedJobs,
        totalJobs,
      };
      return repoSummary;
    });
  }
}
