'use server';

import { db } from '@/lib/db';
import { profiles, workouts as workoutsTable, plans as plansTable } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/admin';
import { eq, sql, desc } from 'drizzle-orm';
import { ReturnCode } from '@/lib/data/type';
import { revalidatePath } from 'next/cache';

// ─── Types exposés au client ──────────────────────────────────────────────────

export type AdminUserRow = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: 'free' | 'dev' | 'pro';
    role: 'user' | 'admin';
    createdAt: string;
    lastLoginAt: string | null;
    tokenPerMonth: number;
    tokenPerMonthResetDate: string | null;
    aiPlanCallsCount: number;
    aiWorkoutCallsCount: number;
    workoutsCount: number;
    plansCount: number;
};

export type AdminStats = {
    totalUsers: number;
    usersByPlan: { free: number; dev: number; pro: number };
    adminsCount: number;
    totalTokensThisMonth: number;
    activeLast7Days: number;
    activeLast30Days: number;
    newUsersLast30Days: number;
    totalWorkouts: number;
};

// ─── Queries (lecture) ────────────────────────────────────────────────────────

export async function listAdminUsersAction(): Promise<AdminUserRow[]> {
    try {
        await requireAdmin();

        const workoutCounts = db
            .select({
                userId: workoutsTable.userId,
                count:  sql<number>`count(*)::int`.as('workouts_count'),
            })
            .from(workoutsTable)
            .groupBy(workoutsTable.userId)
            .as('wc');

        const planCounts = db
            .select({
                userId: plansTable.userId,
                count:  sql<number>`count(*)::int`.as('plans_count'),
            })
            .from(plansTable)
            .groupBy(plansTable.userId)
            .as('pc');

        const rows = await db
            .select({
                id:                     profiles.id,
                email:                  profiles.email,
                firstName:              profiles.firstName,
                lastName:               profiles.lastName,
                plan:                   profiles.plan,
                role:                   profiles.role,
                createdAt:              profiles.createdAt,
                lastLoginAt:            profiles.lastLoginAt,
                tokenPerMonth:          profiles.tokenPerMonth,
                tokenPerMonthResetDate: profiles.tokenPerMonthResetDate,
                aiPlanCallsCount:       profiles.aiPlanCallsCount,
                aiWorkoutCallsCount:    profiles.aiWorkoutCallsCount,
                workoutsCount:          workoutCounts.count,
                plansCount:             planCounts.count,
            })
            .from(profiles)
            .leftJoin(workoutCounts, eq(workoutCounts.userId, profiles.id))
            .leftJoin(planCounts,    eq(planCounts.userId,    profiles.id))
            .orderBy(desc(profiles.createdAt));

        return rows.map((r) => ({
            id:                     r.id,
            email:                  r.email,
            firstName:              r.firstName,
            lastName:               r.lastName,
            plan:                   r.plan,
            role:                   r.role,
            createdAt:              r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
            lastLoginAt:            r.lastLoginAt instanceof Date ? r.lastLoginAt.toISOString() : (r.lastLoginAt ?? null),
            tokenPerMonth:          r.tokenPerMonth ?? 0,
            tokenPerMonthResetDate: r.tokenPerMonthResetDate ?? null,
            aiPlanCallsCount:       r.aiPlanCallsCount    ?? 0,
            aiWorkoutCallsCount:    r.aiWorkoutCallsCount ?? 0,
            workoutsCount:          r.workoutsCount ?? 0,
            plansCount:             r.plansCount    ?? 0,
        }));
    } catch (err) {
        console.error('[listAdminUsersAction]', err);
        return [];
    }
}

export async function getAdminStatsAction(): Promise<AdminStats | null> {
    try {
        await requireAdmin();

        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [agg] = await db
            .select({
                total:       sql<number>`count(*)::int`,
                free:        sql<number>`count(*) filter (where ${profiles.plan} = 'free')::int`,
                dev:         sql<number>`count(*) filter (where ${profiles.plan} = 'dev')::int`,
                pro:         sql<number>`count(*) filter (where ${profiles.plan} = 'pro')::int`,
                admins:      sql<number>`count(*) filter (where ${profiles.role} = 'admin')::int`,
                tokensMonth: sql<number>`coalesce(sum(case when ${profiles.tokenPerMonthResetDate} = ${monthStr} then ${profiles.tokenPerMonth} else 0 end), 0)::int`,
                active7:     sql<number>`count(*) filter (where ${profiles.lastLoginAt} >= ${sevenDaysAgo.toISOString()})::int`,
                active30:    sql<number>`count(*) filter (where ${profiles.lastLoginAt} >= ${thirtyDaysAgo.toISOString()})::int`,
                new30:       sql<number>`count(*) filter (where ${profiles.createdAt}   >= ${thirtyDaysAgo.toISOString()})::int`,
            })
            .from(profiles);

        const [{ workoutsTotal }] = await db
            .select({ workoutsTotal: sql<number>`count(*)::int` })
            .from(workoutsTable);

        return {
            totalUsers:           agg.total,
            usersByPlan:          { free: agg.free, dev: agg.dev, pro: agg.pro },
            adminsCount:          agg.admins,
            totalTokensThisMonth: agg.tokensMonth,
            activeLast7Days:      agg.active7,
            activeLast30Days:     agg.active30,
            newUsersLast30Days:   agg.new30,
            totalWorkouts:        workoutsTotal,
        };
    } catch (err) {
        console.error('[getAdminStatsAction]', err);
        return null;
    }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updateUserPlanAction(
    userId: string,
    plan: 'free' | 'dev' | 'pro',
): Promise<{ state: ReturnCode }> {
    try {
        await requireAdmin();
        if (!['free', 'dev', 'pro'].includes(plan)) {
            return { state: ReturnCode.RC_Error };
        }
        await db
            .update(profiles)
            .set({ plan, updatedAt: new Date() })
            .where(eq(profiles.id, userId));
        revalidatePath('/admin');
        return { state: ReturnCode.RC_OK };
    } catch (err) {
        console.error('[updateUserPlanAction]', err);
        return { state: ReturnCode.RC_Error };
    }
}

export async function updateUserRoleAction(
    userId: string,
    role: 'user' | 'admin',
): Promise<{ state: ReturnCode }> {
    try {
        const ctx = await requireAdmin();
        if (!['user', 'admin'].includes(role)) {
            return { state: ReturnCode.RC_Error };
        }
        // Garde-fou : un admin ne peut pas se rétrograder lui-même
        // (évite de se bloquer hors de /admin par accident).
        if (ctx.userId === userId && role !== 'admin') {
            return { state: ReturnCode.RC_Error };
        }
        await db
            .update(profiles)
            .set({ role, updatedAt: new Date() })
            .where(eq(profiles.id, userId));
        revalidatePath('/admin');
        return { state: ReturnCode.RC_OK };
    } catch (err) {
        console.error('[updateUserRoleAction]', err);
        return { state: ReturnCode.RC_Error };
    }
}

export async function resetUserTokensAction(
    userId: string,
): Promise<{ state: ReturnCode }> {
    try {
        await requireAdmin();
        await db
            .update(profiles)
            .set({
                tokenPerMonth:        0,
                aiPlanCallsCount:     0,
                aiWorkoutCallsCount:  0,
                updatedAt:            new Date(),
            })
            .where(eq(profiles.id, userId));
        revalidatePath('/admin');
        return { state: ReturnCode.RC_OK };
    } catch (err) {
        console.error('[resetUserTokensAction]', err);
        return { state: ReturnCode.RC_Error };
    }
}
