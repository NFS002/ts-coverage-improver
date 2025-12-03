import { desc, eq, or, sql } from 'drizzle-orm';
import { JobRepository, RepoJobStats } from '../../domain/repositories/job.repository';
import { ImprovementJob } from '../../domain/entities/improvement-job.entity';
import { JobStatus } from '../../domain/value-objects/job-status';
import { DbClient } from '../config/database';
import { jobsTable, SelectJobRow } from '../persistence/entities/jobs';

const toDto = (row: SelectJobRow): ImprovementJob => ImprovementJob.fromRow(row);

const toRow = (job: ImprovementJob): SelectJobRow => ({
  id: job.id,
  repoId: job.repoId,
  filePath: job.filePath,
  status: job.status,
  prUrl: job.prUrl,
  log: job.log,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});

export class JobDrizzleRepository implements JobRepository {
  constructor(private readonly db: DbClient) {}

  async save(job: ImprovementJob): Promise<void> {
    const row = toRow(job);
    await this.db
      .insert(jobsTable)
      .values(row)
      .onConflictDoUpdate({ target: jobsTable.id, set: row })
      .run();
  }

  async findById(id: string): Promise<ImprovementJob | null> {
    const row = this.db.select().from(jobsTable).where(eq(jobsTable.id, id)).get();
    return row ? toDto(row) : null;
  }

  async list(repoId?: string): Promise<ImprovementJob[]> {
    const baseQuery = this.db.select().from(jobsTable);
    const rows = (repoId ? baseQuery.where(eq(jobsTable.repoId, repoId)) : baseQuery)
      .orderBy(desc(jobsTable.createdAt))
      .all();
    return rows.map(toDto);
  }

  async findQueued(): Promise<ImprovementJob[]> {
    const rows = this.db.select().from(jobsTable).where(eq(jobsTable.status, 'queued')).all();
    return rows.map(toDto);
  }

  async findRunning(): Promise<ImprovementJob[]> {
    const rows = this.db.select().from(jobsTable).where(eq(jobsTable.status, 'running')).all();
    return rows.map(toDto);
  }

  async findIncomplete(): Promise<ImprovementJob[]> {
    const rows = this.db
      .select()
      .from(jobsTable)
      .where(
        or(
          eq(jobsTable.status, 'queued'),
          eq(jobsTable.status, 'running'),
        )
      )
      .all();
    return rows.map(toDto);
  }

  async statsByRepo(repoId?: string): Promise<RepoJobStats[]> {
    const baseQuery = this.db
      .select({
        repoId: jobsTable.repoId,
        status: jobsTable.status,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(jobsTable);
    const grouped = (repoId
      ? baseQuery.where(eq(jobsTable.repoId, repoId))
      : baseQuery
    )
      .groupBy(jobsTable.repoId, jobsTable.status)
      .all();
    const map = new Map<string, RepoJobStats>();
    for (const row of grouped) {
      const existing =
        map.get(row.repoId) ||
        {
          repoId: row.repoId,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          total: 0,
          open: 0,
        };
      existing.total += row.count;
      if (row.status === 'queued') {
        existing.queued = row.count;
      } else if (row.status === 'running') {
        existing.running = row.count;
      } else if (row.status === 'completed') {
        existing.completed = row.count;
      } else if (row.status === 'failed') {
        existing.failed = row.count;
      }
      map.set(row.repoId, existing);
    }
    for (const stats of map.values()) {
      stats.open = stats.queued + stats.running;
    }
    return Array.from(map.values());
  }

  async updateStatus(id: string, status: JobStatus, prUrl?: string | null): Promise<void> {
    const update: Partial<SelectJobRow> = {
      status,
      updatedAt: new Date(),
    };
    if (prUrl !== undefined) {
      update.prUrl = prUrl;
    }
    await this.db.update(jobsTable).set(update).where(eq(jobsTable.id, id)).run();
  }

  async appendLog(id: string, message: string): Promise<void> {
    const row = this.db.select().from(jobsTable).where(eq(jobsTable.id, id)).get();
    if (!row) return;
    const log = [...(row.log ?? []), `[${new Date().toISOString()}] ${message}`];
    await this.db
      .update(jobsTable)
      .set({ log, updatedAt: new Date() })
      .where(eq(jobsTable.id, id))
      .run();
  }
}
