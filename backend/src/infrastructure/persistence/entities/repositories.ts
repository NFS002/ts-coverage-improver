import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const repositoriesTable = sqliteTable(
  'repositories',
  {
    id: text('id').primaryKey(),
    httpsUrl: text('httpsUrl').notNull(),
    sshUrl: text('sshUrl').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    httpsIdx: uniqueIndex('repositories_https_idx').on(table.httpsUrl),
    sshIdx: uniqueIndex('repositories_ssh_idx').on(table.sshUrl),
  }),
);

export type SelectRepositoryRow = typeof repositoriesTable.$inferSelect;
