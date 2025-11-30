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

  async execute(repo: Repository): Promise<ImprovementJob> {
    const now = new Date();
    const job = ImprovementJob.fromRepositoryDao(repo);
    await this.jobQueue.enqueue(job.id);
    await this.jobRepository.save(job);
    return job;
  }
}
