/******************************************************************************
 * @file    plan-overview.ts
 * @brief   Projection agrégée du plan actif pour la vue "Plan" (timeline
 *          des blocs / semaines / séances avec leur statut, TSS prévu et réalisé).
 *          Consommé côté client via `getPlanOverview()`.
 ******************************************************************************/

'use server';

import { addDays, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import {
    getBlock,
    getObjectives,
    getPlan,
    getWeek,
    getWorkout,
} from '@/lib/data/crud';
import type { SportType } from '@/lib/data/type';
import { Objective, Plan } from '@/lib/data/DatabaseTypes';
import { getWorkoutTSS } from '@/lib/stats/computeTSS';


// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanOverviewBlock {
    id: string;
    orderIndex: number;
    type: string;
    theme: string;
    weekCount: number;
    startDate: string;
    startCTL: number;
    targetCTL: number;
    avgWeeklyTSS: number;
    weeks: PlanOverviewWeek[];
    totalPlannedTSS: number;
    totalActualTSS: number;
    completedCount: number;
    totalCount: number;
    isCurrent: boolean;
    isPast: boolean;
}

export interface PlanOverviewWeek {
    id: string;
    weekNumber: number;
    type: 'Load' | 'Recovery' | 'Taper';
    targetTSS: number;
    actualTSS: number;
    startDate: string;
    completedCount: number;
    totalCount: number;
    workouts: {
        id: string;
        date: string;
        title: string;
        sportType: SportType;
        status: string;
        plannedTSS: number | null;
    }[];
}

export interface PlanOverviewData {
    plan: Plan;
    blocks: PlanOverviewBlock[];
    objectives: Objective[];
    totalCompletion: number;
    totalPlannedTSS: number;
    totalActualTSS: number;
    currentWeekIndex: number;
    totalWeeks: number;
}


// ─── Server Action ───────────────────────────────────────────────────────────

/**
 * Construit la vue agrégée du plan actif de l'utilisateur (bloc → semaine →
 * séance) avec les compteurs de complétion et de TSS planifié/réalisé.
 * Renvoie `null` si aucun plan actif ou aucun bloc trouvé.
 */
export async function getPlanOverview(): Promise<PlanOverviewData | null> {
    const [plans, blocks, weeks, workouts, objectives] = await Promise.all([
        getPlan(), getBlock(), getWeek(), getWorkout(), getObjectives(),
    ]);

    const activePlan = (plans ?? []).find(p => p.status === 'active');
    if (!activePlan) return null;

    const planBlocks = (blocks ?? [])
        .filter(b => b.planId === activePlan.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);

    if (planBlocks.length === 0) return null;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let currentWeekIndex = 0;
    let weekCounter = 0;

    const overviewBlocks: PlanOverviewBlock[] = planBlocks.map(block => {
        const blockWeeks = (weeks ?? [])
            .filter(w => block.weeksId.includes(w.id))
            .sort((a, b) => a.weekNumber - b.weekNumber);

        const blockStart = parseLocalDate(block.startDate);
        const blockEnd = addDays(blockStart, block.weekCount * 7 - 1);
        const isCurrent = todayStr >= block.startDate && todayStr <= format(blockEnd, 'yyyy-MM-dd');
        const isPast = todayStr > format(blockEnd, 'yyyy-MM-dd');

        let blockPlannedTSS = 0;
        let blockActualTSS = 0;
        let blockCompleted = 0;
        let blockTotal = 0;

        const ovWeeks: PlanOverviewWeek[] = blockWeeks.map((week, wi) => {
            const weekStart = addDays(blockStart, wi * 7);
            const weekWorkouts = (workouts ?? [])
                .filter(wo => week.workoutsId.includes(wo.id))
                .sort((a, b) => a.date.localeCompare(b.date));

            const completed = weekWorkouts.filter(w => w.status === 'completed').length;
            const total = weekWorkouts.length;
            const plannedTSS = weekWorkouts.reduce((s, w) => s + (w.plannedData?.plannedTSS ?? 0), 0);
            const actualTSS = weekWorkouts.reduce((s, w) => s + getWorkoutTSS(w), 0);

            blockPlannedTSS += plannedTSS || week.targetTSS;
            blockActualTSS += actualTSS;
            blockCompleted += completed;
            blockTotal += total;

            const weekStartStr = format(weekStart, 'yyyy-MM-dd');
            const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
            if (todayStr >= weekStartStr && todayStr <= weekEndStr) {
                currentWeekIndex = weekCounter;
            }
            weekCounter++;

            return {
                id: week.id,
                weekNumber: week.weekNumber,
                type: week.type,
                targetTSS: plannedTSS || week.targetTSS,
                actualTSS,
                startDate: weekStartStr,
                completedCount: completed,
                totalCount: total,
                workouts: weekWorkouts.map(w => ({
                    id: w.id,
                    date: w.date,
                    title: w.title,
                    sportType: w.sportType,
                    status: w.status,
                    plannedTSS: w.plannedData?.plannedTSS ?? null,
                })),
            };
        });

        return {
            id: block.id,
            orderIndex: block.orderIndex,
            type: block.type,
            theme: block.theme,
            weekCount: block.weekCount,
            startDate: block.startDate,
            startCTL: block.startCTL,
            targetCTL: block.targetCTL,
            avgWeeklyTSS: block.avgWeeklyTSS,
            weeks: ovWeeks,
            totalPlannedTSS: blockPlannedTSS,
            totalActualTSS: blockActualTSS,
            completedCount: blockCompleted,
            totalCount: blockTotal,
            isCurrent,
            isPast,
        };
    });

    const totalPlannedTSS = overviewBlocks.reduce((s, b) => s + b.totalPlannedTSS, 0);
    const totalActualTSS = overviewBlocks.reduce((s, b) => s + b.totalActualTSS, 0);
    const totalCompleted = overviewBlocks.reduce((s, b) => s + b.completedCount, 0);
    const totalCount = overviewBlocks.reduce((s, b) => s + b.totalCount, 0);

    const linkedObjectives = (objectives ?? [])
        .filter(o => activePlan.objectivesId?.includes(o.id) || o.status === 'upcoming')
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        plan: activePlan,
        blocks: overviewBlocks,
        objectives: linkedObjectives,
        totalCompletion: totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0,
        totalPlannedTSS,
        totalActualTSS,
        currentWeekIndex,
        totalWeeks: weekCounter,
    };
}
