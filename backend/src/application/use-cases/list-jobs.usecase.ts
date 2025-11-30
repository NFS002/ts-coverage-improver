import { JobRepository } from '../../domain/repositories/job.repository';
import { ImprovementJob } from '../../domain/entities/improvement-job.entity';

export class ListJobsUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  async execute(repoId?: string): Promise<ImprovementJob[]> {
    return this.jobRepository.list(repoId);
  }
}
