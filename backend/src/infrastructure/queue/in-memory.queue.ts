import { JobQueue } from '../../application/ports/job-queue';
import { ProcessJobUseCase } from '../../application/use-cases/process-job.usecase';
import { JobRepository } from '../../domain/repositories/job.repository';

export class InMemoryJobQueue implements JobQueue {
  private readonly pending: string[] = [];
  private isProcessing = false;
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly processor: ProcessJobUseCase,
    private readonly jobRepository: JobRepository,
  ) {
    this.timer = setInterval(() => this.run(), 1000);
  }

  async enqueue(jobId: string): Promise<void> {
    this.pending.push(jobId);
  }

  private async run() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      if (!this.pending.length) {
        const queued = await this.jobRepository.findQueued();
        queued.forEach((j) => this.pending.push(j.id));
      }

      const jobId = this.pending.shift();
      if (jobId) {
        await this.processor.execute(jobId);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
