/******************************************************************************
 * @file    constants.ts
 * @brief   Constantes globales pour la génération des plans d'entraînement.
 *          Basé sur les méthodologies de Friel, Coggan/Allen, Issurin, Seiler.
 ******************************************************************************/


// ---- CTL Progression -------------------------------------------------------

/**
 * Progression de la CTL (Chronic Training Load) en points par bloc (4 semaines).
 * Valeurs calibrées selon la science du coaching (Friel: 3-7 CTL/sem recommandé).
 *
 * Base  : Consolidation aérobie, progression modérée (~2 CTL/sem)
 * Build : Bloc de charge principal, progression soutenue (~3-4 CTL/sem)
 * Peak  : Intensité maximale, volume réduit, CTL se maintient (~1.5 CTL/sem)
 * Taper : Géré dynamiquement (% de CTL), pas en constante fixe
 */
export const CTL_PROGRESSION: Record<string, number> = {
    Base:   8,
    Build:  14,
    Peak:   6,
    Taper:  0,  // Placeholder — le Taper est calculé dynamiquement
};

/**
 * Multiplicateurs de progression CTL par niveau d'athlète.
 * Permet d'ajuster le ramp rate selon la capacité de récupération.
 * Sources : Coggan/Allen, TrainingPeaks ramp rate guidelines.
 *
 * Débutant : ramp conservateur (risque de blessure élevé)
 * Intermédiaire : ramp standard
 * Avancé : peut supporter un ramp plus agressif
 */
export const CTL_LEVEL_MULTIPLIER: Record<string, number> = {
    'Débutant':      0.7,
    'Intermédiaire': 1.0,
    'Avancé':        1.2,
};

/**
 * Pourcentage de drop CTL pour le Taper (affûtage pré-course).
 * La science recommande 5-10% de drop (Mujika & Padilla, 2003).
 * On utilise 8% comme valeur médiane.
 */
export const TAPER_CTL_DROP_PERCENT = 0.08;


// ---- Semaine de récupération -----------------------------------------------

/**
 * Nombre de semaines minimum dans un bloc pour déclencher
 * une semaine de récupération automatique en fin de bloc.
 * Ex : 4 semaines → 3 Load + 1 Recovery
 */
export const RECOVERY_WEEK_THRESHOLD = 3;

/**
 * Ratio appliqué au TSS de la semaine de POINTE du bloc pour calculer
 * le TSS de la semaine de récupération.
 * Consensus coaching : 40-60% de réduction (Friel, CTS, TrainerRoad).
 * On applique 50% du TSS de départ du bloc → vraie récupération.
 */
export const RECOVERY_TSS_RATIO = 0.5;


// ---- Effets résiduels (Issurin, 2008) --------------------------------------

/**
 * Durée en jours pendant laquelle les adaptations d'un type d'entraînement
 * persistent après l'arrêt du stimulus. Utilisé pour déterminer si un athlète
 * a encore les bénéfices d'un bloc passé ou s'il faut le retravailler.
 */
export const RESIDUAL_EFFECTS_DAYS: Record<string, number> = {
    'Endurance':  30,  // Base aérobie : 25-35 jours
    'Tempo':      20,  // Seuil anaérobie : 15-25 jours
    'Interval':   15,  // VO2max / PMA : 12-18 jours
    'Sprint':     8,   // Anaérobie / neuromusculaire : 5-12 jours
    'Strength':   20,  // Force : 15-25 jours
};
