/******************************************************************************
 * @file    week-actions.ts
 * @brief   Server Actions centrées sur une semaine du plan :
 *          - lecture du contexte (bloc parent + type semaine + TSS cible)
 *          - comptage des pending (pour confirmation avant régénération)
 *          - (re)génération IA des séances d'une semaine précise
 *
 *          Se base sur le helper `findBlockAndWeekForDate` pour retrouver
 *          la paire (bloc, semaine) à partir d'une date quelconque.
 ******************************************************************************/

'use server';

import { addDays, format } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { parseLocalDate } from '@/lib/utils';
import {
    getBlock,
    getObjectives,
    getPlan,
    getProfile,
    getWeek,
    getWorkout,
    saveWeek,
    saveWorkout,
} from '@/lib/data/crud';
import type { AvailabilitySlot } from '@/lib/data/type';
import { findBlockAndWeekForDate } from './_internals/week-finder';
import { computeAvgCompletion } from './_internals/ai-context';
import { CreateWorkoutForWeek } from './_internals/workout-generator';


// ─── Types ───────────────────────────────────────────────────────────────────

export type WeekContext = {
    blockTheme: string;
    blockType: string;
    weekType: 'Load' | 'Recovery' | 'Taper';
    targetTSS: number;
    weekNumber: number;
    blockWeekCount: number;
} | null;


// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Retourne le contexte (bloc + semaine) pour une date de début de semaine.
 * Utilisé par le calendrier pour afficher le thème courant au-dessus de la grille.
 */
export async function getWeekContextForDate(weekStartDate: string): Promise<WeekContext> {
    const [blocks, weeks] = await Promise.all([getBlock(), getWeek()]);
    if (!blocks || !weeks) return null;

    const result = findBlockAndWeekForDate(blocks, weeks, parseLocalDate(weekStartDate));
    if (!result) return null;

    return {
        blockTheme: result.block.theme,
        blockType: result.block.type,
        weekType: result.week.type,
        targetTSS: result.week.targetTSS,
        weekNumber: result.week.weekNumber,
        blockWeekCount: result.block.weekCount,
    };
}


/**
 * Retourne le nombre de séances en statut 'pending' pour la semaine donnée.
 * Utilisé côté client pour demander confirmation avant d'écraser.
 */
export async function getWeekPendingCount(weekStartDate: string): Promise<number> {
    const [blocks, weeks, workouts] = await Promise.all([getBlock(), getWeek(), getWorkout()]);
    if (!blocks || !weeks || !workouts) return 0;

    const result = findBlockAndWeekForDate(blocks, weeks, parseLocalDate(weekStartDate));
    if (!result) return 0;

    return workouts.filter(w => w.weekId === result.week.id && w.status === 'pending').length;
}


/**
 * Génère les séances IA pour la semaine contenant weekStartDate,
 * en remplaçant les séances pending existantes de cette semaine.
 *
 * Les séances complétées de la semaine sont préservées (on ne touche pas
 * à ce que l'athlète a réellement fait).
 */
export async function generateWeekWorkoutsFromDate(
    weekStartDate: string,
    comment: string | null,
    weeklyAvailability: { [key: string]: AvailabilitySlot }
): Promise<void> {
    const [profile, blocks, weeks, existingWorkouts, plans] = await Promise.all([
        getProfile(),
        getBlock(),
        getWeek(),
        getWorkout(),
        getPlan(),
    ]);

    if (!blocks || !weeks) throw new Error("Aucun plan trouvé.");

    const result = findBlockAndWeekForDate(blocks, weeks, parseLocalDate(weekStartDate));
    if (!result) throw new Error("Aucun bloc actif pour cette semaine.");

    const { block, week } = result;
    const plan = plans?.find(p => p.id === block.planId);
    if (!plan) throw new Error("Plan introuvable.");

    // Trouver les objectifs pertinents (cette semaine + semaine suivante)
    const objectives = await getObjectives();
    const weekStart = parseLocalDate(weekStartDate);
    const weekEndPlusOne = addDays(weekStart, 13);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const weekObjectives = objectives.filter(o =>
        o.status === 'upcoming' && o.date >= todayStr
        && parseLocalDate(o.date) >= weekStart && parseLocalDate(o.date) <= weekEndPlusOne
    );

    const realCompletion3 = computeAvgCompletion(existingWorkouts ?? [], weeks, week.id);
    const newWorkouts = await CreateWorkoutForWeek(
        profile,
        plan,
        block,
        week,
        comment,
        realCompletion3,
        weeklyAvailability,
        weekObjectives,
    );

    if (!newWorkouts || newWorkouts.length === 0) {
        throw new Error("L'IA n'a retourné aucune séance. Les séances existantes sont conservées.");
    }

    // On n'écrase QUE les séances non-complétées (pending + missed) de la semaine
    // pour éviter la pollution de régénérations successives. Les séances complétées
    // (réellement faites par l'athlète) sont préservées.
    const keptWorkouts = (existingWorkouts ?? []).filter(
        w => !(w.weekId === week.id && w.status !== 'completed')
    );
    const keptWeekWorkoutIds = keptWorkouts
        .filter(w => w.weekId === week.id)
        .map(w => w.id);

    // Mettre à jour workoutsId de la semaine (conserver les IDs complétés + ajouter les nouveaux)
    const updatedWeeks = weeks.map(w =>
        w.id === week.id
            ? { ...w, workoutsId: [...keptWeekWorkoutIds, ...newWorkouts.map(wo => wo.id)] }
            : w
    );

    await Promise.all([
        saveWorkout([...keptWorkouts, ...newWorkouts]),
        saveWeek(updatedWeeks),
    ]);

    revalidatePath('/');
}
