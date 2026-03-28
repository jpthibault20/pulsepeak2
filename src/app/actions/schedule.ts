'use server';

import { generatePlanFromAI, generateSingleWorkoutFromAI } from '@/lib/ai/coach-api';
import { formatDateKey } from '@/lib/utils';
import { getBlock, getObjectives, getPlan, getProfile, getSchedule, getWeek, getWorkout, saveBlocks, savePlan, saveProfile, saveSchedule, saveWeek, saveWorkout } from '@/lib/data/crud';
import { ReturnCode } from '@/lib/data/type';
import { revalidatePath } from 'next/cache';
import type { AvailabilitySlot, CompletedData, CompletedDataFeedback, SportType } from '@/lib/data/type';
import { getStravaActivities, getStravaActivitiesAllPages, getStravaActivityById } from '@/lib/strava-service';
import { mapStravaToCompletedData } from '@/lib/strava-mapper';
import { Block, Objective, Plan, Profile, Schedule, Week, Workout } from '@/lib/data/DatabaseTypes';
import { randomUUID } from 'crypto';
import {
    differenceInWeeks,
    addWeeks,
    addDays,
    startOfISOWeek,
    endOfISOWeek,
    format,
    parseISO,
} from 'date-fns';
import { callGeminiAPI } from '@/lib/ai/coach-api';
import { CTL_PROGRESSION, RECOVERY_WEEK_THRESHOLD, RECOVERY_TSS_RATIO } from './constants';
import { computeBlockSkeletons, computeWeeklyTSS, formatAvailability, getActiveSports } from './helpers';



/******************************************************************************
 * @access Public
 * @function CreateAdvancedPlan
 * @brief Crée un plan d'entraînement complet avec blocs et semaines générés
 *        par IA, basé sur la CTL actuelle de l'athlète.
 * @input
 * - blockFocus     : Nom / focus du bloc d'entraînement
 * - customTheme    : Thème personnalisé (optionnel, remplace blockFocus si fourni)
 * - startDate      : Date de début du plan (format YYYY-MM-DD)
 * - numWeeks       : Nombre de semaines du plan (> 0)
 * - userID         : Identifiant de l'utilisateur (min. 3 caractères)
 * @output
 * - { state: RC_OK }                        en cas de succès
 * - { state: RC_Error, error: string }      en cas d'erreur de validation
 ******************************************************************************/
export async function CreateAdvancedPlan(
    blockFocus: string,
    customTheme: string | null,
    startDate: string,
    numWeeks: number,
    userID: string
) {
    // Validation
    if (numWeeks <= 0)      return { state: ReturnCode.RC_Error, error: "Nombre de semaines invalide" };
    if (userID.length < 3)  return { state: ReturnCode.RC_Error, error: "ID utilisateur invalide" }; // ✅ corrigé

    const [plan, profile, existingBlocks, existingWeeks, existingWorkouts] = await Promise.all([
        getPlan(),
        getProfile(),
        getBlock(),
        getWeek(),
        getWorkout(),
    ]);

    // Création du plan
    const newPlan = CreatePlan(blockFocus, customTheme, startDate, numWeeks, userID);

    // Création des blocs
    const newBlocks = await CreateBlocks(newPlan, profile);
    newPlan.blocksID = newBlocks.map(b => b.id);

    // Création des semaines + injection des IDs dans les blocs
    const newWeeks: Week[] = [];
    const updatedBlocks = await Promise.all(
        newBlocks.map(async (block) => {
            const weeks = await CreateWeeks(newPlan, block, profile);
            newWeeks.push(...weeks);
            return { ...block, weeksId: weeks.map(w => w.id) };
        })
    );

    // On génère les séances uniquement pour la première semaine.
    // Les semaines suivantes seront générées le dimanche précédant chaque semaine.
    const firstWeek = newWeeks[0];
    const firstBlock = updatedBlocks.find(b => b.id === firstWeek.blockID) ?? updatedBlocks[0];
    const firstWeekWorkouts = await CreateWorkoutForWeek(profile, newPlan, firstBlock, firstWeek, null, 100, profile.weeklyAvailability);

    const newWorkouts: Workout[] = [...firstWeekWorkouts];
    const updatedWeeks = newWeeks.map((week) =>
        week.id === firstWeek.id
            ? { ...week, workoutsID: firstWeekWorkouts.map(w => w.id) }
            : week
    );

    // Sauvegarde : respecter l'ordre des FK (plan → blocks → weeks → workouts)
    try {
        await savePlan([...(Array.isArray(plan) ? plan : []), newPlan]);
        await saveBlocks([...(Array.isArray(existingBlocks) ? existingBlocks : []), ...updatedBlocks]);
        await saveWeek([...(Array.isArray(existingWeeks) ? existingWeeks : []), ...updatedWeeks]);
        await saveWorkout([...(Array.isArray(existingWorkouts) ? existingWorkouts : []), ...newWorkouts]);
    } catch (err) {
        console.error('[CreateAdvancedPlan] Erreur lors de la sauvegarde:', err);
        return { state: ReturnCode.RC_Error, error: 'Erreur lors de la sauvegarde du plan.' };
    }

    return { state: ReturnCode.RC_OK };
}

/******************************************************************************
 * @access Public
 * @function CreatePlanToObjective
 * @brief Génère un plan complet depuis aujourd'hui jusqu'au premier objectif
 *        principal à venir. Remplace intégralement le plan actif existant.
 *        Les objectifs secondaires génèrent une semaine de taper autour d'eux.
 * @input
 * - userID : Identifiant de l'utilisateur
 * @output
 * - { state: RC_OK }               en cas de succès
 * - { state: RC_Error, error }     en cas d'erreur
 ******************************************************************************/
export async function CreatePlanToObjective(userID: string, planStartDate: string) {
    if (userID.length < 3) return { state: ReturnCode.RC_Error, error: 'ID utilisateur invalide' };

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const [profile, objectives] = await Promise.all([
        getProfile(),
        getObjectives(),
    ]);

    // Premier objectif principal à venir
    const primaryObjective = objectives
        .filter(o => o.priority === 'principale' && o.status === 'upcoming' && o.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (!primaryObjective) {
        return { state: ReturnCode.RC_Error, error: "Aucun objectif principal à venir. Ajoutez-en un dans votre profil." };
    }

    const startDate = planStartDate >= todayStr ? planStartDate : todayStr;

    const totalWeeks = differenceInWeeks(parseISO(primaryObjective.date), parseISO(startDate));
    if (totalWeeks < 1) {
        return { state: ReturnCode.RC_Error, error: "L'objectif est trop proche (moins d'une semaine)." };
    }

    // Objectifs secondaires compris dans la plage du plan
    const secondaryObjectives = objectives.filter(
        o => o.priority === 'secondaire' && o.status === 'upcoming' && o.date >= startDate && o.date <= primaryObjective.date
    );

    // Créer le plan
    const allObjectiveIds = [primaryObjective, ...secondaryObjectives].map(o => o.id);
    const newPlan: Plan = {
        id: randomUUID(),
        userID,
        blocksID: [],
        objectivesID: allObjectiveIds,
        name: primaryObjective.name,
        startDate,
        goalDate: primaryObjective.date,
        macroStrategyDescription: [
            `Préparation pour ${primaryObjective.name}`,
            primaryObjective.sport,
            primaryObjective.distanceKm ? `${primaryObjective.distanceKm} km` : '',
            primaryObjective.elevationGainM ? `${primaryObjective.elevationGainM} m D+` : '',
        ].filter(Boolean).join(' · '),
        status: 'active',
    };

    // Créer les blocs (IA, avec contexte objectifs secondaires)
    const newBlocks = await CreateBlocksToObjective(newPlan, profile, primaryObjective, secondaryObjectives);
    newPlan.blocksID = newBlocks.map(b => b.id);

    // Créer les semaines
    const newWeeks: Week[] = [];
    const updatedBlocks = await Promise.all(
        newBlocks.map(async (block) => {
            const weeks = await CreateWeeks(newPlan, block, profile);
            newWeeks.push(...weeks);
            return { ...block, weeksId: weeks.map(w => w.id) };
        })
    );

    // Appliquer mini-taper sur les semaines des objectifs secondaires
    const finalWeeks = applySecondaryObjectiveTaper(newWeeks, updatedBlocks, secondaryObjectives);

    // Générer séances pour la première semaine uniquement
    const firstWeek = finalWeeks[0];
    const firstBlock = updatedBlocks.find(b => b.id === firstWeek.blockID) ?? updatedBlocks[0];
    const firstWeekWorkouts = await CreateWorkoutForWeek(profile, newPlan, firstBlock, firstWeek, null, 100, profile.weeklyAvailability);

    const newWorkouts: Workout[] = [...firstWeekWorkouts];
    const weeksWithWorkouts = finalWeeks.map(w =>
        w.id === firstWeek.id ? { ...w, workoutsID: firstWeekWorkouts.map(wk => wk.id) } : w
    );

    // Sauvegarde — remplace tout (aucun plan/bloc/semaine existant conservé)
    try {
        await savePlan([newPlan]);
        await saveBlocks([...updatedBlocks]);
        await saveWeek([...weeksWithWorkouts]);
        await saveWorkout([...newWorkouts]);
    } catch (err) {
        console.error('[CreatePlanToObjective] Erreur sauvegarde:', err);
        return { state: ReturnCode.RC_Error, error: 'Erreur lors de la sauvegarde du plan.' };
    }

    revalidatePath('/');
    return { state: ReturnCode.RC_OK };
}

/******************************************************************************
 * @access Private
 * @function CreateBlocksToObjective
 * @brief Variante de CreateBlocks enrichie du contexte objectif principal
 *        et des objectifs secondaires pour que l'IA structure le plan
 *        en conséquence.
 ******************************************************************************/
async function CreateBlocksToObjective(
    plan: Plan,
    profile: Profile,
    primaryObj: Objective,
    secondaryObjs: Objective[]
): Promise<Block[]> {
    const start = startOfISOWeek(parseISO(plan.startDate));
    const goal  = endOfISOWeek(parseISO(plan.goalDate));
    const totalWeeks = differenceInWeeks(goal, start) + 1;

    if (totalWeeks < 1) throw new Error('Le plan est trop court !');

    const blockSkeletons = computeBlockSkeletons(totalWeeks);

    const secondaryContext = secondaryObjs.length > 0
        ? `\n## OBJECTIFS SECONDAIRES (courses intermédiaires)\n` +
          secondaryObjs.map(o => `- ${o.name} le ${o.date} (${o.sport}${o.distanceKm ? ', ' + o.distanceKm + ' km' : ''})`).join('\n') +
          `\n→ Prévoir une semaine de relâche (Taper) autour de chaque objectif secondaire.`
        : '';

    const aiPrompt = `
Tu es un coach de ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''} certifié avec 15 ans d'expérience.

## OBJECTIF PRINCIPAL
- Course : ${primaryObj.name}
- Date : ${primaryObj.date}
- Sport : ${primaryObj.sport}
${primaryObj.distanceKm ? `- Distance : ${primaryObj.distanceKm} km` : ''}
${primaryObj.elevationGainM ? `- Dénivelé : ${primaryObj.elevationGainM} m D+` : ''}
${secondaryContext}

## CONTEXTE ATHLÈTE
- Niveau : ${profile.experience ?? 'Intermédiaire'}
- CTL actuelle : ${profile.currentCTL}
- Disciplines : ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''}

## STRUCTURE TEMPORELLE
${blockSkeletons.length} blocs de méso-cycles :
${blockSkeletons.map(b => `- Bloc ${b.index} : ${b.duration} semaines${b.isLast ? ' (DERNIER → semaine de course incluse)' : ''}`).join('\n')}

## RÈGLES OBLIGATOIRES
1. Le dernier bloc DOIT être de type "Taper" (affûtage pré-course).
2. Structurer les blocs pour progresser logiquement vers l'objectif principal.
3. Prendre en compte les objectifs secondaires pour la périodisation.
4. Thèmes spécifiques à la discipline et à l'objectif (ex: "Endurance longue distance", "PMA triathlon").

Retourner un tableau JSON. Chaque objet contient exactement :
- "index" (number) : numéro du bloc
- "type" (string) : l'un de ["Base", "Build", "Peak", "Taper"]
- "theme" (string) : objectif principal en 3 à 6 mots

## RÉPONSE (JSON uniquement) :
`;

    const aiResponse = await callGeminiAPI({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    }) as { index: number; type: string; theme: string }[];

    let currentStartDate = start;
    let previousTargetCTL = profile.currentCTL;

    return blockSkeletons.map((skeleton) => {
        const aiInfo = aiResponse.find(b => b.index === skeleton.index);
        const progression = CTL_PROGRESSION[aiInfo?.type ?? 'Base'] ?? 5;

        const startCTL     = previousTargetCTL;
        const targetCTL    = startCTL + progression;
        const avgWeeklyTSS = Math.round(((startCTL + targetCTL) / 2) * 7);

        const block: Block = {
            id: randomUUID(),
            planId: plan.id,
            userId: plan.userID,
            orderIndex: skeleton.index,
            type:  aiInfo?.type  ?? 'General',
            theme: aiInfo?.theme ?? 'Préparation',
            weekCount: skeleton.duration,
            startDate: format(currentStartDate, 'yyyy-MM-dd'),
            weeksId: [],
            startCTL,
            targetCTL,
            avgWeeklyTSS,
        };

        previousTargetCTL = targetCTL;
        currentStartDate  = addWeeks(currentStartDate, skeleton.duration);
        return block;
    });
}

/******************************************************************************
 * @access Private
 * @function applySecondaryObjectiveTaper
 * @brief Pour chaque objectif secondaire, trouve la semaine correspondante
 *        et la transforme en semaine Taper (TSS réduit de 30%).
 ******************************************************************************/
function applySecondaryObjectiveTaper(
    weeks: Week[],
    blocks: Block[],
    secondaryObjectives: Objective[]
): Week[] {
    if (secondaryObjectives.length === 0) return weeks;

    const blockMap = new Map(blocks.map(b => [b.id, b]));

    return weeks.map(week => {
        const block = blockMap.get(week.blockID);
        if (!block) return week;

        const weekStart = addDays(parseISO(block.startDate), (week.weekNumber - 1) * 7);
        const weekEnd   = addDays(weekStart, 6);
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');

        const hasSec = secondaryObjectives.some(o => o.date >= weekStartStr && o.date <= weekEndStr);
        if (!hasSec) return week;

        return {
            ...week,
            type: 'Taper' as const,
            targetTSS: Math.round(week.targetTSS * 0.7),
        };
    });
}


/******************************************************************************
 * @access Private
 * @function CreatePlan
 * @brief Instancie un objet Plan à partir des paramètres utilisateur.
 *        Calcule automatiquement la date de fin depuis startDate + numWeeks.
 * @input
 * - blockFocus  : Nom du plan / focus d'entraînement
 * - customTheme : Thème personnalisé (optionnel, fallback sur blockFocus)
 * - startDate   : Date de début (format YYYY-MM-DD)
 * - numWeeks    : Nombre de semaines du plan
 * - userID      : Identifiant de l'utilisateur
 * @output
 * - Plan : objet plan prêt à être sauvegardé (blocksID vide)
 ******************************************************************************/
function CreatePlan(
    blockFocus: string,
    customTheme: string | null,
    startDate: string,
    numWeeks: number,
    userID: string
): Plan {
    const goalDate = new Date(startDate);
    goalDate.setDate(goalDate.getDate() + numWeeks * 7);

    return {
        id: randomUUID(),
        userID,
        blocksID: [],
        name: blockFocus,
        startDate,
        objectivesID: [],
        goalDate: goalDate.toISOString().split('T')[0],
        macroStrategyDescription: customTheme ?? blockFocus,
        status: "active",
    };
}

/******************************************************************************
 * @access Private
 * @function CreateBlocks
 * @brief Génère les blocs de méso-cycles d'un plan via IA.
 *        Découpe le plan en tranches de 4 semaines, soumet le contexte
 *        athlète à l'IA pour définir type et thème de chaque bloc,
 *        puis calcule la progression CTL bloc par bloc.
 * @input
 * - plan    : Plan parent contenant les dates et la stratégie macro
 * - profile : Profil athlète (niveau, CTL actuelle, disciplines...)
 * @output
 * - Block[] : tableau de blocs ordonnés, avec CTL, TSS et thème renseignés
 *             (weeksId vide, sera rempli par CreateWeeks)
 ******************************************************************************/
async function CreateBlocks(plan: Plan, profile: Profile): Promise<Block[]> {
    const start = startOfISOWeek(new Date(plan.startDate));
    const goal  = endOfISOWeek(new Date(plan.goalDate));
    const totalWeeks = differenceInWeeks(goal, start) + 1;

    if (totalWeeks < 1) throw new Error("Le plan est trop court !");

    const blockSkeletons = computeBlockSkeletons(totalWeeks);

// @TODO: remplacer les spécification au cyclisme en adaptatif au triathlon 
    const aiPrompt = `
        Tu es un coach de ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''} certifié et avec 15 ans d'experience dans le monde du sport.

        ## CONTEXTE ATHLÈTE
        - Objectif : ${plan.macroStrategyDescription}
        - Date de course : ${plan.goalDate}
        - Niveau : ${profile.experience ?? "Intermédiaire"} 
        - Volume hebdo actuel : ${"Non spécifié"}h
        - Discipline faible : ${"Non spécifié"}

        ## STRUCTURE TEMPORELLE
        ${blockSkeletons.length} blocs de méso-cycles :
        ${blockSkeletons.map(b =>
                `- Bloc ${b.index} : ${b.duration} semaines${b.isLast ? " (DERNIER → inclut la semaine de course)" : ""}`
            ).join('\n')}

        ## PROFIL NIVEAU
        ${profile.experience === 'Débutant' ? `
        ⚠️ ATHLÈTE DÉBUTANT — Règles impératives :
        - Commence TOUJOURS par un bloc "Base" long (fondamentaux, endurance aérobie)
        - Progression très graduelle (<5% de charge par semaine)
        - Priorité à la régularité et la récupération, pas à la performance` : profile.experience === 'Avancé' ? `
        🏆 ATHLÈTE AVANCÉ — Objectif performance :
        - Blocs Peak, Build et Taper autorisés dès le début si le plan est court
        - Périodisation polarisée recommandée (blocs alternant volume et intensité)
        - Peut supporter des blocs courts et intenses` : `
        📈 ATHLÈTE INTERMÉDIAIRE :
        - Progression équilibrée entre volume et intensité
        - Commence par Base si plan ≥ 8 semaines, sinon Build direct
        - Un bloc de récupération active conseillé en milieu de plan`}

        ## RÈGLES OBLIGATOIRES
        1. tu dois prendre en compte le profil de l'athlète et son objectif pour définir un thème spécifique à chaque bloc
        2. tu dois prendre en compte l'historique a disposition pour s'adapter au mieux a l'athlète
        3. Dans le mesure du possible suivre une progression logique progressive et pertinente
        4. Si il n'y a qu'un seul bloc, part du principe que l'athlète a déjà une base et qu'on est dans une logique de préparation spécifique (pas de bloc de base sauf si demandé)


        Chaque objet contient exactement :
        - "index" (number) : numéro du bloc
        - "type" (string) : l'un de ["Base", "Build", "Peak", "Taper"]
        - "theme" (string) : objectif principal en 3 à 6 mots, spécifique à ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''}

        ## RÉPONSE (JSON uniquement) :
        `;

    const aiResponse = await callGeminiAPI({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
        },
    }) as { index: number; type: string; theme: string }[];

    // Construction des blocs
    let currentStartDate = start;
    let previousTargetCTL = profile.currentCTL;

    return blockSkeletons.map((skeleton) => {
        const aiInfo = aiResponse.find(b => b.index === skeleton.index);
        const progression = CTL_PROGRESSION[aiInfo?.type ?? "Base"] ?? 5;

        const startCTL   = previousTargetCTL;
        const targetCTL  = startCTL + progression;
        const avgWeeklyTSS = Math.round(((startCTL + targetCTL) / 2) * 7);

        const block: Block = {
            id: randomUUID(),
            planId: plan.id,
            userId: plan.userID,
            orderIndex: skeleton.index,
            type:  aiInfo?.type  ?? "General",
            theme: aiInfo?.theme ?? "Préparation",
            weekCount: skeleton.duration,
            startDate: format(currentStartDate, 'yyyy-MM-dd'),
            weeksId: [],
            startCTL,
            targetCTL,
            avgWeeklyTSS,
        };

        previousTargetCTL = targetCTL;
        currentStartDate  = addWeeks(currentStartDate, skeleton.duration);

        return block;
    });
}

/******************************************************************************
 * @access Private
 * @function CreateWeeks
 * @brief Génère les semaines d'entraînement d'un bloc avec une progression
 *        linéaire du TSS entre startCTL et targetCTL du bloc.
 *        Si le bloc contient plus de 3 semaines, la dernière est
 *        automatiquement une semaine de récupération à 90% du TSS de départ.
 * @input
 * - plan    : Plan parent (référence)
 * - block   : Bloc parent contenant startCTL, targetCTL, weekCount et theme
 * - profile : Profil athlète (ID utilisateur, niveau...)
 * @output
 * - Week[]  : tableau de semaines ordonnées avec TSS cible, type (Load /
 *             Recovery) et thème hérité du bloc (workoutsID vide)
 ******************************************************************************/
async function CreateWeeks(plan: Plan, block: Block, profile: Profile): Promise<Week[]> {
    const hasRecoveryWeek  = block.weekCount > RECOVERY_WEEK_THRESHOLD;
    const startWeeklyTSS   = computeWeeklyTSS(block.startCTL);
    const targetWeeklyTSS  = computeWeeklyTSS(block.targetCTL);
    const loadWeeksCount   = hasRecoveryWeek ? block.weekCount - 1 : block.weekCount;
    const progressionPerWeek = loadWeeksCount > 1
        ? (targetWeeklyTSS - startWeeklyTSS) / (loadWeeksCount - 1)
        : 0;

    return Array.from({ length: block.weekCount }, (_, i) => {
        const weekNumber     = i + 1;
        const isRecoveryWeek = hasRecoveryWeek && weekNumber === block.weekCount;

        const targetTSS = isRecoveryWeek
            ? Math.round(startWeeklyTSS * RECOVERY_TSS_RATIO)
            : Math.round(startWeeklyTSS + progressionPerWeek * (weekNumber - 1));

        return {
            id: randomUUID(),
            userID: profile.id,
            workoutsID: [],
            blockID: block.id,
            weekNumber,
            type: isRecoveryWeek ? 'Recovery' : 'Load',
            targetTSS,
            actualTSS: 0,
            userFeedback: "",
        } satisfies Week;
    });
}

/******************************************************************************
 * @access Private
 * @function CreateWorkoutForWeek
 * @brief Génère les séances d'une semaine via IA en tenant compte du profil
 *        athlète (disciplines actives, niveau), du thème du bloc, du TSS
 *        cible et de l'historique de complétion des semaines précédentes.
 * @input
 * - profile     : Profil athlète (ID, niveau, disciplines, CTL...)
 * - plan        : Plan parent (référence)
 * - block       : Bloc parent (theme, type, startCTL, targetCTL...)
 * - week        : Semaine cible (weekNumber, targetTSS, type...)
 * - userComment : Commentaire libre (fatigue, blessure, contraintes...)
 * - avgCompletion     : Historique de complétion des semaines précédentes (ex: [80, 90, 95])
 * @output
 * - Workout[]   : Séances prêtes à être sauvegardées (status: 'pending')
 ******************************************************************************/
export async function CreateWorkoutForWeek(
    profile: Profile,
    plan: Plan,
    block: Block,
    week: Week,
    userComment: string | null,
    avgCompletion: number,
    weeklyAvailability: { [key: string]: AvailabilitySlot }, 
): Promise<Workout[]>
{
    const weekStartDate = new Date(block.startDate);
    weekStartDate.setDate(weekStartDate.getDate() + (week.weekNumber - 1) * 7);
    const activeSports = getActiveSports(profile.activeSports);
    const formattedAvailability = formatAvailability(weeklyAvailability);

    // Zones context pour des descriptions précises en watts
    let zonesContext = "";
    if (profile.cycling?.Test?.zones) {
        const z = profile.cycling.Test.zones;
        zonesContext = `
## ZONES DE PUISSANCE CYCLISME (à utiliser dans les descriptions)
- Z1 (Récupération) : < ${z.z1.max} W
- Z2 (Endurance) : ${z.z2.min}–${z.z2.max} W
- Z3 (Tempo) : ${z.z3.min}–${z.z3.max} W
- Z4 (Seuil/FTP) : ${z.z4.min}–${z.z4.max} W
- Z5 (VO2 Max) : ${z.z5.min}–${z.z5.max} W
- Z6 (Anaérobie) : ${z.z6?.min}–${z.z6?.max} W
- Z7 (Neuromusculaire) : > ${z.z7?.min} W`;
    }

   const aiPrompt = `
Tu es un coach certifié, spécialisé en ${activeSports.join(", ")}, avec 15 ans d'expérience.

## PROFIL ATHLÈTE
- Niveau : ${profile.experience ?? "Intermédiaire"}
- CTL actuelle : ${profile.currentCTL}
- Disciplines actives :${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''}
${zonesContext}

## DISPONIBILITÉS DE LA SEMAINE
${formattedAvailability || "Non spécifiées"}

## CONTEXTE DE LA SEMAINE
- Thème du bloc : ${block.theme}
- Type de bloc : ${block.type}
- Type de semaine : ${week.type}
- TSS cible total : ${week.targetTSS}
- Semaine n°${week.weekNumber} / ${block.weekCount}
${userComment        ? `- Commentaire athlète : "${userComment}"` : ""}
- Complétion des 4 dernières semaines : ${avgCompletion}%
${avgCompletion < 80 ? `- ⚠️ Complétion faible : réduire l'intensité et le volume global` : ""}
${avgCompletion > 95 ? `- ✅ Complétion excellente : l'athlète peut absorber plus de charge` : ""}

## RÈGLES NIVEAU ATHLÈTE
${profile.experience === 'Débutant' ? `⚠️ DÉBUTANT — Appliquer impérativement :
- Intensité : Z1-Z3 uniquement — peu d'intervalle à haute intensité (pas de Z4-Z5)
- Pas de double journée
- Descriptions simples, langage accessible, sans jargon excessif
- TSS max par séance : 60` : profile.experience === 'Avancé' ? `🏆 AVANCÉ — Autorisations spéciales :
- Double journée autorisée si disponibilité > 3h ce jour
- Intensité Z4-Z5 bienvenue (20% max du volume total)
- Sorties longues pouvant aller jusqu'à la dispo max
- Descriptions très techniques avec valeurs de zones et intervalles précis` : `📈 INTERMÉDIAIRE :
- Max 1 double journée par semaine
- 1-2 séances dures (Z4+) par semaine maximum
- Descriptions techniques mais accessibles`}

## RÈGLES GÉNÉRALES
1. Placer chaque séance UNIQUEMENT aux jours disponibles.
2. Respecter la durée max par sport et par jour.
3. Répartir les séances UNIQUEMENT sur les disciplines actives : ${activeSports.join(", ")}.
4. La somme des plannedTSS doit être égale à ${week.targetTSS} (±5%).
5. Respecter le thème "${block.theme}" dans le choix des types de séances.
6. Ne pas placer 2 séances dures (Interval, Tempo) consécutives.
7. En semaine Recovery : séances courtes, faible intensité uniquement.
8. Le dayOffset doit correspondre exactement au jour disponible (0=Lundi ... 6=Dimanche).
9. La "description" doit être précise, technique et inclure les valeurs de watts/allure réelles de l'athlète.
   Exemple de format attendu : "Échauffement: 20 min Z1-Z2. Corps de séance: 3x10 min Over/Under. Chaque 10 min = 2x(1 min @ 260-270W (Z5) / 4 min @ 230-240W (Z4)). Récupération 8 min Z1/Z2 entre les 10 min. Retour au calme: 16 min Z1."

## FORMAT DE RÉPONSE
Réponds UNIQUEMENT avec un tableau JSON valide — sans markdown, sans explication.
Chaque objet contient exactement :
- "dayOffset"       (number) : 0=Lundi, 6=Dimanche
- "sportType"       (string) : l'un de ${activeSports.join(", ")}
- "title"           (string) : titre court (ex: "Endurance Z2 vélo")
- "workoutType"     (string) : l'un de ["Endurance", "Tempo", "Interval", "Recovery", "Long", "Strength"]
- "durationMinutes" (number) : durée totale en minutes (respecter le max du créneau)
- "plannedTSS"      (number) : TSS prévu pour cette séance
- "description"     (string) : description technique complète de la séance (échauffement, corps, retour au calme, avec valeurs de zones/watts réelles)

## JSON :
`.trim();

    // ---- Appel IA -----------------------------------------------------------
    type AIWorkout = {
        dayOffset:       number;
        sportType:       SportType;
        title:           string;
        workoutType:     string;
        durationMinutes: number;
        plannedTSS:      number;
        description:     string;
    };

    const responseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                "dayOffset":       { type: "NUMBER" },
                "sportType":       { type: "STRING", enum: activeSports },
                "title":           { type: "STRING" },
                "workoutType":     { type: "STRING", enum: ["Endurance", "Tempo", "Interval", "Recovery", "Long", "Strength"] },
                "durationMinutes": { type: "NUMBER" },
                "plannedTSS":      { type: "NUMBER" },
                "description":     { type: "STRING" },
            },
            required: ["dayOffset", "sportType", "title", "workoutType", "durationMinutes", "plannedTSS", "description"],
        },
    };

    const aiResponse = await callGeminiAPI({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseSchema,
        },
    }) as AIWorkout[];

    return aiResponse.map((w) => {
    const workoutDate = new Date(weekStartDate);
    workoutDate.setDate(workoutDate.getDate() + w.dayOffset);

    return {
        ID:          randomUUID(),
        id:          randomUUID(),
        userID:      profile.id,
        weekID:      week.id,
        date:        formatDateKey(workoutDate),
        sportType:   w.sportType as SportType,
        title:       w.title,
        workoutType: w.workoutType,
        mode:        'Outdoor',
        status:      'pending',
        plannedData: {
            durationMinutes:    w.durationMinutes,
            targetPowerWatts:   null,
            targetPaceMinPerKm: null,
            targetHeartRateBPM: null,
            distanceKm:         null,
            plannedTSS:         w.plannedTSS,
            description:        w.description,
            structure:          [],
        },
        completedData: null,
    } satisfies Workout;
});
}






















// --- Helpers ---

const getRecentPerformanceHistory = (schedule: Schedule): string => {
    // Sécurité: vérifier que schedule.workouts est un tableau
    const allWorkouts = Array.isArray(schedule.workouts) ? schedule.workouts : [];

    // On récupère les 10 dernières séances complétées, du plus récent au plus ancien
    const workouts = allWorkouts
        .filter(w => w.status === 'completed' && w.completedData)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    if (workouts.length === 0) return "Aucune donnée historique récente disponible.";

    return workouts.map(w => {
        const data = w.completedData!;
        const metrics = data.metrics;
        const plannedDuration = w.plannedData?.durationMinutes || '?';

        // Construction des détails spécifiques au sport
        const performanceDetails = [];

        // 1. Métriques Spécifiques par Sport
        if (w.sportType === 'cycling' && metrics.cycling) {
            if (metrics.cycling.avgPowerWatts) performanceDetails.push(`${metrics.cycling.avgPowerWatts}W Avg`);
            if (metrics.cycling.normalizedPowerWatts) performanceDetails.push(`${metrics.cycling.normalizedPowerWatts}W NP`);
        }
        else if (w.sportType === 'running' && metrics.running) {
            if (metrics.running.avgPaceMinPerKm) performanceDetails.push(`${metrics.running.avgPaceMinPerKm}/km`);
            if (metrics.running.elevationGainMeters) performanceDetails.push(`D+ ${metrics.running.elevationGainMeters}m`);
            if (metrics.cycling?.tss) performanceDetails.push(`TSS: ${metrics.cycling?.tss}`);
        }
        else if (w.sportType === 'swimming' && metrics.swimming) {
            if (metrics.swimming.avgPace100m) performanceDetails.push(`${metrics.swimming.avgPace100m}/100m`);
            if (metrics.swimming.strokeType) performanceDetails.push(`Nage: ${metrics.swimming.strokeType}`);
        }

        // 2. Données Physiologiques & Charge (Communs)
        const physioDetails = [];
        if (data.heartRate?.avgBPM) physioDetails.push(`FC Moy: ${data.heartRate.avgBPM}bpm`);

        // Assemblage des chaines pour l'affichage
        const perfString = performanceDetails.length > 0 ? `| Perf: [${performanceDetails.join(', ')}]` : '';
        const physioString = physioDetails.length > 0 ? `| Physio: [${physioDetails.join(', ')}]` : '';

        // Formatage pour l'IA : Conis et structuré
        return `
      - [${w.date}] ${w.sportType.toUpperCase()} - ${w.workoutType}
        * Durée: Prévue ${plannedDuration}m vs Réelle ${data.actualDurationMinutes}m
        * Volume: ${data.distanceKm.toFixed(2)} km ${perfString}
        * Intensité/Ressenti: RPE ${data.perceivedEffort}/10 ${physioString}
        * Notes: "${data.notes || 'R.A.S'}"
    `.trim();
    }).join('\n\n');
};




// Helper pour trouver une séance par ID ou par Date (pour rétro-compatibilité)
const findWorkoutIndex1 = (workouts: Workout[], identifier: string): number => {
    return workouts.findIndex(w => w.id === identifier || w.date === identifier);
};

// --- Fonctions de lecture (initialisation) ---
export async function loadInitialData(): Promise<{ profile: Profile | null, schedule: Schedule | null, objectives: Objective[] }> {
    try {
        const [profile, schedule, objectives] = await Promise.all([
            getProfile(),
            getSchedule(),
            getObjectives(),
        ]);
        return { profile, schedule, objectives };
    } catch (error) {
        console.error("Erreur lors du chargement initial des données:", error);
        return { profile: null, schedule: null, objectives: [] };
    }
}

// --- Fonctions d'écriture (mutation) ---

export async function saveAthleteProfile(data: Profile) {
    await saveProfile(data);
}


// Régénération d'une séance unique
export async function regenerateWorkout(workoutIdOrDate: string, instruction?: string) {

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();

    if (!existingProfile) throw new Error("Profil manquant");

    // Trouver la séance cible
    const targetIndex = findWorkoutIndex1(existingSchedule.workouts, workoutIdOrDate);
    if (targetIndex === -1) throw new Error("Séance introuvable");

    const oldWorkout = existingSchedule.workouts[targetIndex];
    const dateKey = oldWorkout.date; // La date est nécessaire pour l'IA

    const history = getRecentPerformanceHistory(existingSchedule);
    const surroundingWorkouts = getSurroundingWorkouts(existingSchedule, dateKey);
    const blockFocus = "General Fitness"; // TODO: Stocker le focus actuel dans le Schedule si nécessaire

    try {
        const newWorkoutData = await generateSingleWorkoutFromAI(
            existingProfile,
            history,
            dateKey,
            surroundingWorkouts,
            oldWorkout,
            blockFocus,
            instruction
        );

        // Remplacement dans le tableau en préservant les clés relationnelles
        existingSchedule.workouts[targetIndex] = {
            ...newWorkoutData,
            ID: oldWorkout.ID,
            id: oldWorkout.id,
            userID: oldWorkout.userID,
            weekID: oldWorkout.weekID,
            date: dateKey,
            status: 'pending',
            completedData: null,
        };

        await saveSchedule(existingSchedule);
        revalidatePath('/');

    } catch (error) {
        console.error("Échec régénération:", error);
        throw new Error("L'IA n'a pas pu créer la séance.");
    }
}

// Helper pour donner du contexte à l'IA (jours avant/après)
function getSurroundingWorkouts(schedule: Schedule, targetDate: string) {
    const target = new Date(targetDate);
    const context: Record<string, string> = {};

    // On parcourt le tableau pour trouver les voisins (plus lent que map mais robuste)
    // Idéalement, on filtrerait d'abord, mais sur <365 items c'est négligeable
    const surroundingDates = new Set<string>();
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const d = new Date(target);
        d.setDate(d.getDate() + i);
        surroundingDates.add(d.toISOString().split('T')[0]);
    }

    schedule.workouts.forEach(w => {
        if (surroundingDates.has(w.date)) {
            context[w.date] = `${w.workoutType} - ${w.title}`;
        }
    });

    return context;
}



/**
 * Extrait le TSS d'un workout complété.
 * Priorité :
 *   1. TSS vélo saisi / calculé via NP+FTP
 *   2. TSS calculé Strava (calculatedTSS)
 *   3. TSS planifié par l'IA
 *   4. hrTSS via FC moyenne + FCmax (+ FCrepos si dispo) — Karvonen
 *   5. Estimation sRPE : (durée_h) × (RPE/10)² × 100
 */
function extractTSS(workout: Workout, profile?: Profile): number {
    const cd = workout.completedData;
    if (!cd) return 0;

    if (cd.metrics?.cycling?.tss) return cd.metrics.cycling.tss;
    if (cd.calculatedTSS)          return cd.calculatedTSS;
    if (workout.plannedData?.plannedTSS) return workout.plannedData.plannedTSS;

    // hrTSS via FC (méthode Karvonen si FCmax disponible dans le profil)
    const avgHR  = cd.heartRate?.avgBPM;
    const maxHR  = profile?.heartRate?.max;
    const duration = cd.actualDurationMinutes;
    if (avgHR && maxHR && maxHR > 0 && duration) {
        const restHR   = profile?.heartRate?.resting ?? 0;
        const hrRatio  = restHR > 0
            ? (avgHR - restHR) / (maxHR - restHR)   // Karvonen (réserve cardiaque)
            : avgHR / maxHR;                          // Simplifié si pas de FCR
        const ifHR = Math.min(Math.max(hrRatio, 0), 1);
        return Math.round((duration / 60) * ifHR * ifHR * 100);
    }

    // Estimation sRPE : TSS ≈ (durée_h) × (RPE/10)² × 100
    const rpe = cd.perceivedEffort;
    if (rpe && duration && rpe > 0) {
        return Math.round((duration / 60) * Math.pow(rpe / 10, 2) * 100);
    }
    return 0;
}

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
    const cutoff  = format(addDays(parseISO(today), -200), 'yyyy-MM-dd');
    const startDate = completed[0].date > cutoff ? completed[0].date : cutoff;

    let ctl = startDate === completed[0].date ? 0 : (profile.currentCTL ?? 0);
    let atl = startDate === completed[0].date ? 0 : (profile.currentATL ?? 0);

    let   current = parseISO(startDate);
    const end     = parseISO(today);

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

/**
 * Trouve l'index d'un workout par ID ou Date
 */
function findWorkoutIndex(workouts: Workout[], idOrDate: string): number {
    return workouts.findIndex(w => w.id === idOrDate || w.date === idOrDate);
}

/**
 * Transforme CompletedDataFeedback → CompletedData
 */
function transformFeedbackToCompletedData(
    feedback: CompletedDataFeedback
): CompletedData {
    const sportType = feedback.sportType;

    return {
        actualDurationMinutes: Number(feedback.actualDuration),
        distanceKm: feedback.distance ? Number(feedback.distance) : 0,
        perceivedEffort: Number(feedback.rpe),
        notes: feedback.notes || "", // Chaîne vide si null

        source: {
            type: 'manual',
            stravaId: null // Pas de champ pour le moment
        },

        laps: [], // Pas de tours détaillés en saisie manuelle

        // Toujours renvoyer l'objet structurel, champs à null si pas de donnée
        heartRate: {
            avgBPM: feedback.avgHeartRate ? Number(feedback.avgHeartRate) : null,
            maxBPM: null // Valeur explicite null
        },

        caloriesBurned: feedback.calories ? Number(feedback.calories) : null,

        // Métriques sport-spécifiques
        metrics: {
            cycling: sportType === 'cycling' ? {
                tss: feedback.tss ? Number(feedback.tss) : null,
                avgPowerWatts: feedback.avgPower ? Number(feedback.avgPower) : null,
                maxPowerWatts: feedback.maxPower ? Number(feedback.maxPower) : null,
                normalizedPowerWatts: null, // On garde la clé présente
                intensityFactor: null,      // Souvent requis dans le type CyclingMetrics
                avgCadenceRPM: feedback.avgCadence ? Number(feedback.avgCadence) : null,
                maxCadenceRPM: feedback.maxCadence ? Number(feedback.maxCadence) : null,
                elevationGainMeters: feedback.elevation ? Number(feedback.elevation) : null,
                avgSpeedKmH: feedback.avgSpeed ? Number(feedback.avgSpeed) : null,
                maxSpeedKmH: feedback.maxSpeed ? Number(feedback.maxSpeed) : null,
            } : null,

            running: sportType === 'running' ? {
                avgPaceMinPerKm: feedback.avgPace ? feedback.avgPace : null,
                bestPaceMinPerKm: null,
                elevationGainMeters: feedback.elevation ? Number(feedback.elevation) : null,
                avgCadenceSPM: feedback.avgCadence ? Number(feedback.avgCadence) : null,
                maxCadenceSPM: feedback.maxCadence ? Number(feedback.maxCadence) : null,
                avgSpeedKmH: feedback.avgSpeed ? Number(feedback.avgSpeed) : null,
                maxSpeedKmH: feedback.maxSpeed ? Number(feedback.maxSpeed) : null
            } : null,

            swimming: sportType === 'swimming' ? {
                avgPace100m: null,
                bestPace100m: null,
                strokeType: feedback.strokeType ?? null, // String ou Enum, pas de Number()
                avgStrokeRate: feedback.avgStrokeRate ? Number(feedback.avgStrokeRate) : null,
                avgSwolf: feedback.avgSwolf ? Number(feedback.avgSwolf) : null,
                poolLengthMeters: feedback.poolLengthMeters ? Number(feedback.poolLengthMeters) : null,
                totalStrokes: feedback.totalStrokes ? Number(feedback.totalStrokes) : null
            } : null
        }
    };

}

/**
 * Met à jour le statut d'un workout avec feedback optionnel
 */
export async function updateWorkoutStatus(
    workoutIdOrDate: string,
    status: 'pending' | 'completed' | 'missed',
    feedback?: CompletedDataFeedback
): Promise<void> {
    try {
        const schedule = await getSchedule();
        const index = findWorkoutIndex(schedule.workouts, workoutIdOrDate);

        if (index === -1) {
            throw new Error(`Workout non trouvé: ${workoutIdOrDate}`);
        }

        // Mise à jour du statut
        schedule.workouts[index].status = status;

        // Gestion des données complétées
        if (status === 'completed' && feedback) {
            // Transformation type-safe
            schedule.workouts[index].completedData = transformFeedbackToCompletedData(feedback);
        } else {
            // Effacement si retour en pending/missed
            schedule.workouts[index].completedData = null;
        }

        // Sauvegarde
        await saveSchedule(schedule);

        // Recalcul CTL/ATL après tout changement de statut
        await recalculateFitnessMetrics();

        revalidatePath('/');

    } catch (error) {
        console.error('Erreur updateWorkoutStatus:', error);
        throw error;
    }
}

/**
 * Alias pour clarté sémantique
 */
export async function completeWorkout(
    workoutIdOrDate: string,
    feedback: CompletedDataFeedback
): Promise<void> {
    return updateWorkoutStatus(workoutIdOrDate, 'completed', feedback);
}

/**
 * Marquer comme manqué
 */
export async function markWorkoutAsMissed(workoutIdOrDate: string): Promise<void> {
    return updateWorkoutStatus(workoutIdOrDate, 'missed');
}

/**
 * Réinitialiser en pending
 */
export async function resetWorkoutToPending(workoutIdOrDate: string): Promise<void> {
    return updateWorkoutStatus(workoutIdOrDate, 'pending');
}


export async function toggleWorkoutMode(workoutIdOrDate: string) {
    const schedule = await getSchedule();
    const index = findWorkoutIndex1(schedule.workouts, workoutIdOrDate);

    if (index !== -1) {
        const currentMode = schedule.workouts[index].mode;
        schedule.workouts[index].mode = currentMode === 'Outdoor' ? 'Indoor' : 'Outdoor';
        await saveSchedule(schedule);
        revalidatePath('/');
    }
}

export async function moveWorkout(originalDateOrId: string, newDateStr: string) {
    const schedule = await getSchedule();

    // 1. Trouver la source
    const sourceIndex = findWorkoutIndex1(schedule.workouts, originalDateOrId);
    if (sourceIndex === -1) throw new Error("Séance source non trouvée.");

    const sourceWorkout = schedule.workouts[sourceIndex];

    // 2. Vérifier s'il y a déjà une séance sur la date cible
    const targetIndex = schedule.workouts.findIndex(w => w.date === newDateStr);

    if (targetIndex !== -1) {
        // --- CAS 1 : ÉCHANGE (SWAP) ---
        const targetWorkout = schedule.workouts[targetIndex];

        // On échange les dates
        // Note: On reset à pending car changer de jour change le contexte
        schedule.workouts[sourceIndex] = {
            ...targetWorkout,
            date: sourceWorkout.date, // Prend l'ancienne date de la source
            status: 'pending',
            completedData: null
        };

        schedule.workouts[targetIndex] = {
            ...sourceWorkout,
            date: newDateStr, // Prend la nouvelle date
            status: 'pending',
            completedData: null
        };
    } else {
        // --- CAS 2 : DÉPLACEMENT SIMPLE ---
        // On modifie juste la date de la source
        schedule.workouts[sourceIndex] = {
            ...sourceWorkout,
            date: newDateStr,
            status: 'pending',
            completedData: null
        };
    }

    await saveSchedule(schedule);
    revalidatePath('/');
}

export async function addManualWorkout(workout: Workout) {
    const schedule = await getSchedule();

    // ✅ Validation : vérifier que l'ID est unique (sécurité)
    const existingWorkout = schedule.workouts.find(w => w.id === workout.id);

    if (existingWorkout) {
        throw new Error(`Un workout avec l'ID ${workout.id} existe déjà`);
    }

    // ✅ Validation : vérifier le format de date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workout.date)) {
        throw new Error(`Format de date invalide: ${workout.date}. Attendu: YYYY-MM-DD`);
    }

    // ✅ Ajout du workout
    schedule.workouts.push(workout);

    await saveSchedule(schedule);
    revalidatePath('/');
}


export async function deleteWorkout(workoutIdOrDate: string) {
    const schedule = await getSchedule();

    // Filtrer pour exclure la séance ciblée
    const initialLength = schedule.workouts.length;
    schedule.workouts = schedule.workouts.filter(w => w.id !== workoutIdOrDate && w.date !== workoutIdOrDate);

    if (schedule.workouts.length !== initialLength) {
        await saveSchedule(schedule);
        revalidatePath('/');
    }
}

export async function syncStravaActivities() {
    console.log("⚡ Début Sync Strava...");

    // Helper : retry avec backoff exponentiel
    async function fetchWithRetry<T>(
        fn: () => Promise<T | null>,
        id: number,
        maxRetries = 2
    ): Promise<T | null> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                if (result !== null) return result;
            } catch {
                // fall through to retry
            }
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                console.log(`   🔁 Retry ${attempt + 1}/${maxRetries} pour l'activité ${id}...`);
            }
        }
        console.warn(`   ⚠️ Activité ${id} non récupérée après ${maxRetries} retry.`);
        return null;
    }

    try {
        // 1. Charger les données actuelles
        const [profile, existingWorkouts, existingWeeks, existingBlocks] = await Promise.all([
            getProfile(),
            getWorkout(),
            getWeek(),
            getBlock(),
        ]);

        const workouts: Workout[] = existingWorkouts ?? [];

        // ── Déterminer les droits Strava ──────────────────────────────────────
        const FREE_STRAVA_LIMIT = 5;
        const isFreePlan =
            (profile?.plan ?? 'free') === 'free' &&
            profile?.role !== 'admin' &&
            profile?.role !== 'freeUse';

        // 2. Trouver la date de la dernière activité Strava importée
        let lastStravaTimestamp = 0;
        const stravaWorkouts = workouts.filter(w =>
            w.status === 'completed' &&
            w.completedData?.source?.type === 'strava'
        );

        if (stravaWorkouts.length > 0) {
            stravaWorkouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            lastStravaTimestamp = Math.floor(new Date(stravaWorkouts[0].date).getTime() / 1000);
            console.log(`📅 Dernière activité Strava connue : ${stravaWorkouts[0].date}`);
        } else {
            console.log("⚠️ Aucune activité Strava en DB. Sync complète de l'année en cours.");
        }

        // 3. Stratégie de sync :
        //    - Incrémentale (rapide) : si la dernière activité connue est dans l'année en cours
        //    - Complète avec pagination : sinon (premier lancement, ou dernière activité de l'an passé)
        const currentYear = new Date().getFullYear();
        const startOfYear = Math.floor(new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000);

        // ── Détection de montée en plan (free → dev/pro) ─────────────────────
        // Si l'utilisateur vient d'être promu ET qu'il a peu d'activités (plafond du plan free),
        // on force une sync complète de l'année pour récupérer les activités manquées.
        if (
            !isFreePlan &&
            stravaWorkouts.length > 0 &&
            stravaWorkouts.length <= FREE_STRAVA_LIMIT &&
            lastStravaTimestamp >= startOfYear
        ) {
            console.log(`🔄 Compte promu détecté (${stravaWorkouts.length} activité(s) ≤ limite free). Full resync annuelle pour récupérer les activités manquées...`);
            lastStravaTimestamp = startOfYear - 1; // déclenche le chemin full-sync
        }

        const isIncremental = lastStravaTimestamp >= startOfYear;

        let activitiesSummary: { id: number; start_date: string; [key: string]: unknown }[];
        if (isIncremental) {
            console.log(`⚡ Sync incrémentale (après ${stravaWorkouts[0].date})...`);
            activitiesSummary = await getStravaActivities(lastStravaTimestamp, 30);
        } else {
            console.log(`📅 Sync complète ${currentYear} (pagination)...`);
            activitiesSummary = await getStravaActivitiesAllPages(startOfYear);
            console.log(`📊 ${activitiesSummary.length} activité(s) trouvée(s) sur Strava pour ${currentYear}`);
        }

        if (!activitiesSummary || activitiesSummary.length === 0) {
            console.log("✅ Aucune nouvelle activité à synchroniser.");
            return { success: true, count: 0 };
        }

        // 4. Filtrer les doublons avant tout fetch
        const newSummaries = activitiesSummary.filter((summary: { id: number }) =>
            !workouts.some(w =>
                w.completedData?.source?.type === 'strava' &&
                w.completedData.source.stravaId === summary.id
            )
        );

        if (newSummaries.length === 0) {
            console.log("✅ Toutes les activités sont déjà à jour.");
            return { success: true, count: 0 };
        }

        // ── Appliquer la limite plan free ─────────────────────────────────────
        let summariesToProcess = newSummaries;
        if (isFreePlan) {
            const slotsRemaining = Math.max(0, FREE_STRAVA_LIMIT - stravaWorkouts.length);
            if (slotsRemaining === 0) {
                console.log(`🔒 Plan gratuit : limite de ${FREE_STRAVA_LIMIT} activités Strava atteinte. Passez à l'offre Développeur pour tout synchroniser.`);
                return { success: true, count: 0, limitReached: true };
            }
            summariesToProcess = [...newSummaries]
                .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                .slice(0, slotsRemaining);
            console.log(`🔒 Plan gratuit : import limité à ${slotsRemaining} activité(s) (${stravaWorkouts.length}/${FREE_STRAVA_LIMIT} déjà importées).`);
        }

        console.log(`📥 ${summariesToProcess.length} nouvelles activités à récupérer (sur ${activitiesSummary.length}).`);

        // 5. Récupérer tous les détails en PARALLÈLE avec retry
        const detailResults = await Promise.allSettled(
            summariesToProcess.map((summary: { id: number }) =>
                fetchWithRetry(() => getStravaActivityById(summary.id), summary.id)
            )
        );

        let newItemsCount = 0;
        const updatedWeeks = existingWeeks ? [...existingWeeks] : [];

        // 6. Traiter chaque résultat
        for (let i = 0; i < summariesToProcess.length; i++) {
            const summary = summariesToProcess[i];
            const result = detailResults[i];

            if (result.status === 'rejected' || !result.value) {
                console.warn(`   ⏭  Skip: impossible de récupérer l'activité ${summary.id}.`);
                continue;
            }

            const detail = result.value;
            const completedData = await mapStravaToCompletedData(detail);
            const activityDate = summary.start_date.split('T')[0];

            // 🧠 MATCHING : séance planifiée existante pour cette date ?
            const matchingIndex = workouts.findIndex(w =>
                w.date === activityDate &&
                w.status !== 'completed'
            );

            if (matchingIndex !== -1) {
                console.log(`   🤝 Match le ${activityDate} -> mise à jour du plan.`);
                workouts[matchingIndex].status = 'completed';
                workouts[matchingIndex].completedData = completedData;
            } else {
                console.log(`   ➕ Activité libre ajoutée : ${activityDate}`);

                const sportType = completedData.metrics.swimming ? 'swimming'
                    : completedData.metrics.running ? 'running'
                    : 'cycling';

                // Trouver la semaine du bloc actif correspondant à cette date
                let activeWeekID = '';
                if (existingBlocks && existingWeeks) {
                    const activityDateObj = new Date(activityDate);
                    const activeBlock = existingBlocks.find(block => {
                        const blockStart = new Date(block.startDate);
                        const blockEnd = new Date(blockStart);
                        blockEnd.setDate(blockEnd.getDate() + block.weekCount * 7);
                        return activityDateObj >= blockStart && activityDateObj < blockEnd;
                    });

                    if (activeBlock) {
                        const blockStart = new Date(activeBlock.startDate);
                        const blockWeeks = existingWeeks.filter(w => activeBlock.weeksId?.includes(w.id));
                        const activeWeek = blockWeeks.find(week => {
                            const weekStart = new Date(blockStart);
                            weekStart.setDate(weekStart.getDate() + (week.weekNumber - 1) * 7);
                            const weekEnd = new Date(weekStart);
                            weekEnd.setDate(weekEnd.getDate() + 6);
                            return activityDateObj >= weekStart && activityDateObj <= weekEnd;
                        });

                        if (activeWeek) {
                            activeWeekID = activeWeek.id;
                            const weekIdx = updatedWeeks.findIndex(w => w.id === activeWeek.id);
                            if (weekIdx !== -1) {
                                const newId = `strava_${summary.id}`;
                                if (!updatedWeeks[weekIdx].workoutsID.includes(newId)) {
                                    updatedWeeks[weekIdx] = {
                                        ...updatedWeeks[weekIdx],
                                        workoutsID: [...updatedWeeks[weekIdx].workoutsID, newId],
                                    };
                                }
                            }
                        }
                    }
                }

                workouts.push({
                    ID: randomUUID(),
                    id: `strava_${summary.id}`,
                    userID: profile?.id ?? '',
                    weekID: activeWeekID,
                    date: activityDate,
                    sportType,
                    title: detail.name,
                    workoutType: 'Sortie Libre',
                    mode: 'Outdoor',
                    status: 'completed',
                    plannedData: {
                        durationMinutes: 0,
                        targetPowerWatts: null,
                        targetPaceMinPerKm: null,
                        targetHeartRateBPM: null,
                        distanceKm: null,
                        plannedTSS: null,
                        description: null,
                        structure: [],
                    },
                    completedData,
                });
            }
            newItemsCount++;
        }

        // 7. Sauvegarder si changements
        if (newItemsCount > 0) {
            workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            await saveWorkout(workouts);
            if (existingWeeks && updatedWeeks.some((w, i) => w !== existingWeeks[i])) {
                await saveWeek(updatedWeeks);
            }
            console.log(`💾 ${newItemsCount} activité(s) sauvegardée(s).`);
            await recalculateFitnessMetrics();
        }

        return { success: true, count: newItemsCount };

    } catch (error) {
        console.error("❌ Erreur Sync Strava:", error);
        return { success: false, error };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers partagés pour la recherche bloc/semaine par date
// ─────────────────────────────────────────────────────────────────────────────

function findBlockAndWeekForDate(
    blocks: Block[],
    weeks: Week[],
    targetDate: Date
): { block: Block; week: Week } | null {
    const block = blocks.find(b => {
        const start = new Date(b.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + b.weekCount * 7);
        return targetDate >= start && targetDate < end;
    });
    if (!block) return null;

    const blockStart = new Date(block.startDate);
    const blockWeeks = weeks.filter(w => block.weeksId?.includes(w.id));
    const week = blockWeeks.find(w => {
        const wStart = new Date(blockStart);
        wStart.setDate(wStart.getDate() + (w.weekNumber - 1) * 7);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);
        return targetDate >= wStart && targetDate <= wEnd;
    });

    if (!week) return null;
    return { block, week };
}

// ─────────────────────────────────────────────────────────────────────────────

export type WeekContext = {
    blockTheme: string;
    blockType: string;
    weekType: 'Load' | 'Recovery' | 'Taper';
    targetTSS: number;
    weekNumber: number;
    blockWeekCount: number;
} | null;

/**
 * Retourne le contexte (bloc + semaine) pour une date de début de semaine.
 */
export async function getWeekContextForDate(weekStartDate: string): Promise<WeekContext> {
    const [blocks, weeks] = await Promise.all([getBlock(), getWeek()]);
    if (!blocks || !weeks) return null;

    const result = findBlockAndWeekForDate(blocks, weeks, new Date(weekStartDate));
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

    const result = findBlockAndWeekForDate(blocks, weeks, new Date(weekStartDate));
    if (!result) return 0;

    return workouts.filter(w => w.weekID === result.week.id && w.status === 'pending').length;
}

/**
 * Génère les séances IA pour la semaine contenant weekStartDate,
 * en remplaçant les séances pending existantes de cette semaine.
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

    const result = findBlockAndWeekForDate(blocks, weeks, new Date(weekStartDate));
    if (!result) throw new Error("Aucun bloc actif pour cette semaine.");

    const { block, week } = result;
    const plan = plans?.find(p => p.id === block.planId);
    if (!plan) throw new Error("Plan introuvable.");

    const newWorkouts = await CreateWorkoutForWeek(
        profile,
        plan,
        block,
        week,
        comment,
        100,
        weeklyAvailability
    );

    if (!newWorkouts || newWorkouts.length === 0) {
        throw new Error("L'IA n'a retourné aucune séance. Les séances existantes sont conservées.");
    }

    // Supprimer les séances pending de cette semaine uniquement si la génération a réussi
    const keptWorkouts = (existingWorkouts ?? []).filter(
        w => !(w.weekID === week.id && w.status === 'pending')
    );

    // Mettre à jour workoutsID de la semaine
    const updatedWeeks = weeks.map(w =>
        w.id === week.id
            ? { ...w, workoutsID: newWorkouts.map(wo => wo.id) }
            : w
    );

    await Promise.all([
        saveWorkout([...keptWorkouts, ...newWorkouts]),
        saveWeek(updatedWeeks),
    ]);

    revalidatePath('/');
}