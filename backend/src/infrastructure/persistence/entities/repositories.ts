import { sqliteTable, text, integer, uniqueIndex, int } from 'drizzle-orm/sqlite-core';

export const repositoriesTable = sqliteTable(
  'repositories',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    forkMode: integer('forkMode', {
      mode: 'boolean',
    }).notNull(),
    forkOwner: text('forkOwner'),
    forkOrg: text('forkOrg'),
    path: text('path').notNull().unique(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    uniqueRepoIdx: uniqueIndex('repositories_unique_repo_idx').on(
      table.owner,
      table.repo,
      table.forkMode,
      table.forkOwner,
      table.forkOrg,
    ),
  }),
);

export type SelectRepositoryRow = typeof repositoriesTable.$inferSelect;
export type InsertRepositoryRow = typeof repositoriesTable.$inferInsert;
