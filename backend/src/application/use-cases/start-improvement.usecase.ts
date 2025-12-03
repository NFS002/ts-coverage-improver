import { v4 as uuid } from 'uuid';
import { JobRepository } from '../../domain/repositories/job.repository';
import { CreateJobDto } from '../dto/create-job.dto';
import { ImprovementJob } from '../../domain/entities/improvement-job.entity';
import { JobQueue } from '../ports/job-queue';
import { Repository } from 'domain/entities/repository.entity';

export class StartImprovementUseCase {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobQueue: JobQueue,
  ) {}

  async execute(repo: Repository, filePath: string): Promise<ImprovementJob> {
    const job = ImprovementJob.create(repo, filePath);
    await this.jobQueue.enqueue(job);
    return job;
  }
}
