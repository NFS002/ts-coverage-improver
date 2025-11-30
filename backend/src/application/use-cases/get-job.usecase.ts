import { JobRepository } from '../../domain/repositories/job.repository';
import { ImprovementJob } from '../../domain/entities/improvement-job.entity';

export class GetJobUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  async execute(id: string): Promise<ImprovementJob | null> {
    return this.jobRepository.findById(id);
  }
}
