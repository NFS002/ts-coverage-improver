import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schemas from '../persistence/entities'

let cachedDb: BetterSQLite3Database<typeof schemas> | null = null;

export type DbClient = BetterSQLite3Database<typeof schemas>;

export function createDbClient(): DbClient {
  if (cachedDb) return cachedDb;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'coverage.sqlite');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  // Keep schema creation minimal for the demo; migrations can be plugged in later.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      repoId TEXT NOT NULL,
      filePath TEXT NOT NULL,
      status TEXT NOT NULL,
      prUrl TEXT,
      log TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (repoId) REFERENCES repositories(id) ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      forkMode INTEGER NOT NULL,
      forkOwner TEXT,
      forkOrg TEXT,
      path TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(owner, repo, forkMode, forkOwner, forkOrg)
    );
  `);

  cachedDb = drizzle(sqlite, {
    schema: schemas
  });
  return cachedDb;
}
