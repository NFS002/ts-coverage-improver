import { and, eq, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { RepositoryRepository } from '../../domain/repositories/repository.repository';
import { Repository } from '../../domain/entities/repository.entity';
import  { DbClient, ForkModeConfig } from '../config';
import {
  InsertRepositoryRow,
  repositoriesTable,
  SelectRepositoryRow,
} from '../persistence/entities/repositories';

const toDao = (row: SelectRepositoryRow): Repository => Repository.fromRow(row);

const toRow = (repo: Repository): InsertRepositoryRow => repo.toRow();

export class RepositoryDrizzleRepository implements RepositoryRepository {
  constructor(private readonly db: DbClient, private readonly forkModeConfig: ForkModeConfig) {}

  async save(repository: Repository): Promise<void> {
    const row = toRow(repository);
    await this.db
      .insert(repositoriesTable)
      .values(row)
      .run();
  }

  async findById(id: string): Promise<Repository | null> {
    const row = this.db.select().from(repositoriesTable).where(eq(repositoriesTable.id, id)).get();
    return row ? toDao(row) : null;
  }

  async findByOwnerAndName(params: { owner: string; repo: string}): Promise<Repository | null> {
    const { owner, repo } = params;
    const row = this.db
      .select()
      .from(repositoriesTable)
      .where(
        and(
          eq(repositoriesTable.owner, owner),
          eq(repositoriesTable.repo, repo),
        ),
      ).get();

    return row ? toDao(row) : null;
  }

  async list(): Promise<Repository[]> {
    const rows = this.db.select().from(repositoriesTable).all();
    return rows.map(toDao);
  }

  // async getOrCreate(params: {
  //   repo: string;
  //   owner: string;
  // }): Promise<Repository> {
  //   const existing = await this.findByOwnerAndName(params);
  //   if (existing) {
  //     existing.touch();
  //     await this.save(existing);
  //     return existing;
  //   }
  //   const { repo, owner } = params;
  //   const { enabled: forkEnabled, owner: forkOwner, org: forkOrg } = this.forkModeConfig;
  //   const now = new Date();
  //   const repositoryDao = new Repository({
  //     id: uuid(),
  //     repo,
  //     owner,
  //     forkMode: forkEnabled,
  //     forkOwner: forkOwner,
  //     forkOrg: forkOrg,
  //     createdAt: now,
  //     updatedAt: now,
  //   });
  //   await this.save(repositoryDao);
  //   return repositoryDao;
  // }
}
