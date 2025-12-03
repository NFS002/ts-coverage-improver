import { JobQueue } from '../../application/ports/job-queue';
import { ProcessJobUseCase } from '../../application/use-cases/process-job.usecase';
import { JobRepository } from '../../domain/repositories/job.repository';
import { ImprovementJob } from 'domain/entities/improvement-job.entity';

export class DbJobQueue implements JobQueue {
  private isProcessing = false;
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly processor: ProcessJobUseCase,
    private readonly jobRepository: JobRepository,
  ) {
    this.timer = setInterval(() => this.run(), 1000);
  }

  // Equeueing a job just saves it to the database with status 'queued'
  async enqueue(job: ImprovementJob): Promise<void> {
    await this.jobRepository.save(job);
  }

  private async run() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      const incomplete = await this.jobRepository.findIncomplete();
      const { runningJobs, queuedJobs } = incomplete.reduce(
        (acc, job) => {
          if (job.status === 'running') {
            acc.runningJobs.push(job);
          }
          else if (job.status === 'queued') {
            acc.queuedJobs.push(job);
          }
          return acc;
        },
        { runningJobs: [] as ImprovementJob[], queuedJobs: [] as ImprovementJob[] },
      );
      const runningJobsByRepo = new Set(runningJobs.map((job) => job.repoId));

      for (const job of queuedJobs) {
        await this.jobRepository.updateStatus(job.id, 'running');
        if (!runningJobsByRepo.has(job.repoId)) {
          this.processor.execute(job.id);
          break;
        }
      }

    } finally {
      this.isProcessing = false;
    }
  }
}
