/******************************************************************************
 * @file    _internals/plan-archive.ts
 * @brief   Prépare la transition d'un plan actif vers un nouveau plan.
 *
 *          Lorsqu'on crée un nouveau plan (CreateAdvancedPlan ou
 *          CreatePlanToObjective), le plan actif courant doit basculer en
 *          status='archived'. On garde au maximum `cap` plans archivés (les
 *          plus récents par startDate) — au-delà, ils sont exclus des listes
 *          retournées : le cleanup orphelin (notInArray) de savePlan les
 *          supprimera en cascade (FK onDelete cascade sur blocks/weeks/
 *          workouts).
 *
 *          Pour les workouts des plans archivés conservés : on garde toutes
 *          les séances `completed` (utiles au calcul CTL) mais on filtre les
 *          `pending`/`missed` à date >= newPlanStartDate — saveWorkout les
 *          supprimera via son cleanup natif (notInArray + date >= startDate).
 *
 * @access  Module privé — ne pas importer depuis un composant client.
 ******************************************************************************/

import { Block, Plan, Week, Workout } from '@/lib/data/DatabaseTypes';


export interface PreparedArchive {
    plansToKeep:    Plan[];
    blocksToKeep:   Block[];
    weeksToKeep:    Week[];
    workoutsToKeep: Workout[];
}


/**
 * Marque les plans actifs existants comme archivés, applique le cap de
 * rétention et filtre les listes dépendantes pour qu'un appel ultérieur à
 * savePlan/saveBlocks/saveWeek/saveWorkout supprime proprement les orphelins.
 *
 * Le caller ajoute ensuite le nouveau plan (status='active') à `plansToKeep`
 * et ses dépendances aux autres listes avant les save*.
 *
 * @param existingPlans     Plans actuels en base.
 * @param existingBlocks    Blocs actuels en base.
 * @param existingWeeks     Semaines actuelles en base.
 * @param existingWorkouts  Workouts actuels en base.
 * @param newPlanStartDate  Date de début du nouveau plan (YYYY-MM-DD).
 * @param cap               Nombre max de plans archivés conservés.
 */
export function prepareArchive(
    existingPlans:    Plan[],
    existingBlocks:   Block[],
    existingWeeks:    Week[],
    existingWorkouts: Workout[],
    newPlanStartDate: string,
    cap = 5,
): PreparedArchive {
    if (existingPlans.length === 0) {
        return { plansToKeep: [], blocksToKeep: [], weeksToKeep: [], workoutsToKeep: [] };
    }

    // 1. Basculer les plans actifs en archived. À ce stade, tous les plans
    //    en entrée sont des candidats à l'archivage (le nouveau plan n'est
    //    pas encore dans la liste).
    const archived: Plan[] = existingPlans.map(p =>
        p.status === 'active' ? { ...p, status: 'archived' as const } : p
    );

    // 2. Cap : on garde les `cap` plus récents par startDate desc.
    const sorted = [...archived].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const plansToKeep = sorted.slice(0, cap);
    const keepIds = new Set(plansToKeep.map(p => p.id));

    // 3. Filtrer les dépendances des plans gardés.
    const blocksToKeep = existingBlocks.filter(b => keepIds.has(b.planId));
    const blockIds = new Set(blocksToKeep.map(b => b.id));

    const weeksToKeep = existingWeeks.filter(w => blockIds.has(w.blockId));
    const weekIds = new Set(weeksToKeep.map(w => w.id));

    // 4. Workouts :
    //    - completed : toujours conservés (essentiels au calcul CTL).
    //    - manuels / orphelins (weekId vide) : conservés (données utilisateur).
    //    - liés à un plan gardé : conservés si date < newPlanStartDate
    //      (les pending/missed à partir du nouveau plan seront écrasés par
    //      les nouvelles séances via le cleanup natif de saveWorkout).
    //    - liés à un plan purgé : exclus.
    const workoutsToKeep = existingWorkouts.filter(w => {
        if (w.status === 'completed') return true;
        if (!w.weekId) return true;
        if (!weekIds.has(w.weekId)) return false;
        return w.date < newPlanStartDate;
    });

    return { plansToKeep, blocksToKeep, weeksToKeep, workoutsToKeep };
}
