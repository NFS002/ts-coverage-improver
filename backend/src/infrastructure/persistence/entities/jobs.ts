import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { repositoriesTable } from './repositories';

export const jobsTable = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  repoId: text('repoId')
    .notNull()
    .references(() => repositoriesTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  filePath: text('filePath').notNull(),
  status: text('status').notNull(),
  prUrl: text('prUrl'),
  log: text('log', { mode: 'json' }).notNull().$type<string[]>(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export type SelectJobRow = typeof jobsTable.$inferSelect;
export type InsertNewJobRow = typeof jobsTable.$inferInsert;
