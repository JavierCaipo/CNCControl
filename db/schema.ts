import { pgTable, text, integer, boolean, timestamp, uuid, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export type UserRole = 'superadmin' | 'gerente' | 'supervisor' | 'operario';
export type PlanType = 'starter' | 'pro' | 'enterprise';
export type ReviewStatus = 'ok' | 'warning' | 'critical';

// ==============================================================================
// 1. Organizaciones (Tenants)
// ==============================================================================
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  logoUrl: text('logo_url'),
  plan: text('plan').$type<PlanType>().default('starter').notNull(),
  maxMachines: integer('max_machines').default(5).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 2. Máquinas CNC vinculadas a Organizaciones
// ==============================================================================
export const machines = pgTable(
  'machines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull(), // Ej. 'SF3015HM'
    name: text('name').notNull(), // Ej. 'Senfeng SF3015HM'
    model: text('model'),
    serialNumber: text('serial_number'),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('machines_org_code_idx').on(table.organizationId, table.code),
  ]
);

// ==============================================================================
// 3. Usuarios de Planta y Gestión (Aislados por Organización)
// ==============================================================================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // Nullable solo para 'superadmin'
  name: text('name').notNull(),
  role: text('role').$type<UserRole>().notNull(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 4. Historial Inmutable Append-Only de Revisiones por Turno
// ==============================================================================
export const reviewSnapshots = pgTable('review_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  machineId: uuid('machine_id')
    .references(() => machines.id, { onDelete: 'cascade' })
    .notNull(),
  operatorId: uuid('operator_id')
    .references(() => users.id)
    .notNull(),
  supervisorId: uuid('supervisor_id').references(() => users.id),
  shift: text('shift').notNull(),
  workOrder: text('work_order').default('').notNull(),
  status: text('status').$type<ReviewStatus>().notNull(),
  checklistPayload: jsonb('checklist_payload').notNull(),
  incidentsCount: integer('incidents_count').default(0).notNull(),
  evidenceUrls: jsonb('evidence_urls').default([]).notNull(),
  supervisorApprovedAt: timestamp('supervisor_approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 5. Tabla Legacy en vivo (Reviews) - Compatibilidad Temporal Fase 1 -> Fase 2
// ==============================================================================
export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // Nullable para migración segura
  userId: uuid('user_id').references(() => users.id),
  machineId: text('machine_id').default('SF3015HM').notNull(),
  machineName: text('machine_name').default('Senfeng SF3015HM').notNull(),
  status: text('status').$type<ReviewStatus>().default('ok').notNull(),
  payload: jsonb('payload').notNull(),
  revision: integer('revision').default(1).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedById: text('updated_by_id').notNull(),
  updatedByName: text('updated_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Alias para compatibilidad con código existente
export const sharedReviews = reviews;

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Machine = typeof machines.$inferSelect;
export type NewMachine = typeof machines.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ReviewSnapshot = typeof reviewSnapshots.$inferSelect;
export type NewReviewSnapshot = typeof reviewSnapshots.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
