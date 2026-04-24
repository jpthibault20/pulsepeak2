/******************************************************************************
 * @file    fitness-metrics.ts
 * @brief   Recalcul des métriques de forme (CTL / ATL) à partir de l'historique
 *          complet des séances complétées.
 *
 *          CTL (Chronic Training Load, 42j) et ATL (Acute Training Load, 7j)
 *          sont calculées comme des moyennes mobiles exponentielles du TSS
 *          journalier. Appelé à chaque modification de statut d'une séance
 *          ou au chargement de la page principale pour garantir que
 *          `profiles.currentCTL` et `profiles.currentATL` reflètent l'état
 *          réel de l'athlète.
 ******************************************************************************/

'use server';

import { addDays, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { getProfile, getWorkout, saveProfile } from '@/lib/data/crud';
import { extractTSS } from './_internals/fitness-tss';


/**
 * Recalcule currentCTL et currentATL à partir de l'historique complet
 * des workouts complétés, puis met à jour le profil.
 *
 * CTL (42j) et ATL (7j) sont des EMA de TSS journalier :
 *   CTL_j = CTL_{j-1} × e^(-1/42) + TSS_j × (1 − e^(-1/42))
 *   ATL_j = ATL_{j-1} × e^(-1/7)  + TSS_j × (1 − e^(-1/7))
 */
export async function recalculateFitnessMetrics(): Promise<void> {
    const [profile, workoutList] = await Promise.all([getProfile(), getWorkout()]);

    const completed = (workoutList ?? [])
        .filter(w => w.status === 'completed' && w.completedData)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (completed.length === 0) {
        await saveProfile({ ...profile, currentCTL: 0, currentATL: 0 });
        return;
    }

    // TSS cumulé par date (plusieurs workouts le même jour)
    const tssByDate = new Map<string, number>();
    for (const w of completed) {
        const tss = extractTSS(w, profile);
        if (tss > 0) tssByDate.set(w.date, (tssByDate.get(w.date) ?? 0) + tss);
    }

    const CTL_DECAY = Math.exp(-1 / 42);
    const ATL_DECAY = Math.exp(-1 / 7);
    const CTL_GAIN  = 1 - CTL_DECAY;
    const ATL_GAIN  = 1 - ATL_DECAY;

    // Constante CTL = 42j → après 200j, l'influence d'un workout est < 0.8%.
    // On peut donc démarrer au max(premier_workout, aujourd'hui - 200j)
    // en utilisant les valeurs stockées comme seed (leur erreur se dissipe en ~200j).
    const today   = format(new Date(), 'yyyy-MM-dd');
    const cutoff  = format(addDays(parseLocalDate(today), -200), 'yyyy-MM-dd');
    const startDate = completed[0].date > cutoff ? completed[0].date : cutoff;

    let ctl = startDate === completed[0].date ? 0 : (profile.currentCTL ?? 0);
    let atl = startDate === completed[0].date ? 0 : (profile.currentATL ?? 0);

    let   current = parseLocalDate(startDate);
    const end     = parseLocalDate(today);

    while (current <= end) {
        const dateStr = format(current, 'yyyy-MM-dd');
        const tss     = tssByDate.get(dateStr) ?? 0;
        ctl = ctl * CTL_DECAY + tss * CTL_GAIN;
        atl = atl * ATL_DECAY + tss * ATL_GAIN;
        current = addDays(current, 1);
    }

    await saveProfile({
        ...profile,
        currentCTL: Math.round(ctl * 10) / 10,
        currentATL: Math.round(atl * 10) / 10,
    });
}
