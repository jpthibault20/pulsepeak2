/******************************************************************************
 * @file    constants.ts
 * @brief   Constantes globales pour la génération des plans d'entraînement.
 *          Regroupe les progressions CTL par type de bloc, les seuils de
 *          récupération et les ratios de charge.
 ******************************************************************************/


// ---- CTL Progression -------------------------------------------------------

/**
 * Progression de la CTL (Chronic Training Load) en points par bloc.
 * Utilisé dans CreateBlocks pour calculer startCTL / targetCTL.
 *
 * Base  : Consolidation aérobie, progression modérée
 * Build : Bloc de charge principal, forte progression
 * Peak  : Intensité maximale, volume stable
 * Taper : Décharge pré-compétition, CTL en baisse
 */
export const CTL_PROGRESSION: Record<string, number> = {
    Base:   5,
    Build:  10,
    Peak:   5,
    Taper: -15,
};


// ---- Semaine de récupération -----------------------------------------------

/**
 * Nombre de semaines minimum dans un bloc pour déclencher
 * une semaine de récupération automatique en fin de bloc.
 * Ex : 4 semaines → 3 Load + 1 Recovery
 */
export const RECOVERY_WEEK_THRESHOLD = 3;

/**
 * Ratio appliqué au TSS de départ du bloc pour calculer
 * le TSS de la semaine de récupération.
 * Ex : startWeeklyTSS * 0.9 → décharge de 10%
 */
export const RECOVERY_TSS_RATIO = 0.9;