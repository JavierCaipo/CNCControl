import { pgTable, text, integer, boolean, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  role: text('role').$type<'operario' | 'gerente'>().notNull(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  machineId: text('machine_id').default('SF3015HM').notNull(),
  machineName: text('machine_name').default('Senfeng SF3015HM').notNull(),
  status: text('status').$type<'ok' | 'warning' | 'critical'>().default('ok').notNull(),
  payload: jsonb('payload').notNull(),
  revision: integer('revision').default(1).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedById: text('updated_by_id').notNull(),
  updatedByName: text('updated_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Alias para compatibilidad con código existente
export const sharedReviews = reviews;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
