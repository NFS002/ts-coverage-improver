import { ImprovementJob } from '../entities/improvement-job.entity';
import { JobStatus } from '../value-objects/job-status';

export type RepoJobStats = {
  repoId: string;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
  open: number;
};

export interface JobRepository {
  save(job: ImprovementJob): Promise<void>;
  findById(id: string): Promise<ImprovementJob | null>;
  list(repoId?: string): Promise<ImprovementJob[]>;
  findQueued(): Promise<ImprovementJob[]>;
  statsByRepo(repoId?: string): Promise<RepoJobStats[]>;
  updateStatus(id: string, status: JobStatus, prUrl?: string | null): Promise<void>;
  appendLog(id: string, message: string): Promise<void>;
}
