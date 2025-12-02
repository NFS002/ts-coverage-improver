import { SelectJobRow } from 'infrastructure/persistence/entities';
import { JobStatus } from '../value-objects/job-status';
import { Repository } from './repository.entity';
import { v4 as uuid } from 'uuid';

export class ImprovementJob {

  id: string;
  repoId: string;
  filePath: string;
  status: JobStatus;
  prUrl: string | null;
  log: string[];
  createdAt: Date;
  updatedAt: Date;

  constructor(
    params: {
      id: string,
      repoId: string,
      filePath: string,
      status: JobStatus,
      prUrl: string | null,
      log: string[],
      createdAt: Date,
      updatedAt: Date,
    }
  ) {
    const { id, repoId, filePath, status, prUrl, log, createdAt, updatedAt } = params;
    this.id = id;
    this.repoId = repoId;
    this.filePath = filePath;
    this.status = status;
    this.prUrl = prUrl;
    this.log = log;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromRepositoryDao(repositoryDao: Repository, filePath: string): ImprovementJob {
    const { id: repoId, owner, repo, updatedAt, createdAt } = repositoryDao;
    return new ImprovementJob({
      id: uuid(),
      repoId,
      filePath,
      status: 'queued',
      prUrl: null,
      log: [`[${new Date().toISOString()}] Job created for ${owner}/${repo}`],
      createdAt,
      updatedAt
    });
  }

    static fromRow(row: SelectJobRow): ImprovementJob {
    const { id, repoId, prUrl, filePath, status, log, updatedAt, createdAt} = row;
    return new ImprovementJob({
      id,
      repoId,
      filePath,
      status: status as JobStatus,
      prUrl,
      log,
      createdAt,
      updatedAt,
    });
  }

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

  appendLog(message: string) {
    this.log.push(`[${new Date().toISOString()}] ${message}`)
  }

  private touch(note?: string) {
    this.updatedAt = new Date();
    if (note) {
      this.log.push(`[${this.updatedAt.toISOString()}] ${note}`);
    }
  }
}
