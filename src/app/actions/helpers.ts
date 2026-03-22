/******************************************************************************
 * @file    helpers.ts
 * @brief   Fonctions utilitaires pures pour la génération des plans
 *          d'entraînement. Aucune I/O, aucun effet de bord.
 ******************************************************************************/

import { AvailabilitySlot } from "@/lib/data/type";
import { RECOVERY_TSS_RATIO, RECOVERY_WEEK_THRESHOLD } from "./constants";
import { Profile } from "@/lib/data/DatabaseTypes";


// ---- TSS / CTL -------------------------------------------------------------

/**
 * Calcule le TSS hebdomadaire estimé depuis une valeur de CTL.
 * CTL représente la moyenne lissée du TSS journalier sur 42 jours,
 * donc TSS hebdo ≈ CTL × 7.
 *
 * @param ctl - Chronic Training Load de référence
 * @returns   TSS hebdomadaire estimé
 */
export const computeWeeklyTSS = (ctl: number): number => ctl * 7;


// ---- Découpage en blocs ----------------------------------------------------

/**
 * Découpe un plan en squelettes de blocs de méso-cycles.
 * Règles :
 * - Blocs standards de 4 semaines
 * - Si ≤ 5 semaines restantes → dernier bloc absorbe le reliquat
 * - Le dernier bloc est marqué isLast = true (sauf si plan = 1 seul bloc)
 *
 * @param totalWeeks - Nombre total de semaines du plan
 * @returns Tableau de squelettes ordonnés
 */
export const computeBlockSkeletons = (
    totalWeeks: number
): { index: number; duration: number; isLast: boolean }[] => {

    const skeletons: { index: number; duration: number; isLast: boolean }[] = [];
    let weeksRemaining = totalWeeks;
    let index = 1;

    while (weeksRemaining > 0) {
        if (weeksRemaining <= 5) {
            skeletons.push({ index, duration: weeksRemaining, isLast: index > 1 });
            break;
        }
        skeletons.push({ index, duration: 4, isLast: false });
        weeksRemaining -= 4;
        index++;
    }

    return skeletons;
};


// ---- Progression TSS -------------------------------------------------------

/**
 * Calcule le TSS cible d'une semaine de charge selon sa position
 * dans le bloc (progression linéaire entre startTSS et targetTSS).
 *
 * @param weekNumber       - Numéro de la semaine (1-based)
 * @param startWeeklyTSS   - TSS hebdo en début de bloc
 * @param progressionPerWeek - Incrément de TSS par semaine
 * @returns TSS cible arrondi
 */
export const computeLoadWeekTSS = (
    weekNumber: number,
    startWeeklyTSS: number,
    progressionPerWeek: number
): number => Math.round(startWeeklyTSS + progressionPerWeek * (weekNumber - 1));

/**
 * Calcule le TSS cible d'une semaine de récupération.
 * Applique RECOVERY_TSS_RATIO sur le TSS de départ du bloc.
 *
 * @param startWeeklyTSS - TSS hebdo en début de bloc
 * @returns TSS de récupération arrondi
 */
export const computeRecoveryWeekTSS = (
    startWeeklyTSS: number
): number => Math.round(startWeeklyTSS * RECOVERY_TSS_RATIO);

/**
 * Calcule l'incrément de TSS par semaine de charge dans un bloc.
 *
 * @param startWeeklyTSS  - TSS hebdo en début de bloc
 * @param targetWeeklyTSS - TSS hebdo visé en fin de bloc
 * @param weekCount       - Nombre total de semaines du bloc
 * @returns Progression par semaine (0 si une seule semaine de charge)
 */
export const computeProgressionPerWeek = (
    startWeeklyTSS: number,
    targetWeeklyTSS: number,
    weekCount: number
): number => {
    const loadWeeksCount = weekCount > RECOVERY_WEEK_THRESHOLD
        ? weekCount - 1
        : weekCount;

    return loadWeeksCount > 1
        ? (targetWeeklyTSS - startWeeklyTSS) / (loadWeeksCount - 1)
        : 0;
};

export const getActiveSports = (activeSports: Profile['activeSports']): string[] => {
    return Object.entries(activeSports)
        .filter(([_, isActive]) => isActive)
        .map(([sport]) => sport);
};

export const formatAvailability = (availability: { [key: string]: AvailabilitySlot }): string => {
    const days: Record<string, string> = {
        monday: "Lundi", tuesday: "Mardi", wednesday: "Mercredi",
        thursday: "Jeudi", friday: "Vendredi", saturday: "Samedi", sunday: "Dimanche",
    };

    return Object.entries(availability)
        .map(([day, slot]) => {
            const sports = [
                slot.swimming > 0 ? `natation ${slot.swimming}h` : null,
                slot.cycling   > 0 ? `vélo ${slot.cycling}h`     : null,
                slot.running   > 0 ? `course ${slot.running}h`   : null,
            ].filter(Boolean).join(", ");

            if (!sports) return null;

            return `- ${days[day] ?? day} : ${sports}${slot.comment ? ` (${slot.comment})` : ""}`;
        })
        .filter(Boolean)
        .join("\n");
};