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
    const repo = await this.repositoryRepo.findById(id);
    if (!repo) return null;
    const [stats] = await this.jobRepo.statsByRepo(repo.id);
    return {
      id: repo.id,
      openJobs: stats?.open ?? 0,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
      queuedJobs: stats?.queued ?? 0,
      totalJobs: stats?.total ?? 0,
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
