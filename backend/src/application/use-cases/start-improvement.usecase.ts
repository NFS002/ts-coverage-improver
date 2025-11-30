import { v4 as uuid } from 'uuid';
import { JobRepository } from '../../domain/repositories/job.repository';
import { CreateJobDto } from '../dto/create-job.dto';
import { ImprovementJob } from '../../domain/entities/improvement-job.entity';
import { JobQueue } from '../ports/job-queue';

export class StartImprovementUseCase {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobQueue: JobQueue,
  ) {}

  async execute(input: CreateJobDto): Promise<ImprovementJob> {
    const now = new Date();
    const job = new ImprovementJob(
      uuid(),
      input.repoId,
      input.filePath,
      'queued',
      null,
      [`[${now.toISOString()}] Job created for ${input.filePath}`],
      now,
      now,
    );
    await this.jobRepository.save(job);
    await this.jobQueue.enqueue(job.id);
    return job;
  }
}
