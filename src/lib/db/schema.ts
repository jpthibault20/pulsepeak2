import {
    pgTable,
    uuid,
    varchar,
    text,
    date,
    timestamp,
    real,
    integer,
    jsonb,
    pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type {
    AvailabilitySlot,
    PlannedData,
    CompletedData,
    CyclingTest,
    StravaConfig,
    Zones,
} from '@/lib/data/type';

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const experienceEnum         = pgEnum('experience',          ['Débutant', 'Intermédiaire', 'Avancé']);
export const aiPersonalityEnum      = pgEnum('ai_personality',      ['Strict', 'Encourageant', 'Analytique']);
export const subscriptionPlanEnum   = pgEnum('subscription_plan',   ['free', 'dev', 'pro']);
export const planStatusEnum         = pgEnum('plan_status',         ['active', 'archived']);
export const weekTypeEnum           = pgEnum('week_type',           ['Load', 'Recovery', 'Taper']);
export const workoutStatusEnum      = pgEnum('workout_status',      ['pending', 'completed', 'missed']);
export const workoutModeEnum        = pgEnum('workout_mode',        ['Outdoor', 'Indoor']);
export const sportTypeEnum          = pgEnum('sport_type',          ['cycling', 'running', 'swimming']);
export const objectivePriorityEnum  = pgEnum('objective_priority',  ['principale', 'secondaire']);
export const objectiveStatusEnum    = pgEnum('objective_status',    ['upcoming', 'completed', 'missed']);

// ─────────────────────────────────────────────────────────────────────────────
// profiles
// Lié à auth.users de Supabase via l'id (même UUID).
// Un trigger Supabase peut auto-créer une ligne ici à l'inscription.
// ─────────────────────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
    id:           uuid('id').primaryKey(), // = auth.users.id
    createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt:  timestamp('last_login_at', { withTimezone: true }),

    firstName:    varchar('first_name',  { length: 100 }).notNull().default(''),
    lastName:     varchar('last_name',   { length: 100 }).notNull().default(''),
    email:        varchar('email',       { length: 255 }).notNull().default(''),
    birthDate:    date('birth_date'),
    weight:       real('weight'),
    height:       real('height'),

    experience:   experienceEnum('experience'),
    currentCTL:   real('current_ctl').default(0).notNull(),
    currentATL:   real('current_atl').default(0).notNull(),

    activeSports:       jsonb('active_sports').$type<{
                            swimming: boolean;
                            cycling:  boolean;
                            running:  boolean;
                        }>(),
    weeklyAvailability: jsonb('weekly_availability').$type<Record<string, AvailabilitySlot>>(),

    heartRate:    jsonb('heart_rate').$type<{
                    max:     number | null;
                    resting: number | null;
                    zones?:  Zones;
                  }>(),

    cycling:      jsonb('cycling').$type<{ Test?: CyclingTest; comments?: string }>(),
    running:      jsonb('running').$type<{
                    Test?: {
                        recentRaceTimeSec?:       string;
                        recentRaceDistanceMeters?: string;
                        vma?:   number;
                        zones?: Zones;
                    };
                    comments?: string;
                  }>(),
    swimming:     jsonb('swimming').$type<{
                    Test?: {
                        recentRaceTimeSec?:        number;
                        recentRaceDistanceMeters?:  number;
                        poolLengthMeters?:          number;
                        totalStrokes?:              number;
                    };
                    comments?: string;
                  }>(),

    aiPersonality: aiPersonalityEnum('ai_personality').default('Analytique').notNull(),
    plan:          subscriptionPlanEnum('plan').default('free').notNull(),
    strava:        jsonb('strava').$type<StravaConfig>(),

    goal:          text('goal').default('').notNull(),
    objectiveDate: date('objective_date'),
    weaknesses:    text('weaknesses').default('').notNull(),

    aiCallsCount:     integer('ai_calls_count').default(0).notNull(),
    aiCallsResetDate: date('ai_calls_reset_date'),
});

// ─────────────────────────────────────────────────────────────────────────────
// plans
// ─────────────────────────────────────────────────────────────────────────────

export const plans = pgTable('plans', {
    id:                        uuid('id').primaryKey().defaultRandom(),
    userId:                    uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt:                 timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    name:                      varchar('name', { length: 255 }).notNull(),
    startDate:                 date('start_date').notNull(),
    goalDate:                  date('goal_date'),
    macroStrategyDescription:  text('macro_strategy_description'),
    status:                    planStatusEnum('status').default('active').notNull(),
    objectivesIds:             jsonb('objectives_ids').$type<string[]>().default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// blocks  (méso-cycles)
// ─────────────────────────────────────────────────────────────────────────────

export const blocks = pgTable('blocks', {
    id:           uuid('id').primaryKey().defaultRandom(),
    planId:       uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
    userId:       uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    orderIndex:   integer('order_index').notNull(),
    type:         varchar('type', { length: 50 }).notNull(),   // Base | Build | Peak | Race
    theme:        text('theme'),
    weekCount:    integer('week_count').notNull(),
    startDate:    date('start_date').notNull(),

    startCTL:     real('start_ctl'),
    targetCTL:    real('target_ctl'),
    avgWeeklyTSS: real('avg_weekly_tss'),
});

// ─────────────────────────────────────────────────────────────────────────────
// weeks
// ─────────────────────────────────────────────────────────────────────────────

export const weeks = pgTable('weeks', {
    id:           uuid('id').primaryKey().defaultRandom(),
    blockId:      uuid('block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
    userId:       uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    weekNumber:   integer('week_number').notNull(),
    type:         weekTypeEnum('type').notNull(),
    targetTSS:    real('target_tss'),
    actualTSS:    real('actual_tss').default(0).notNull(),
    userFeedback: text('user_feedback'),
});

// ─────────────────────────────────────────────────────────────────────────────
// workouts
// ─────────────────────────────────────────────────────────────────────────────

export const workouts = pgTable('workouts', {
    id:            uuid('id').primaryKey().defaultRandom(),
    userId:        uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    weekId:        uuid('week_id').references(() => weeks.id, { onDelete: 'set null' }),
    createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

    date:          date('date').notNull(),
    sportType:     sportTypeEnum('sport_type').notNull(),
    title:         varchar('title', { length: 255 }).notNull(),
    workoutType:   varchar('workout_type', { length: 100 }),
    mode:          workoutModeEnum('mode').default('Outdoor').notNull(),
    status:        workoutStatusEnum('status').default('pending').notNull(),

    plannedData:   jsonb('planned_data').$type<PlannedData>(),
    completedData: jsonb('completed_data').$type<CompletedData>(),
});

// ─────────────────────────────────────────────────────────────────────────────
// objectives  (courses / événements cibles)
// ─────────────────────────────────────────────────────────────────────────────

export const objectives = pgTable('objectives', {
    id:            uuid('id').primaryKey().defaultRandom(),
    userId:        uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

    name:          varchar('name', { length: 255 }).notNull(),
    date:          date('date').notNull(),
    sport:         varchar('sport', { length: 50 }).notNull(),   // cycling | running | swimming | triathlon | duathlon
    distanceKm:    real('distance_km'),
    elevationGainM: real('elevation_gain_m'),
    priority:      objectivePriorityEnum('priority').notNull().default('secondaire'),
    status:        objectiveStatusEnum('status').notNull().default('upcoming'),
    comment:       text('comment'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Relations (pour les requêtes avec .with() de Drizzle)
// ─────────────────────────────────────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
    plans:      many(plans),
    blocks:     many(blocks),
    weeks:      many(weeks),
    workouts:   many(workouts),
    objectives: many(objectives),
}));

export const objectivesRelations = relations(objectives, ({ one }) => ({
    profile: one(profiles, { fields: [objectives.userId], references: [profiles.id] }),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
    profile: one(profiles, { fields: [plans.userId],   references: [profiles.id] }),
    blocks:  many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
    plan:    one(plans,    { fields: [blocks.planId],   references: [plans.id] }),
    profile: one(profiles, { fields: [blocks.userId],   references: [profiles.id] }),
    weeks:   many(weeks),
}));

export const weeksRelations = relations(weeks, ({ one, many }) => ({
    block:    one(blocks,    { fields: [weeks.blockId],  references: [blocks.id] }),
    profile:  one(profiles,  { fields: [weeks.userId],   references: [profiles.id] }),
    workouts: many(workouts),
}));

export const workoutsRelations = relations(workouts, ({ one }) => ({
    week:    one(weeks,    { fields: [workouts.weekId],  references: [weeks.id] }),
    profile: one(profiles, { fields: [workouts.userId],  references: [profiles.id] }),
}));
