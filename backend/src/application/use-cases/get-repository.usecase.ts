import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { JobRepository } from '../../domain/repositories/job.repository';
import { RepositorySummaryDto } from '../dto/repository-summary.dto';
import { Repository } from 'domain/entities/repository.entity';

export class GetRepositoryUseCase {
  constructor(
    private readonly repositoryRepo: RepositoryRepository,
    private readonly jobRepo: JobRepository,
  ) { }

  async execute(id: string): Promise<RepositorySummaryDto | null> {
    const repositoryDao = await this.repositoryRepo.findById(id);
    if (!repositoryDao) return null;
    const [stats] = await this.jobRepo.statsByRepo(repositoryDao.id);
    const { repo, owner, forkMode, forkOwner, forkOrg, createdAt, updatedAt } = repositoryDao;
    const { open: openJobs, queued: queuedJobs, total: totalJobs } = stats || { open: 0, queued: 0, total: 0 };
    return {
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
  }

  async findByOwnerAndName(params: {
    repo: string;
    owner: string;
  }): Promise<Repository | null> {
    return await this.repositoryRepo.findByOwnerAndName(params)
  }

  async findById(repoId: string): Promise<Repository | null> {
    return await this.repositoryRepo.findById(repoId)
  }
}
