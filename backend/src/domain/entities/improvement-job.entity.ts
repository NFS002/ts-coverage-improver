import { JobStatus } from '../value-objects/job-status';

export class ImprovementJob {
  constructor(
    public readonly id: string,
    public readonly repoId: string,
    public readonly filePath: string,
    public status: JobStatus,
    public prUrl: string | null,
    public log: string[],
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  markRunning(note?: string) {
    this.status = 'running';
    this.touch(note);
  }

  markCompleted(prUrl: string | null, note?: string) {
    this.status = 'completed';
    this.prUrl = prUrl;
    this.touch(note);
  }

  markFailed(note?: string) {
    this.status = 'failed';
    this.touch(note);
  }

  private touch(note?: string) {
    this.updatedAt = new Date();
    if (note) {
      this.log.push(`[${this.updatedAt.toISOString()}] ${note}`);
    }
  }
}
