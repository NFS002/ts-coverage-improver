import { and, eq, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { Repository } from '../../domain/entities/repository.entity';
import { DbClient } from '../config/database';
import {
  repositoriesTable,
  SelectRepositoryRow,
} from '../persistence/entities/repositories';

const toDao = (row: SelectRepositoryRow): Repository =>
  new Repository(row.id, row.httpsUrl, row.sshUrl, row.createdAt, row.updatedAt);

const toRow = (repo: Repository): SelectRepositoryRow => ({
  id: repo.id,
  httpsUrl: repo.httpsUrl,
  sshUrl: repo.sshUrl,
  createdAt: repo.createdAt,
  updatedAt: repo.updatedAt,
});

export class RepositoryDrizzleRepository implements RepositoryRepository {
  constructor(private readonly db: DbClient) {}

  async save(repository: Repository): Promise<void> {
    const row = toRow(repository);
    await this.db
      .insert(repositoriesTable)
      .values(row)
      .onConflictDoUpdate({ target: repositoriesTable.id, set: row })
      .run();
  }

  async findById(id: string): Promise<Repository | null> {
    const row = this.db.select().from(repositoriesTable).where(eq(repositoriesTable.id, id)).get();
    return row ? toDao(row) : null;
  }

  async findByHttpsUrl(httpsUrl: string): Promise<Repository | null> {
    const row = this.db
      .select()
      .from(repositoriesTable)
      .where(eq(repositoriesTable.httpsUrl, httpsUrl))
      .get();
    return row ? toDao(row) : null;
  }

  async findBySshUrl(sshUrl: string): Promise<Repository | null> {
    const row = this.db.select().from(repositoriesTable).where(eq(repositoriesTable.sshUrl, sshUrl)).get();
    return row ? toDao(row) : null;
  }

  /* Looks up a repoistoru by both https and ssh urls */
  async findByUrls({
    httpsUrl,
    sshUrl,
  }: {
    httpsUrl: string;
    sshUrl: string;
  }): Promise<Repository | null> {
    const row = this.db
      .select()
      .from(repositoriesTable)
      .where(
        and(
        eq(repositoriesTable.httpsUrl, httpsUrl),
        eq(repositoriesTable.sshUrl, sshUrl),
        ),
      ).get();

    return row ? toDao(row) : null;
  }

  async list(): Promise<Repository[]> {
    const rows = this.db.select().from(repositoriesTable).all();
    return rows.map(toDao);
  }

  async ensureExists(httpsUrl: string, sshUrl: string): Promise<Repository> {
    const existing =
      (await this.findByHttpsUrl(httpsUrl)) ||
      (await this.findBySshUrl(sshUrl));
    if (existing) {
      existing.touch();
      await this.save(existing);
      return existing;
    }
    const now = new Date();
    const repo = new Repository(uuid(), httpsUrl, sshUrl, now, now);
    await this.save(repo);
    return repo;
  }
}
