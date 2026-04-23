'use server';

import { generateSingleWorkoutFromAI } from '@/lib/ai/coach-api';
import { getBlock, getObjectives, getPlan, getProfile, getSchedule, getWeek, getWorkout, saveBlocks, savePlan, saveProfile, saveSchedule, saveWeek, saveWorkout, deleteWorkoutById, atomicIncrementAICallCount, atomicIncrementTokenCount, updateWorkoutById, saveTheme, insertSingleWorkout } from '@/lib/data/crud';
import { ReturnCode } from '@/lib/data/type';
import { revalidatePath } from 'next/cache';
import type { AvailabilitySlot, CompletedData, CompletedDataFeedback, SportType } from '@/lib/data/type';
import { getStravaActivitiesAllPages, getStravaActivityById } from '@/lib/strava-service';
import { mapStravaSport } from '@/lib/strava-mapper';
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
import { structureSessionDescription } from '@/lib/ai/structure-session';
import { CTL_PROGRESSION, CTL_LEVEL_MULTIPLIER, TAPER_CTL_DROP_PERCENT, RECOVERY_WEEK_THRESHOLD, RECOVERY_TSS_RATIO, RESIDUAL_EFFECTS_DAYS } from './constants';
import { computeBlockSkeletons, computeWeeklyTSS, formatAvailability, buildAllowedSlots, getActiveSports, buildTaperPlan } from './helpers';



// ─── Rate limiting ────────────────────────────────────────────────────────────

const AI_DAILY_LIMITS_FREE = { plan: 3, workout: 10 } as const;
const AI_DAILY_LIMITS_PRO  = { plan: 999, workout: 999 } as const;

async function checkAndIncrementAICallLimit(type: 'plan' | 'workout'): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const profile = await getProfile();
    const isPro = profile?.plan === 'pro' || profile?.plan === 'dev'
               || profile?.role === 'admin';
    const limits = isPro ? AI_DAILY_LIMITS_PRO : AI_DAILY_LIMITS_FREE;
    await atomicIncrementAICallCount(type, today, limits[type]);
}

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
    userID: string,
    weeklyAvailability?: { [key: string]: AvailabilitySlot }
) {
    // Validation
    if (numWeeks <= 0)      return { state: ReturnCode.RC_Error, error: "Nombre de semaines invalide" };
    if (userID.length < 3)  return { state: ReturnCode.RC_Error, error: "ID utilisateur invalide" };

    try { await checkAndIncrementAICallLimit('plan'); }
    catch (e) { return { state: ReturnCode.RC_Error, error: (e as Error).message }; }

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
    newPlan.blocksId = newBlocks.map(b => b.id);

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
    const firstBlock = updatedBlocks.find(b => b.id === firstWeek.blockId) ?? updatedBlocks[0];
    // Première semaine d'un nouveau plan : calculer la complétion + chercher les courses à proximité
    const [existingAllWorkouts, existingAllWeeks, existingObjectives] = await Promise.all([
        getWorkout(), getWeek(), getObjectives(),
    ]);
    const realCompletion = computeAvgCompletion(existingAllWorkouts ?? [], existingAllWeeks ?? [], firstWeek.id);
    const firstWeekStart = parseISO(firstBlock.startDate);
    const firstWeekEnd = addDays(firstWeekStart, 13); // cette semaine + semaine suivante
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const firstWeekObjectives = existingObjectives.filter(o =>
        o.status === 'upcoming' && o.date >= todayStr
        && parseISO(o.date) >= firstWeekStart && parseISO(o.date) <= firstWeekEnd
    );
    const firstWeekWorkouts = await CreateWorkoutForWeek(profile, newPlan, firstBlock, firstWeek, null, realCompletion, weeklyAvailability ?? profile.weeklyAvailability, firstWeekObjectives);

    const newWorkouts: Workout[] = [...firstWeekWorkouts];
    const updatedWeeks = newWeeks.map((week) =>
        week.id === firstWeek.id
            ? { ...week, workoutsId: firstWeekWorkouts.map(w => w.id) }
            : week
    );

    // Sauvegarde : respecter l'ordre des FK (plan → blocks → weeks → workouts)
    try {
        await savePlan([...(Array.isArray(plan) ? plan : []), newPlan]);
        await saveBlocks([...(Array.isArray(existingBlocks) ? existingBlocks : []), ...updatedBlocks]);
        await saveWeek([...(Array.isArray(existingWeeks) ? existingWeeks : []), ...updatedWeeks]);
        await saveWorkout([...(Array.isArray(existingWorkouts) ? existingWorkouts : []), ...newWorkouts], startDate);
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
export async function CreatePlanToObjective(userID: string, planStartDate: string, weeklyAvailability?: { [key: string]: AvailabilitySlot }) {
    if (userID.length < 3) return { state: ReturnCode.RC_Error, error: 'ID utilisateur invalide' };

    try { await checkAndIncrementAICallLimit('plan'); }
    catch (e) { return { state: ReturnCode.RC_Error, error: (e as Error).message }; }

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
        userId: userID,
        blocksId: [],
        objectivesId: allObjectiveIds,
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
    newPlan.blocksId = newBlocks.map(b => b.id);

    // Créer les semaines
    const newWeeks: Week[] = [];
    const updatedBlocks = await Promise.all(
        newBlocks.map(async (block) => {
            const weeks = await CreateWeeks(newPlan, block, profile);
            newWeeks.push(...weeks);
            return { ...block, weeksId: weeks.map(w => w.id) };
        })
    );

    // Appliquer le taper par J-x (principal J-7 + secondaires J-4)
    const finalWeeks = applyTaperToWeeks(newWeeks, updatedBlocks, [primaryObjective, ...secondaryObjectives]);

    // Générer séances pour la première semaine uniquement
    const firstWeek = finalWeeks[0];
    const firstBlock = updatedBlocks.find(b => b.id === firstWeek.blockId) ?? updatedBlocks[0];

    // Trouver les objectifs de cette semaine et la suivante
    const firstWeekStart = parseISO(firstBlock.startDate);
    const firstWeekEnd = addDays(firstWeekStart, 13); // cette semaine + semaine suivante
    const relevantObjectives = [...secondaryObjectives, primaryObjective].filter(o => {
        const objDate = parseISO(o.date);
        return objDate >= firstWeekStart && objDate <= firstWeekEnd;
    });

    const existingAllWorkouts2 = await getWorkout();
    const existingAllWeeks2 = await getWeek();
    const realCompletion2 = computeAvgCompletion(existingAllWorkouts2 ?? [], existingAllWeeks2 ?? [], firstWeek.id);
    const firstWeekWorkouts = await CreateWorkoutForWeek(profile, newPlan, firstBlock, firstWeek, null, realCompletion2, weeklyAvailability ?? profile.weeklyAvailability, relevantObjectives);

    const newWorkouts: Workout[] = [...firstWeekWorkouts];
    const weeksWithWorkouts = finalWeeks.map(w =>
        w.id === firstWeek.id ? { ...w, workoutsId: firstWeekWorkouts.map(wk => wk.id) } : w
    );

    // Sauvegarde — remplace tout (aucun plan/bloc/semaine existant conservé)
    try {
        await savePlan([newPlan]);
        await saveBlocks([...updatedBlocks]);
        await saveWeek([...weeksWithWorkouts]);
        await saveWorkout([...newWorkouts], startDate);
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

    // Récupérer tout le contexte pour informer l'IA
    const [existingWorkouts, allBlocks, allObjectives] = await Promise.all([
        getWorkout(),
        getBlock(),
        getObjectives(),
    ]);
    const historySummary = getTrainingHistorySummary(existingWorkouts ?? []);
    const blocksHistory = await getCompletedBlocksHistory();
    const athleteContext = await analyzeAthleteContext(
        profile,
        existingWorkouts ?? [],
        allBlocks ?? [],
        allObjectives ?? [],
    );

    const secondaryContext = secondaryObjs.length > 0
        ? `\n## OBJECTIFS SECONDAIRES (courses intermédiaires)\n` +
          secondaryObjs.map(o => `- ${o.name} le ${o.date} (${o.sport}${o.distanceKm ? ', ' + o.distanceKm + ' km' : ''})`).join('\n') +
          `\n→ Prévoir une semaine de relâche (Taper) autour de chaque objectif secondaire.`
        : '';

    const levelMultiplier = CTL_LEVEL_MULTIPLIER[profile.experience ?? 'Intermédiaire'] ?? 1.0;

    const aiPrompt = `
Tu es un coach de ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''} certifié avec 15 ans d'expérience en périodisation (Friel, Issurin, Coggan).

## OBJECTIF PRINCIPAL
- Course : ${primaryObj.name}
- Date : ${primaryObj.date}
- Sport : ${primaryObj.sport}
${primaryObj.distanceKm ? `- Distance : ${primaryObj.distanceKm} km` : ''}
${primaryObj.elevationGainM ? `- Dénivelé : ${primaryObj.elevationGainM} m D+` : ''}
${secondaryContext}

## CONTEXTE ATHLÈTE
- Niveau : ${profile.experience ?? 'Intermédiaire'}
- Disciplines : ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''}

${athleteContext}

## HISTORIQUE DE PÉRIODISATION (BLOCS PASSÉS)
${blocksHistory}

## HISTORIQUE D'ENTRAÎNEMENT (12 DERNIÈRES SEMAINES)
${historySummary}

## STRUCTURE TEMPORELLE
${blockSkeletons.length} blocs de méso-cycles :
${blockSkeletons.map(b => `- Bloc ${b.index} : ${b.duration} semaines${b.isLast ? ' (DERNIER → semaine de course incluse)' : ''}`).join('\n')}

## PHILOSOPHIE — L'HISTORIQUE PRIME SUR LE TEMPLATE
Tu ne dois JAMAIS suivre aveuglément la progression classique Base→Build→Peak→Taper.
Ton rôle est d'analyser l'état RÉEL de l'athlète et de prescrire les blocs dont il a BESOIN.

Exemples de décisions attendues :
- Athlète en pleine saison (CTL 60+) avec base déjà faite → commencer par Build PMA, Build Seuil, ou Peak
- Athlète qui a fait beaucoup d'intensité récemment → un bloc Build volume/endurance pour rééquilibrer
- Athlète avec CTL faible après une coupure → Base nécessaire
- Athlète 4 semaines avant la course avec bonne forme → Peak puis Taper
- Plan court (≤4 semaines) → pas de Base, aller directement au spécifique

Les effets résiduels (Issurin) guident aussi :
- Base aérobie persiste 25-35j → pas besoin de la retravailler si faite dans le dernier mois
- VO2max/PMA persiste 12-18j → à retravailler régulièrement
- Seuil persiste 15-25j

## RÈGLES OBLIGATOIRES
1. Le dernier bloc DOIT être de type "Taper" (affûtage pré-course).
2. Jamais 2 blocs du même type consécutivement (alternance des stimuli — Issurin).
3. Thèmes SPÉCIFIQUES et VARIÉS selon les besoins identifiés. Exemples de thèmes : "Développement PMA", "Travail au seuil", "Force sous-max", "Spécificité course", "Sweet Spot", "Endurance musculaire", "VO2max intervalles courts", etc.
4. Prendre en compte les objectifs secondaires pour la périodisation.

## FORMAT DE RÉPONSE (JSON uniquement)
Retourner un tableau JSON. Chaque objet contient exactement :
- "index" (number) : numéro du bloc
- "type" (string) : l'un de ["Base", "Build", "Peak", "Taper"]
- "theme" (string) : focus spécifique en 3 à 6 mots (PAS juste "Build" ou "Préparation" — sois PRÉCIS sur le contenu : PMA, seuil, force, endurance musculaire, spécificité, etc.)

## LANGUE
Le champ "theme" doit être rédigé en FRANÇAIS UNIQUEMENT. Termes techniques (PMA, FTP, TSS, VO2max) autorisés.
`;

    const { data: rawBlocks, tokensUsed: tokensBlocks } = await callGeminiAPI({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    });
    await atomicIncrementTokenCount(tokensBlocks);
    if (!Array.isArray(rawBlocks)) throw new Error('Réponse IA invalide : tableau attendu.');
    const aiResponse = rawBlocks as { index: number; type: string; theme: string }[];

    let currentStartDate = start;
    let previousTargetCTL = profile.currentCTL;

    return blockSkeletons.map((skeleton) => {
        const aiInfo = aiResponse.find(b => b.index === skeleton.index);
        const blockType = aiInfo?.type ?? 'Build';

        // Calcul CTL dynamique : Taper en % au lieu de fixe, progression ajustée au niveau
        let progression: number;
        if (blockType === 'Taper') {
            progression = -Math.round(previousTargetCTL * TAPER_CTL_DROP_PERCENT);
        } else {
            progression = Math.round((CTL_PROGRESSION[blockType] ?? 8) * levelMultiplier);
        }

        const startCTL     = previousTargetCTL;
        const targetCTL    = startCTL + progression;
        const avgWeeklyTSS = Math.round(((startCTL + targetCTL) / 2) * 7);

        const block: Block = {
            id: randomUUID(),
            planId: plan.id,
            userId: plan.userId,
            orderIndex: skeleton.index,
            type:  blockType,
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
 * @function applyTaperToWeeks
 * @brief Marque comme Taper toute semaine qui contient au moins un jour dans
 *        la fenêtre d'affûtage d'un objectif (principal : J-7, secondaire : J-4).
 *        Ajuste `targetTSS` en remplaçant le TSS des jours tapés par une
 *        fraction (ratio) du TSS journalier moyen de la semaine.
 *
 *        Les règles détaillées par J-x sont dans `constants.ts`
 *        (`TAPER_RULES_PRINCIPAL` / `TAPER_RULES_SECONDARY`).
 ******************************************************************************/
function applyTaperToWeeks(
    weeks: Week[],
    blocks: Block[],
    objectives: Objective[],
): Week[] {
    if (objectives.length === 0) return weeks;

    const blockMap = new Map(blocks.map(b => [b.id, b]));

    return weeks.map(week => {
        const block = blockMap.get(week.blockId);
        if (!block) return week;

        const weekStart = addDays(parseISO(block.startDate), (week.weekNumber - 1) * 7);
        const taperPlan = buildTaperPlan(weekStart, objectives);
        if (taperPlan.size === 0) return week;

        // Recompose le TSS cible : jours normaux gardent leur quote-part,
        // jours tapés reçoivent `dailyAvg × rule.tssRatio`.
        const dailyAvg = week.targetTSS / 7;
        let newTSS = 0;
        for (let d = 0; d <= 6; d++) {
            const info = taperPlan.get(d);
            newTSS += info ? dailyAvg * info.rule.tssRatio : dailyAvg;
        }

        return {
            ...week,
            type: 'Taper' as const,
            targetTSS: Math.round(newTSS),
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
        userId: userID,
        blocksId: [],
        name: blockFocus,
        startDate,
        objectivesId: [],
        goalDate: format(goalDate, 'yyyy-MM-dd'),
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
    const start = startOfISOWeek(parseISO(plan.startDate));
    const goal  = endOfISOWeek(parseISO(plan.goalDate));
    const totalWeeks = differenceInWeeks(goal, start) + 1;

    if (totalWeeks < 1) throw new Error("Le plan est trop court !");

    const blockSkeletons = computeBlockSkeletons(totalWeeks);

    // Récupérer tout le contexte pour informer l'IA
    const [existingWorkouts, allBlocks, allObjectives] = await Promise.all([
        getWorkout(),
        getBlock(),
        getObjectives(),
    ]);
    const historySummary = getTrainingHistorySummary(existingWorkouts ?? []);
    const blocksHistory = await getCompletedBlocksHistory();
    const athleteContext = await analyzeAthleteContext(
        profile,
        existingWorkouts ?? [],
        allBlocks ?? [],
        allObjectives ?? [],
    );

    const levelMultiplier = CTL_LEVEL_MULTIPLIER[profile.experience ?? 'Intermédiaire'] ?? 1.0;

    const aiPrompt = `
Tu es un coach de ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''} certifié avec 15 ans d'expérience en périodisation (Friel, Issurin, Coggan).

## CONTEXTE ATHLÈTE
- Objectif : ${plan.macroStrategyDescription}
- Date de fin : ${plan.goalDate}
- Niveau : ${profile.experience ?? "Intermédiaire"}
- Disciplines : ${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''}

${athleteContext}

## HISTORIQUE DE PÉRIODISATION (BLOCS PASSÉS)
${blocksHistory}

## HISTORIQUE D'ENTRAÎNEMENT (12 DERNIÈRES SEMAINES)
${historySummary}

## STRUCTURE TEMPORELLE
${blockSkeletons.length} blocs de méso-cycles :
${blockSkeletons.map(b =>
    `- Bloc ${b.index} : ${b.duration} semaines${b.isLast ? " (DERNIER → inclut la semaine de course)" : ""}`
).join('\n')}

## PHILOSOPHIE — L'HISTORIQUE PRIME SUR LE TEMPLATE
Tu ne dois JAMAIS suivre aveuglément la progression classique Base→Build→Peak→Taper.
Ton rôle est d'analyser l'état RÉEL de l'athlète et de prescrire les blocs dont il a BESOIN.

Exemples de décisions attendues :
- Athlète en pleine saison (CTL 60+) avec base déjà faite → commencer par Build PMA, Build Seuil, ou Peak
- Athlète qui sort d'un bloc PMA → enchaîner avec Seuil ou Spécificité (alternance Issurin)
- Athlète avec CTL faible après coupure → Base nécessaire
- Bloc unique (1 seul bloc) → l'athlète a déjà une base, aller au spécifique (PMA, seuil, etc.)
- Plan court (≤4 semaines) → pas de Base, aller directement au travail ciblé

Les effets résiduels guident aussi :
- Base aérobie persiste 25-35j → pas besoin si faite récemment
- VO2max/PMA persiste 12-18j → à retravailler régulièrement
- Seuil persiste 15-25j

## PROFIL NIVEAU
${profile.experience === 'Débutant' ? `
⚠️ ATHLÈTE DÉBUTANT :
- Si CTL < 30, commence par un bloc Base (fondamentaux aérobies)
- Progression très graduelle (<5% de charge par semaine)
- Même débutant : si CTL ≥ 40 et historique montre une base récente, peut passer à Build` : profile.experience === 'Avancé' ? `
🏆 ATHLÈTE AVANCÉ :
- Blocs Peak, Build et Taper autorisés dès le début si la forme est là
- Périodisation polarisée recommandée (alterner volume et intensité)
- Peut supporter des blocs courts et intenses (PMA, anaérobie)` : `
📈 ATHLÈTE INTERMÉDIAIRE :
- Progression équilibrée entre volume et intensité
- Commence par Build si CTL ≥ 40 ou historique montre une base récente
- Base uniquement si CTL < 40 ET aucune base récente`}

## RÈGLES OBLIGATOIRES
1. L'historique et l'état actuel déterminent le premier bloc, PAS un template.
2. Jamais 2 blocs du même type consécutivement (alternance des stimuli).
3. Thèmes PRÉCIS et SPÉCIFIQUES. Exemples : "Développement PMA", "Travail seuil anaérobie", "Force sous-max côtes", "Sweet Spot progression", "VO2max intervalles courts", "Spécificité endurance longue", etc.
4. Si 1 seul bloc : PAS de Base sauf si CTL < 30.

## FORMAT DE RÉPONSE (JSON uniquement)
Chaque objet contient exactement :
- "index" (number) : numéro du bloc
- "type" (string) : l'un de ["Base", "Build", "Peak", "Taper"]
- "theme" (string) : focus spécifique en 3 à 6 mots

## LANGUE
Le champ "theme" doit être rédigé en FRANÇAIS UNIQUEMENT. Termes techniques (PMA, FTP, TSS, VO2max) autorisés.
`;

    const { data: rawAiResponse, tokensUsed: tokensWeeks } = await callGeminiAPI({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
        },
    });
    await atomicIncrementTokenCount(tokensWeeks);

    if (!Array.isArray(rawAiResponse)) {
        throw new Error('Réponse IA invalide : tableau attendu.');
    }
    const aiResponse = rawAiResponse as { index: number; type: string; theme: string }[];

    // Construction des blocs avec CTL dynamique
    let currentStartDate = start;
    let previousTargetCTL = profile.currentCTL;

    return blockSkeletons.map((skeleton) => {
        const aiInfo = aiResponse.find(b => b.index === skeleton.index);
        const blockType = aiInfo?.type ?? 'Build';

        // Calcul CTL dynamique : Taper en % au lieu de fixe, progression ajustée au niveau
        let progression: number;
        if (blockType === 'Taper') {
            progression = -Math.round(previousTargetCTL * TAPER_CTL_DROP_PERCENT);
        } else {
            progression = Math.round((CTL_PROGRESSION[blockType] ?? 8) * levelMultiplier);
        }

        const startCTL   = previousTargetCTL;
        const targetCTL  = startCTL + progression;
        const avgWeeklyTSS = Math.round(((startCTL + targetCTL) / 2) * 7);

        const block: Block = {
            id: randomUUID(),
            planId: plan.id,
            userId: plan.userId,
            orderIndex: skeleton.index,
            type:  blockType,
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
 *        automatiquement une semaine de récupération à 50% du TSS de départ.
 * @input
 * - plan    : Plan parent (référence)
 * - block   : Bloc parent contenant startCTL, targetCTL, weekCount et theme
 * - profile : Profil athlète (ID utilisateur, niveau...)
 * @output
 * - Week[]  : tableau de semaines ordonnées avec TSS cible, type (Load /
 *             Recovery) et thème hérité du bloc (workoutsId vide)
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
            userId: profile.id,
            workoutsId: [],
            blockId: block.id,
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
    weekObjectives?: Objective[],
): Promise<Workout[]>
{
    const weekStartDate = addDays(parseISO(block.startDate), (week.weekNumber - 1) * 7);
    const activeSports = getActiveSports(profile.activeSports);
    const formattedAvailability = formatAvailability(weeklyAvailability);

    // Plan de taper jour par jour : utilisé à la fois dans le prompt (règles J-x)
    // et après l'appel IA (pour whitelister les séances "déblocage obligatoire"
    // même si le jour n'est pas dans les dispos).
    const taperPlan = buildTaperPlan(weekStartDate, weekObjectives ?? []);

    // Récupérer le contexte de la semaine précédente pour la continuité
    const [allWorkouts, allWeeks, allBlocks] = await Promise.all([
        getWorkout(),
        getWeek(),
        getBlock(),
    ]);
    const previousWeekContext = getPreviousWeekSummary(
        allWorkouts ?? [],
        allWeeks ?? [],
        allBlocks ?? [],
        week.id,
    );

    // Zones context pour des descriptions précises
    let zonesContext = "";

    // Zones de puissance vélo
    if (profile.cycling?.Test?.zones) {
        const z = profile.cycling.Test.zones;
        zonesContext += `
## ZONES DE PUISSANCE CYCLISME (priorité n°1 pour les descriptions vélo)
- Z1 (Récupération) : < ${z.z1.max} W
- Z2 (Endurance) : ${z.z2.min}–${z.z2.max} W
- Z3 (Tempo) : ${z.z3.min}–${z.z3.max} W
- Z4 (Seuil/FTP) : ${z.z4.min}–${z.z4.max} W
- Z5 (VO2 Max) : ${z.z5.min}–${z.z5.max} W
- Z6 (Anaérobie) : ${z.z6?.min}–${z.z6?.max} W
- Z7 (Neuromusculaire) : > ${z.z7?.min} W`;
    }

    // Zones cardio (fallback vélo si pas de puissance, et pour la natation)
    if (profile.heartRate?.zones) {
        const z = profile.heartRate.zones;
        zonesContext += `
## ZONES DE FRÉQUENCE CARDIAQUE (pour natation en priorité, fallback vélo/course si pas de watts/allures)
${profile.heartRate.max ? `- FC Max : ${profile.heartRate.max} bpm` : ''}
${profile.heartRate.resting ? `- FC Repos : ${profile.heartRate.resting} bpm` : ''}
- Z1 (Récupération) : < ${z.z1.max} bpm
- Z2 (Endurance) : ${z.z2.min}–${z.z2.max} bpm
- Z3 (Tempo) : ${z.z3.min}–${z.z3.max} bpm
- Z4 (Seuil) : ${z.z4.min}–${z.z4.max} bpm
- Z5 (VO2 Max) : ${z.z5.min}–${z.z5.max} bpm`;
    } else if (profile.heartRate?.max) {
        zonesContext += `
## FRÉQUENCE CARDIAQUE (pour natation en priorité, fallback vélo/course)
- FC Max : ${profile.heartRate.max} bpm${profile.heartRate.resting ? `\n- FC Repos : ${profile.heartRate.resting} bpm` : ''}`;
    }

    // Zones d'allure course à pied (stockées en sec/km, affichées en M:SS/km)
    const fmtPace = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    if (profile.running?.Test?.zones) {
        const z = profile.running.Test.zones;
        zonesContext += `
## ZONES D'ALLURE COURSE À PIED (priorité n°1 pour les descriptions course)
- Z1 (Récupération) : ${fmtPace(z.z1.min)}–${fmtPace(z.z1.max)} /km
- Z2 (Endurance) : ${fmtPace(z.z2.min)}–${fmtPace(z.z2.max)} /km
- Z3 (Tempo) : ${fmtPace(z.z3.min)}–${fmtPace(z.z3.max)} /km
- Z4 (Seuil) : ${fmtPace(z.z4.min)}–${fmtPace(z.z4.max)} /km
- Z5 (VO2 Max) : ${fmtPace(z.z5.min)}–${fmtPace(z.z5.max)} /km`;
    } else if (profile.running?.Test?.vma) {
        zonesContext += `
## DONNÉES COURSE À PIED (priorité n°1 pour les descriptions course)
- VMA : ${profile.running.Test.vma} km/h`;
    }

    // Position dans le bloc pour guider la progression
    const weekPosition = week.weekNumber <= 1
        ? 'DÉBUT DE BLOC — introduire les séances clés, volume modéré'
        : week.weekNumber >= block.weekCount
            ? (week.type === 'Recovery' ? 'SEMAINE DE RÉCUPÉRATION — décharge' : 'FIN DE BLOC — pic de charge ou transition')
            : `MILIEU DE BLOC (S${week.weekNumber}/${block.weekCount}) — progression depuis la semaine précédente`;

   const aiPrompt = `
Tu es un coach certifié, spécialisé en ${activeSports.join(", ")}, avec 15 ans d'expérience. Tu génères la semaine ${week.weekNumber} d'un bloc de ${block.weekCount} semaines.

## LANGUE — IMPÉRATIF
**Tous les textes (title, workoutType, description) doivent être rédigés en FRANÇAIS UNIQUEMENT.** Pas d'anglais, pas de mots anglais sauf termes techniques sans équivalent français (FTP, TSS, RPE, VO2max, Z1-Z7).

## PROFIL ATHLÈTE
- Niveau : ${profile.experience ?? "Intermédiaire"}
- CTL actuelle : ${profile.currentCTL}
- Disciplines actives :${profile.activeSports.cycling ? 'cyclisme' : ''}${profile.activeSports.running ? ', course à pied' : ''}${profile.activeSports.swimming ? ', natation' : ''}
${zonesContext}

## DISPONIBILITÉS ET PROGRAMME DE LA SEMAINE — PRIORITÉ ABSOLUE
${formattedAvailability || "Non spécifiées"}

### RÈGLES DE RESPECT DU PROGRAMME (NON NÉGOCIABLE) :
- Si l'athlète a défini un SPORT et une DURÉE pour un jour (ex: "vélo 1.5h"), tu DOIS :
  · Utiliser EXACTEMENT ce sport pour ce jour (pas un autre)
  · La durée indiquée est un MAXIMUM ABSOLU — tu peux proposer MOINS (ex: 1h au lieu de 1.5h si la fatigue ou la logique d'entraînement le justifie), mais JAMAIS PLUS
  · Tu ne peux PAS ajouter un sport que l'athlète n'a pas listé ce jour-là (ex: si seul "vélo 1.5h" est prévu, pas de course ni natation ce jour)
  · Seul le TYPE de séance (Endurance, Interval, Tempo...) et le CONTENU sont à ta discrétion
- Si l'athlète a défini PLUSIEURS sports un même jour (ex: "natation 1h, vélo 0.5h"), il attend UNE séance par sport listé. Chaque séance doit respecter la durée MAX de son créneau. Tu peux réduire la durée d'un ou plusieurs sports si nécessaire.
- Les commentaires entre parenthèses (ex: "sortie club", "chill", "compétition") décrivent le contexte. Adapte le type et l'intensité en conséquence.
- SEULS les jours marqués "IA LIBRE" te donnent carte blanche : tu choisis le sport, la durée et l'intensité. Tu peux aussi décider de laisser un jour de repos complet si c'est pertinent.
- Les jours NON LISTÉS dans les disponibilités sont des jours de REPOS. Ne génère AUCUNE séance pour ces jours.
- LIBERTÉ DE RÉDUIRE : tu as toujours le droit de proposer moins de volume que prévu (durées plus courtes, suppression d'une séance secondaire) si c'est cohérent avec l'état de fatigue, la progression ou une course à venir. L'objectif est la qualité, pas de remplir les créneaux à tout prix.

${previousWeekContext}

## CONTEXTE DE LA SEMAINE
- Thème du bloc : ${block.theme}
- Type de bloc : ${block.type}
- Type de semaine : ${week.type}
- TSS cible total : ${week.targetTSS}
- Semaine n°${week.weekNumber} / ${block.weekCount}
- Position : ${weekPosition}
${userComment ? `- Commentaire athlète : "${userComment}"` : ""}
- Complétion des 4 dernières semaines : ${avgCompletion}%
${avgCompletion < 80 ? `- ⚠️ Complétion faible (${avgCompletion}%) : l'athlète ne termine pas ses semaines. RÉDUIRE l'intensité et le volume. Proposer des séances réalistes et atteignables plutôt qu'ambitieuses.` : ""}
${avgCompletion >= 80 && avgCompletion <= 95 ? `- ✔️ Complétion correcte (${avgCompletion}%) : maintenir la progression normale.` : ""}
${avgCompletion > 95 ? `- ✅ Complétion excellente (${avgCompletion}%) : l'athlète absorbe bien la charge. Peut progresser normalement.` : ""}

## RÈGLES DE PROGRESSION ET CONTINUITÉ (CRUCIAL)
Tu DOIS construire cette semaine en continuité avec la semaine précédente. Chaque semaine n'est pas indépendante — c'est une étape dans une progression.

### Séances clés vs séances secondaires
Chaque semaine contient 2-3 SÉANCES CLÉS qui portent l'adaptation :
1. La séance d'intervalles principale (cible du bloc : PMA, seuil, VO2max, etc.)
2. La sortie longue (endurance fondamentale)
3. Optionnel : une 2ème séance d'intensité
Les autres séances sont SECONDAIRES (endurance facile Z1-Z2, récupération). Si l'athlète doit manquer une séance, ce sont celles-là qu'il saute.

### Progression des séances clés semaine après semaine
${week.type === 'Recovery' ? `
⚠️ SEMAINE DE RÉCUPÉRATION (modèle Friel en 2 phases) :
- Jours 1-3 : Intensité Z1 uniquement. Séances courtes. Peut inclure 1 jour de repos complet.
- Jours 4-6 : Réintroduire 1-2 touches d'intensité COURTES (ex: 4x2min au seuil dans une séance de 45min).
- Volume global : 40-60% du pic de la semaine précédente.
- Maintenir la fréquence (nombre de séances similaire) mais réduire drastiquement la durée.
- PAS de sortie longue. Max 60-75% de la durée de la sortie longue précédente.` : `
PROGRESSION DE CHARGE (semaine de type ${week.type}) :
- Sortie longue : ${week.weekNumber === 1 ? 'établir la durée de base' : 'augmenter de 15-30 min par rapport à la semaine précédente (dans la limite de la dispo du jour)'}.
- Intervalles : progresser via UNE seule variable à la fois :
  · OPTION A : +1 répétition (ex: 4x5min → 5x5min)
  · OPTION B : +1min de durée par intervalle (ex: 4x5min → 4x6min)
  · OPTION C : -1min de repos entre les intervalles
  · NE JAMAIS augmenter intensité + volume + réduire repos en même temps.
- L'intensité (zones/watts) reste dans la MÊME zone que la semaine précédente. C'est le volume de travail qui augmente.
- PLACEMENT DES SÉANCES CLÉS : respecter le programme de l'athlète en priorité. Placer la séance d'intervalles sur un jour où l'athlète a prévu un créneau suffisant (≥1h). Placer la sortie longue sur le créneau le plus long de la semaine. Si un jour est marqué "IA LIBRE", il peut servir à placer une séance clé manquante.
- Alterner SYSTÉMATIQUEMENT : jour dur → jour facile → jour dur (dans les limites du programme défini).`}

${(() => {
    if (!weekObjectives || weekObjectives.length === 0) return '';

    // Principal : fenêtre J-7 / Secondaire : fenêtre J-4.
    // Pour chaque jour (0=Lundi...6=Dimanche) qui tombe dans une fenêtre, on a
    // une règle précise (intensité, volume, déblocage obligatoire, etc.).
    if (taperPlan.size === 0) {
        // Objectifs présents mais tous hors fenêtre J-x : juste mentionner pour l'IA
        const lines: string[] = [];
        lines.push('## 🏁 COURSES À VENIR (hors fenêtre de taper cette semaine — pas d\'affûtage actif)');
        lines.push(weekObjectives.map(o =>
            `- ${o.name} le ${o.date} (${o.sport}, priorité : ${o.priority})`
        ).join('\n'));
        return lines.join('\n');
    }

    const dayNamesFR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

    // Objectifs uniques présents dans la fenêtre (pour les annoncer en tête)
    const objectivesInWindow = new Map<string, { name: string; date: string; sport: string; priority: string }>();
    for (const info of taperPlan.values()) {
        if (!objectivesInWindow.has(info.objectiveName + info.objectiveDate)) {
            objectivesInWindow.set(info.objectiveName + info.objectiveDate, {
                name:     info.objectiveName,
                date:     info.objectiveDate,
                sport:    info.objectiveSport,
                priority: info.priority,
            });
        }
    }

    const hasMandatory = Array.from(taperPlan.values()).some(i => i.rule.mandatory);

    const lines: string[] = [];
    lines.push('## ⚠️ AFFÛTAGE PRÉ-COURSE (J-x) — RÈGLES IMPÉRATIVES, PRIORITÉ ABSOLUE');
    lines.push('');
    lines.push('COURSES DANS LA FENÊTRE DE TAPER :');
    for (const o of objectivesInWindow.values()) {
        lines.push(`- 🏁 ${o.name} le ${o.date} (${o.sport}) — priorité : ${o.priority}`);
    }
    lines.push('');
    lines.push('PRINCIPE GÉNÉRAL DU TAPER (Mujika / Friel / Coggan) :');
    lines.push('- On réduit le VOLUME.');
    lines.push('- On GARDE l\'intensité sur des séances COURTES pour conserver le rythme et le neuromusculaire.');
    lines.push('- On garde la fréquence (nombre de séances) si possible.');
    lines.push('- Aucune sortie longue dans la fenêtre de taper. Aucune séance épuisante.');
    lines.push('');
    lines.push('RÈGLES JOUR PAR JOUR (ces règles ÉCRASENT toute autre logique de progression pour les jours concernés) :');
    for (let d = 0; d <= 6; d++) {
        const info = taperPlan.get(d);
        if (!info) continue;
        const mark = info.rule.mandatory ? ' [OBLIGATOIRE]' : '';
        lines.push(`- **${dayNamesFR[d]} (dayOffset=${d}) — ${info.rule.label}${mark}** — ${info.rule.promptInstruction} Durée max ${info.rule.maxDurationMin} min. Course cible : ${info.objectiveName} (${info.objectiveSport}).`);
    }
    lines.push('');
    if (hasMandatory) {
        lines.push('⚠️ JOUR(S) OBLIGATOIRE(S) : la ou les séances marquées [OBLIGATOIRE] DOIVENT être incluses dans la réponse JSON, MÊME SI le jour n\'apparaît pas dans les disponibilités de l\'athlète ou est marqué "repos". Le sport à utiliser est celui de la course cible indiquée pour ce jour.');
        lines.push('');
    }
    lines.push('Les autres jours de la semaine (ceux hors fenêtre de taper, s\'il y en a) suivent les règles normales de la semaine mais sans ajouter de charge lourde.');

    return lines.join('\n');
})()}

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
1. RESPECTER LE PROGRAMME : chaque jour a un sport et une durée définis par l'athlète. Utilise CE sport et cette durée comme MAXIMUM. Tu ne choisis que le contenu (type, intensité, structure). Les jours IA LIBRE sont les seuls où tu as le choix du sport/durée.
2. Répartir les séances UNIQUEMENT sur les disciplines actives : ${activeSports.join(", ")}. Ne jamais proposer un sport que l'athlète n'a pas activé, et ne jamais ajouter un sport sur un jour où il n'est pas prévu (sauf jours IA LIBRE).
3. DURÉE = PLAFOND : la durationMinutes d'une séance ne doit JAMAIS dépasser la durée indiquée dans les disponibilités pour ce sport ce jour-là. Elle peut être inférieure si la logique d'entraînement le justifie.
4. La somme des plannedTSS doit approcher ${week.targetTSS} (±10%). Si tu réduis des séances, le TSS total peut être inférieur — c'est acceptable.
5. Respecter le thème "${block.theme}" dans le choix des types de séances.
6. Ne pas placer 2 séances dures (Interval, Tempo) consécutives. TOUJOURS alterner dur/facile.
7. dayOffset doit correspondre exactement au jour disponible (0=Lundi ... 6=Dimanche).
8. Exactement UNE séance par sport par créneau (si "vélo 1.5h" → 1 séance vélo). Jours non listés = repos, pas de séance. Jours LIBRE = repos possible si pertinent.
9. La "description" doit être précise, technique, structurée (échauffement, corps de séance, retour au calme).
   Métrique PRIORITAIRE par sport :
   - VÉLO : WATTS/zones de puissance en priorité. Fallback : FC. Dernier recours : RPE.
   - COURSE : ALLURES (min/km) en priorité. Fallback : FC. Dernier recours : RPE.
   - NATATION : distance (mètres) + allure /100m. Fallback : FC. Dernier recours : RPE.

10. **NATATION — RÈGLES SPÉCIFIQUES (IMPÉRATIVES)** :
    a) **Volume en MÈTRES, pas en minutes.** Exprime toujours les séries sous forme "NxDm" (ex: "8x50m", "4x200m"). Indique le volume total de la séance en mètres dans la description.
    b) **Nage obligatoire** pour chaque série : précise la nage principale — crawl / dos / brasse / papillon / 4 nages / mixte.
    c) **Matériel obligatoire quand pertinent** : planche, pull-buoy, palmes, plaquettes, tuba frontal, élastique. Ne mets pas de matériel si non pertinent.
    d) **Récup natation** : toujours exprimée en secondes de repos au bord (ex: "10'' R" = 10 secondes récup entre deux répétitions), PAS en minutes ou en mètres.
    e) **ÉDUCATIFS / TECHNIQUE — INTERDIT D'ÊTRE VAGUE** : si tu programmes du travail technique, tu DOIS nommer explicitement les éducatifs. "Exercice technique", "travail technique", "drills" seuls sont INTERDITS. Utilise le vocabulaire de la natation :
       · Rattrapage (crawl — main avant attend que l'autre la rejoigne)
       · 6 temps / 3 temps (crawl — respiration tous les N coups)
       · Manchot (1 bras, l'autre le long du corps)
       · Catch-up (équivalent rattrapage en anglais)
       · Zip-up / Fermeture éclair (main remonte le long du corps)
       · Polo crawl (tête hors de l'eau)
       · Profil / Side kick (jambes sur le côté, 1 bras tendu)
       · Superman (2 bras tendus devant, jambes seules)
       · Sculls / Godillage (mouvement horizontal des mains, appuis)
       · Poings fermés (forcer l'appui avant-bras)
       · Jambes avec planche, jambes sans planche (position hydrodynamique)
       · Éducatif dos : rotation épaules, 6 battements 1 bras, etc.
       · Éducatif brasse : 2 coulées 1 bras, brasse jambes planche, etc.
    f) **Structure type natation** : Échauffement 300-600m varié (mixte, souvent crawl + dos + brasse) → éventuellement bloc technique avec éducatifs NOMMÉS → corps principal (série avec intensité et récups explicites) → Retour au calme 100-300m souple.
    g) **Exemple de description BIEN rédigée** :
       "Échauffement 400m : 200m crawl souple + 4x50m (25m poings fermés / 25m normal) crawl, 10'' R.
        Technique 8x50m éducatifs, 15'' R : 2x50m Rattrapage + 2x50m 6 temps + 2x50m Manchot (1 bras droit, 1 bras gauche) + 2x50m crawl normal sensation de glisse.
        Série principale 6x100m crawl à allure seuil (1'40''/100m), 20'' R.
        Retour au calme 200m dos souple."
    h) **Exemple de description MAUVAISE (à éviter)** :
       "400m échauffement. Exercice technique 400m. 6x100m crawl. 200m cool." ← trop vague sur la technique, pas de matériel, pas de récup explicite.

## FORMAT DE RÉPONSE
Réponds UNIQUEMENT avec un tableau JSON valide — sans markdown, sans explication.
Chaque objet contient exactement :
- "dayOffset"       (number) : 0=Lundi, 6=Dimanche
- "sportType"       (string) : l'un de ${activeSports.join(", ")}
- "title"           (string) : titre court (ex: "Endurance Z2 vélo")
- "workoutType"     (string) : l'un de ["Endurance", "Tempo", "Interval", "Recovery", "Long", "Strength"]
- "durationMinutes" (number) : durée totale en minutes (respecter le max du créneau)
- "plannedTSS"      (number) : TSS prévu pour cette séance
- "description"     (string) : description technique complète (échauffement, corps, retour au calme, avec valeurs de zones/watts)

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

    const { data: rawWorkouts, tokensUsed: tokensWorkouts } = await callGeminiAPI({
        contents: [{ parts: [{ text: aiPrompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseSchema,
        },
    });
    await atomicIncrementTokenCount(tokensWorkouts);
    if (!Array.isArray(rawWorkouts)) throw new Error('Réponse IA invalide : tableau attendu.');

    console.log(`[CreateWorkoutForWeek] 📥 ${rawWorkouts.length} séance(s) reçue(s) de l'IA (semaine ${week.weekNumber})`);
    (rawWorkouts as AIWorkout[]).forEach((w, i) => {
        const descPreview = (w.description ?? '').slice(0, 120).replace(/\n/g, ' ');
        const isNA = !w.description || /^\s*(N\/?A|—|-+)\s*$/i.test(w.description);
        console.log(
            `  [${i}] day=${w.dayOffset} sport=${w.sportType} dur=${w.durationMinutes}min type=${w.workoutType}` +
            `${isNA ? ' ⚠️ DESCRIPTION VIDE/N/A' : ''}\n     desc: "${descPreview}${(w.description ?? '').length > 120 ? '…' : ''}"`
        );
    });

    // ── Validation post-IA : filtrer / capper les séances hors programme ──
    const allowedSlots = buildAllowedSlots(weeklyAvailability, activeSports);
    const aiResponse = (rawWorkouts as AIWorkout[]).filter((w) => {
        const taperInfo = taperPlan.get(w.dayOffset);
        // Exception "déblocage obligatoire" : on laisse passer quel que soit le
        // programme de dispo, à condition que le sport corresponde à la course.
        if (taperInfo?.rule.mandatory && w.sportType === taperInfo.objectiveSport) {
            if (w.durationMinutes > taperInfo.rule.maxDurationMin) {
                w.durationMinutes = taperInfo.rule.maxDurationMin;
            }
            return true;
        }

        const dayRule = allowedSlots.get(w.dayOffset);
        // Jour non autorisé → supprimer la séance
        if (!dayRule) {
            console.log(`[CreateWorkoutForWeek] 🚫 filtrée (jour ${w.dayOffset} non autorisé)`);
            return false;
        }
        // Sport non prévu ce jour → supprimer
        if (!dayRule.sports.has(w.sportType)) {
            console.log(`[CreateWorkoutForWeek] 🚫 filtrée (sport ${w.sportType} non prévu jour ${w.dayOffset})`);
            return false;
        }
        // Capper la durée au maximum autorisé (si défini)
        const maxMin = dayRule.maxMinutes[w.sportType];
        if (maxMin != null && w.durationMinutes > maxMin) {
            w.durationMinutes = maxMin;
        }
        // Cap supplémentaire si le jour est dans la fenêtre de taper (non-mandatory)
        if (taperInfo && w.durationMinutes > taperInfo.rule.maxDurationMin) {
            w.durationMinutes = taperInfo.rule.maxDurationMin;
        }
        return true;
    });

    console.log(`[CreateWorkoutForWeek] ✂️ ${aiResponse.length} séance(s) conservée(s) après filtrage`);

    // Structuration en parallèle des descriptions via un second appel IA.
    // Échec individuel → structure: [] (la séance reste utilisable avec sa description).
    const structuredWorkouts = await Promise.all(
        aiResponse.map(async (w) => {
            const { structure, tokensUsed } = await structureSessionDescription({
                description: w.description,
                sportType: w.sportType,
                durationMinutes: w.durationMinutes,
                profile,
            });
            return { w, structure, tokensUsed };
        })
    );

    const totalStructureTokens = structuredWorkouts.reduce((s, x) => s + x.tokensUsed, 0);
    if (totalStructureTokens > 0) await atomicIncrementTokenCount(totalStructureTokens);

    return structuredWorkouts.map(({ w, structure }) => {
        const workoutDate = addDays(weekStartDate, w.dayOffset);
        const wId = randomUUID();
        return {
            id:          wId,
            userId:      profile.id,
            weekId:      week.id,
            date:        format(workoutDate, 'yyyy-MM-dd'),
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
                structure,
            },
            completedData: null,
        } satisfies Workout;
    });
}






















// --- Helpers ---

/**
 * Résumé compact de l'historique récent pour informer la génération des blocs.
 * Retourne les 12 dernières semaines : volume, sports, types d'entraînement.
 * Permet à l'IA de comprendre la trajectoire d'entraînement complète de l'athlète.
 */
function getTrainingHistorySummary(workouts: Workout[]): string {
    const completed = workouts
        .filter(w => w.status === 'completed' && w.completedData)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (completed.length === 0) return "Aucun historique d'entraînement disponible — l'athlète débute ou n'a pas de données.";

    // Regrouper par semaine (12 dernières)
    const weekMap = new Map<string, Workout[]>();
    for (const w of completed) {
        const d = new Date(w.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = format(weekStart, 'yyyy-MM-dd');
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key)!.push(w);
    }

    const recentWeeks = [...weekMap.entries()].slice(0, 12);
    if (recentWeeks.length === 0) return "Aucun historique récent.";

    const lines = recentWeeks.map(([weekOf, wks]) => {
        const sportCount: Record<string, number> = {};
        const typeCount: Record<string, number> = {};
        let totalDuration = 0;
        let totalTSS = 0;

        for (const w of wks) {
            sportCount[w.sportType] = (sportCount[w.sportType] || 0) + 1;
            typeCount[w.workoutType || 'Autre'] = (typeCount[w.workoutType || 'Autre'] || 0) + 1;
            totalDuration += w.completedData?.actualDurationMinutes || 0;
            totalTSS += w.completedData?.metrics?.cycling?.tss || 0;
        }

        const sports = Object.entries(sportCount).map(([s, n]) => `${s}(${n})`).join(', ');
        const types = Object.entries(typeCount).map(([t, n]) => `${t}(${n})`).join(', ');
        const hours = (totalDuration / 60).toFixed(1);

        return `- Semaine du ${weekOf} : ${wks.length} séances | ${hours}h | TSS ${totalTSS} | Sports: ${sports} | Types: ${types}`;
    });

    // Résumé global de la tendance
    const totalWeeksWithData = recentWeeks.length;
    const allTSS = recentWeeks.map(([, wks]) => wks.reduce((sum, w) => sum + (w.completedData?.metrics?.cycling?.tss || 0), 0));
    const avgTSS = Math.round(allTSS.reduce((a, b) => a + b, 0) / totalWeeksWithData);
    const tssFirst4 = allTSS.slice(0, Math.min(4, allTSS.length));
    const tssLast4 = allTSS.slice(Math.max(0, allTSS.length - 4));
    const avgRecent = Math.round(tssFirst4.reduce((a, b) => a + b, 0) / tssFirst4.length);
    const avgOlder = Math.round(tssLast4.reduce((a, b) => a + b, 0) / tssLast4.length);
    const trend = avgRecent > avgOlder * 1.1 ? '📈 en progression' : avgRecent < avgOlder * 0.9 ? '📉 en baisse' : '➡️ stable';

    return `TENDANCE SUR ${totalWeeksWithData} SEMAINES : TSS moyen ${avgTSS}/sem | Charge récente vs ancienne : ${trend}\n\n` + lines.join('\n');
}

/**
 * Analyse les blocs d'entraînement déjà complétés pour informer l'IA
 * des phases de périodisation déjà effectuées par l'athlète.
 * Évite de reproposer une phase Base quand l'athlète est en pleine saison.
 */
async function getCompletedBlocksHistory(): Promise<string> {
    const [plans, blocks] = await Promise.all([getPlan(), getBlock()]);
    if (!plans || plans.length === 0 || !blocks || blocks.length === 0) {
        return "Aucun plan précédent — l'athlète n'a pas d'historique de périodisation.";
    }

    // Trier les blocs par date de début (plus récent en premier)
    const sortedBlocks = [...blocks].sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    const today = new Date();
    const lines = sortedBlocks.map(block => {
        const blockEnd = addWeeks(parseISO(block.startDate), block.weekCount);
        const isPast = today > blockEnd;
        const isCurrent = today >= parseISO(block.startDate) && today <= blockEnd;
        const status = isCurrent ? '🔵 EN COURS' : isPast ? '✅ TERMINÉ' : '⏳ À VENIR';
        const plan = plans.find(p => p.id === block.planId);
        return `- [${status}] ${block.type} — "${block.theme}" (${block.weekCount} sem, du ${block.startDate}) | CTL: ${block.startCTL}→${block.targetCTL} | Plan: ${plan?.name ?? 'N/A'}`;
    });

    // Résumé des phases complétées
    const completedTypes = sortedBlocks
        .filter(b => today > addWeeks(parseISO(b.startDate), b.weekCount))
        .map(b => b.type);
    const typeCounts = completedTypes.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
    const summary = Object.entries(typeCounts).map(([t, n]) => `${t}(${n}x)`).join(', ');

    return `PHASES DÉJÀ RÉALISÉES : ${summary || 'aucune'}\n\n${lines.join('\n')}`;
}

/**
 * Analyse complète du contexte de l'athlète pour guider la génération de plan.
 * Basé sur les méthodologies de Friel, Coggan/Allen, Issurin (block periodization).
 *
 * Détermine :
 * - Si l'athlète est en pré-saison, pleine saison, ou fin de saison
 * - Quelles qualités physiques ont encore un effet résiduel actif
 * - Quel type de bloc est recommandé en priorité
 * - Ce qu'il faut ÉVITER de reproposer
 */
async function analyzeAthleteContext(
    profile: Profile,
    workouts: Workout[],
    blocks: Block[],
    objectives: Objective[]
): Promise<string> {
    const today = new Date();
    const lines: string[] = [];

    // --- 1. Niveau de forme actuel ---
    const ctl = profile.currentCTL;
    const atl = profile.currentATL;
    const tsb = ctl - atl;
    let fitnessState = '';
    if (ctl >= 80) fitnessState = 'Excellent — athlète très entraîné, pleine saison';
    else if (ctl >= 60) fitnessState = 'Bon — base solide construite, prêt pour intensité';
    else if (ctl >= 40) fitnessState = 'Modéré — condition correcte, peut encore construire';
    else fitnessState = 'Faible — besoin de reconstruire une base aérobie';

    let fatigueState = '';
    if (tsb < -30) fatigueState = '⚠️ SURCHARGE — TSB très négatif, récupération prioritaire';
    else if (tsb < -15) fatigueState = 'Fatigue accumulée — attention à la charge';
    else if (tsb > 15) fatigueState = 'Très reposé — peut absorber de la charge';
    else fatigueState = 'Équilibre correct';

    lines.push(`## ÉTAT DE FORME ACTUEL`);
    lines.push(`- CTL: ${ctl} | ATL: ${atl} | TSB (forme): ${tsb}`);
    lines.push(`- Condition : ${fitnessState}`);
    lines.push(`- Fatigue : ${fatigueState}`);

    // --- 2. Analyse des effets résiduels ---
    const completed = workouts
        .filter(w => w.status === 'completed' && w.completedData)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const recentTypeMap: Record<string, Date> = {};
    for (const w of completed) {
        const type = w.workoutType || 'Autre';
        if (!recentTypeMap[type]) {
            recentTypeMap[type] = new Date(w.date);
        }
    }

    lines.push(`\n## EFFETS RÉSIDUELS (dernière séance par type)`);
    for (const [type, lastDate] of Object.entries(recentTypeMap)) {
        const daysAgo = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        const residual = RESIDUAL_EFFECTS_DAYS[type] ?? 20;
        const stillActive = daysAgo <= residual;
        const status = stillActive
            ? `✅ Actif (fait il y a ${daysAgo}j, effet résiduel ${residual}j)`
            : `❌ Expiré (fait il y a ${daysAgo}j, effet résiduel ${residual}j) → à retravailler`;
        lines.push(`- ${type} : ${status}`);
    }

    // --- 3. Répartition récente intensité/volume (4 dernières semaines) ---
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const recentWorkouts = completed.filter(w => new Date(w.date) >= fourWeeksAgo);

    if (recentWorkouts.length > 0) {
        const intensityCount = recentWorkouts.filter(w =>
            ['Interval', 'Tempo', 'Sprint'].includes(w.workoutType || '')
        ).length;
        const enduranceCount = recentWorkouts.filter(w =>
            ['Endurance', 'Long', 'Recovery'].includes(w.workoutType || '')
        ).length;
        const total = recentWorkouts.length;
        const intensityPct = Math.round((intensityCount / total) * 100);
        const endurancePct = Math.round((enduranceCount / total) * 100);

        lines.push(`\n## RÉPARTITION RÉCENTE (4 dernières semaines)`);
        lines.push(`- ${total} séances : ${intensityPct}% intensité (${intensityCount}) | ${endurancePct}% endurance/récup (${enduranceCount})`);

        if (intensityPct > 30) {
            lines.push(`→ Beaucoup d'intensité récemment — envisager un bloc plus aérobie ou de récupération`);
        } else if (intensityPct < 15) {
            lines.push(`→ Peu d'intensité récemment — l'athlète peut bénéficier d'un bloc PMA/seuil/intervalles`);
        } else {
            lines.push(`→ Distribution équilibrée — adapter selon l'objectif`);
        }
    }

    // --- 4. Analyse des blocs passés récents ---
    const recentBlocks = blocks
        .filter(b => today > addWeeks(parseISO(b.startDate), b.weekCount))
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .slice(0, 3);

    if (recentBlocks.length > 0) {
        const lastBlock = recentBlocks[0];
        const daysSinceLastBlock = Math.round(
            (today.getTime() - addWeeks(parseISO(lastBlock.startDate), lastBlock.weekCount).getTime()) / (1000 * 60 * 60 * 24)
        );

        lines.push(`\n## DERNIER BLOC TERMINÉ`);
        lines.push(`- Type: ${lastBlock.type} — "${lastBlock.theme}"`);
        lines.push(`- Terminé il y a ${daysSinceLastBlock} jours`);
        lines.push(`- CTL: ${lastBlock.startCTL} → ${lastBlock.targetCTL}`);

        // Règle d'alternance (Issurin) : ne pas répéter le même type
        lines.push(`→ RÈGLE D'ALTERNANCE : ne PAS enchaîner avec un bloc "${lastBlock.type}" identique. Alterner les stimuli.`);
    }

    // --- 5. Recommandation de phase ---
    lines.push(`\n## RECOMMANDATION CONTEXTUELLE`);

    const nextObjective = objectives
        .filter(o => new Date(o.date) > today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    if (nextObjective) {
        const daysToRace = Math.round((new Date(nextObjective.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToRace <= 14) {
            lines.push(`→ Course dans ${daysToRace} jours : TAPER / AFFÛTAGE obligatoire`);
        } else if (daysToRace <= 28) {
            lines.push(`→ Course dans ${daysToRace} jours : PEAK (intensité ciblée, volume réduit)`);
        } else {
            lines.push(`→ Course dans ${daysToRace} jours : temps suffisant pour un bloc de développement`);
        }
    }

    if (tsb < -30) {
        lines.push(`→ PRIORITÉ : bloc de RÉCUPÉRATION (TSB = ${tsb}, seuil critique dépassé)`);
    } else if (ctl >= 60) {
        lines.push(`→ Base aérobie DÉJÀ CONSTRUITE (CTL ${ctl}). NE PAS reproposer de bloc Base/Endurance.`);
        lines.push(`→ Privilégier : Build intensité (PMA, seuil, VO2max), Peak, ou Spécificité course.`);
    } else if (ctl >= 40) {
        lines.push(`→ Condition correcte. Selon l'historique, un bloc Build ou Base court est approprié.`);
    } else {
        lines.push(`→ CTL faible (${ctl}). Un bloc Base/Accumulation est nécessaire pour reconstruire.`);
    }

    return lines.join('\n');
}

/**
 * Calcule le taux de complétion moyen des 4 dernières semaines.
 * Remplace le hardcoded 100 pour donner un feedback réel à l'IA.
 */
function computeAvgCompletion(workouts: Workout[], weeks: Week[], currentWeekId: string): number {
    // Trouver les 4 semaines précédant la semaine courante
    const currentWeek = weeks.find(w => w.id === currentWeekId);
    if (!currentWeek) return 100;

    const previousWeeks = weeks
        .filter(w => w.id !== currentWeekId && w.weekNumber < currentWeek.weekNumber)
        .sort((a, b) => b.weekNumber - a.weekNumber)
        .slice(0, 4);

    if (previousWeeks.length === 0) return 100;

    const completionRates = previousWeeks.map(week => {
        const weekWorkouts = workouts.filter(w => w.weekId === week.id);
        if (weekWorkouts.length === 0) return 100;
        const completed = weekWorkouts.filter(w => w.status === 'completed').length;
        return Math.round((completed / weekWorkouts.length) * 100);
    });

    return Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length);
}

/**
 * Résumé de la semaine précédente pour guider la continuité.
 * Donne à l'IA le contexte de ce que l'athlète a réellement fait :
 * TSS réel vs planifié, RPE, types de séances, durée sortie longue.
 */
function getPreviousWeekSummary(
    workouts: Workout[],
    weeks: Week[],
    blocks: Block[],
    currentWeekId: string
): string {
    const currentWeek = weeks.find(w => w.id === currentWeekId);
    if (!currentWeek) return "Aucune semaine précédente disponible.";

    // Chercher la semaine juste avant (même bloc ou bloc précédent)
    const allWeeksSorted = weeks
        .filter(w => w.id !== currentWeekId)
        .sort((a, b) => {
            const blockA = blocks.find(bl => bl.id === a.blockId);
            const blockB = blocks.find(bl => bl.id === b.blockId);
            if (!blockA || !blockB) return 0;
            if (blockA.orderIndex !== blockB.orderIndex) return blockB.orderIndex - blockA.orderIndex;
            return b.weekNumber - a.weekNumber;
        });

    const prevWeek = allWeeksSorted[0];
    if (!prevWeek) return "Première semaine du plan — pas de semaine précédente.";

    const prevWorkouts = workouts.filter(w => w.weekId === prevWeek.id);
    const completedWorkouts = prevWorkouts.filter(w => w.status === 'completed' && w.completedData);
    const missedWorkouts = prevWorkouts.filter(w => w.status === 'missed' || (w.status === 'pending' && new Date(w.date) < new Date()));

    if (completedWorkouts.length === 0 && missedWorkouts.length === 0) {
        return "Semaine précédente sans données de complétion.";
    }

    const lines: string[] = [];
    const prevBlock = blocks.find(b => b.id === prevWeek.blockId);

    lines.push(`## SEMAINE PRÉCÉDENTE (S${prevWeek.weekNumber}${prevBlock ? ` — ${prevBlock.type} "${prevBlock.theme}"` : ''})`);

    // TSS réel vs planifié
    const actualTSS = completedWorkouts.reduce((sum, w) => {
        const cd = w.completedData!;
        return sum + (cd.metrics?.cycling?.tss ?? cd.calculatedTSS ?? w.plannedData?.plannedTSS ?? 0);
    }, 0);
    const plannedTSS = prevWorkouts.reduce((sum, w) => sum + (w.plannedData?.plannedTSS ?? 0), 0);
    const tssRatio = plannedTSS > 0 ? Math.round((actualTSS / plannedTSS) * 100) : 0;

    lines.push(`- TSS : ${actualTSS} réalisé / ${plannedTSS} planifié (${tssRatio}%)`);
    lines.push(`- Complétion : ${completedWorkouts.length}/${prevWorkouts.length} séances (${missedWorkouts.length} manquées)`);

    // RPE moyen
    const rpeValues = completedWorkouts
        .map(w => w.completedData?.perceivedEffort)
        .filter((rpe): rpe is number => rpe != null && rpe > 0);
    if (rpeValues.length > 0) {
        const avgRPE = (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1);
        lines.push(`- RPE moyen : ${avgRPE}/10${Number(avgRPE) >= 8 ? ' ⚠️ FATIGUE ÉLEVÉE' : ''}`);
    }

    // Détail des séances complétées (pour continuité)
    if (completedWorkouts.length > 0) {
        lines.push(`- Séances réalisées :`);
        for (const w of completedWorkouts) {
            const cd = w.completedData!;
            const duration = cd.actualDurationMinutes;
            const tss = cd.metrics?.cycling?.tss ?? cd.calculatedTSS ?? w.plannedData?.plannedTSS ?? 0;
            const rpe = cd.perceivedEffort ? ` | RPE ${cd.perceivedEffort}/10` : '';
            lines.push(`  · ${w.sportType} ${w.workoutType} — ${duration}min | TSS ${tss}${rpe} | "${w.title}"`);
        }

        // Identifier la sortie longue pour la progression
        const longWorkout = completedWorkouts
            .filter(w => w.workoutType === 'Long' || w.workoutType === 'Endurance')
            .sort((a, b) => (b.completedData?.actualDurationMinutes ?? 0) - (a.completedData?.actualDurationMinutes ?? 0))[0];

        if (longWorkout) {
            lines.push(`- Sortie longue de la semaine : ${longWorkout.completedData?.actualDurationMinutes}min (${longWorkout.sportType})`);
            lines.push(`  → CETTE SEMAINE : augmenter de 15-30min si semaine de charge, réduire de 50% si semaine de récup`);
        }

        // Identifier les séances d'intervalles pour la progression
        const intervalWorkouts = completedWorkouts.filter(w =>
            w.workoutType === 'Interval' || w.workoutType === 'Tempo'
        );
        if (intervalWorkouts.length > 0) {
            lines.push(`- Séances intensité réalisées : ${intervalWorkouts.length}`);
            for (const iw of intervalWorkouts) {
                lines.push(`  · "${iw.title}" — ${iw.completedData?.actualDurationMinutes}min`);
            }
            lines.push(`  → CETTE SEMAINE : progresser en ajoutant 1 rep OU en allongeant les intervalles OU en réduisant le repos`);
        }
    }

    // Analyse de l'écart TSS
    if (tssRatio > 110) {
        lines.push(`\n⚠️ L'athlète a DÉPASSÉ le TSS planifié de ${tssRatio - 100}%. Vérifier que la charge cette semaine ne s'accumule pas excessivement (ACWR < 1.3).`);
    } else if (tssRatio < 70) {
        lines.push(`\n⚠️ L'athlète n'a réalisé que ${tssRatio}% du TSS planifié. Adapter cette semaine : ne pas surcharger, progresser depuis le TSS RÉEL (${actualTSS}), pas le planifié.`);
    }

    return lines.join('\n');
}

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

export async function saveThemePreference(theme: 'dark' | 'light') {
    await saveTheme(theme);
}


// Création d'une séance planifiée via l'IA
export async function createPlannedWorkoutAI(
    dateStr: string,
    sportType: SportType,
    durationMinutes: number,
    comment: string,
) {
    await checkAndIncrementAICallLimit('workout');

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();
    if (!existingProfile) throw new Error("Profil manquant");

    const history = getRecentPerformanceHistory(existingSchedule);
    const surroundingWorkouts = getSurroundingWorkouts(existingSchedule, dateStr);

    const instruction = [
        `Sport: ${sportType}`,
        `Durée cible: ${durationMinutes} min`,
        comment ? `Thème: ${comment}` : '',
    ].filter(Boolean).join('. ');

    try {
        const { workout: newWorkoutData, tokensUsed: tkCreate } = await generateSingleWorkoutFromAI(
            existingProfile,
            history,
            dateStr,
            sportType,
            surroundingWorkouts,
            undefined,
            "General Fitness",
            instruction,
        );
        if (tkCreate > 0) await atomicIncrementTokenCount(tkCreate);

        const workout: Workout = {
            ...newWorkoutData,
            id: randomUUID(),
            userId: existingProfile.id,
            weekId: '',
            date: dateStr,
            sportType,
            status: 'pending',
            completedData: null,
        };

        // Forcer la durée demandée si l'IA s'en écarte
        if (workout.plannedData) {
            workout.plannedData.durationMinutes = durationMinutes;
        }

        await insertSingleWorkout(workout);
        revalidatePath('/');
    } catch (error) {
        console.error("Échec création séance IA:", error);
        throw new Error("L'IA n'a pas pu créer la séance.");
    }
}

// Régénération d'une séance unique
export async function regenerateWorkout(workoutIdOrDate: string, instruction?: string) {

    await checkAndIncrementAICallLimit('workout');

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
        const { workout: newWorkoutData, tokensUsed: tkRegen } = await generateSingleWorkoutFromAI(
            existingProfile,
            history,
            dateKey,
            oldWorkout.sportType,
            surroundingWorkouts,
            oldWorkout,
            blockFocus,
            instruction
        );
        if (tkRegen > 0) await atomicIncrementTokenCount(tkRegen);

        // Remplacement dans le tableau en préservant les clés relationnelles
        existingSchedule.workouts[targetIndex] = {
            ...newWorkoutData,
            id: oldWorkout.id,
            userId: oldWorkout.userId,
            weekId: oldWorkout.weekId,
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
        surroundingDates.add(format(d, 'yyyy-MM-dd'));
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
    if (avgHR != null && avgHR > 0 && maxHR != null && maxHR > 0 && duration) {
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
    const schedule = await getSchedule();
    const index = findWorkoutIndex(schedule.workouts, workoutIdOrDate);

    if (index === -1) {
        throw new Error(`Workout non trouvé: ${workoutIdOrDate}`);
    }

    const workout = schedule.workouts[index];
    const completedData = (status === 'completed' && feedback)
        ? transformFeedbackToCompletedData(feedback)
        : null;

    // Atomic per-row update — pas de read-modify-write sur tout le schedule
    // Invalider les caches IA quand les données changent
    await updateWorkoutById(workout.id, { status, completedData, aiSummary: null, aiDeviationCache: null });

    // Recalcul CTL/ATL après tout changement de statut
    await recalculateFitnessMetrics();

    revalidatePath('/');
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

export async function moveWorkout(workoutId: string, newDateStr: string) {
    const schedule = await getSchedule();

    // 1. Trouver la source par ID
    const sourceWorkout = schedule.workouts.find(w => w.id === workoutId);
    if (!sourceWorkout) throw new Error("Séance source non trouvée.");

    if (sourceWorkout.status === 'completed') {
        // --- CAS COMPLETED : extraire le plannedData vers une nouvelle séance ---
        const newWorkout: Workout = {
            id: randomUUID(),
            userId: sourceWorkout.userId,
            weekId: sourceWorkout.weekId,
            date: newDateStr,
            sportType: sourceWorkout.sportType,
            title: sourceWorkout.title,
            workoutType: sourceWorkout.workoutType,
            mode: sourceWorkout.mode,
            status: 'pending',
            plannedData: sourceWorkout.plannedData,
            completedData: null,
        };
        // Retirer le plannedData de la séance complétée + insérer la nouvelle séance
        await Promise.all([
            updateWorkoutById(sourceWorkout.id, { plannedData: null as any }),
            insertSingleWorkout(newWorkout),
        ]);
    } else {
        // --- CAS PENDING / MISSED : déplacement simple ---
        await updateWorkoutById(sourceWorkout.id, { date: newDateStr });
    }

    revalidatePath('/');
}

export async function unlinkStravaWorkout(workoutId: string, targetWorkoutId: string | null) {
    const schedule = await getSchedule();

    const sourceWorkout = schedule.workouts.find(w => w.id === workoutId);
    if (!sourceWorkout) throw new Error("Séance source non trouvée.");
    if (sourceWorkout.status !== 'completed' || !sourceWorkout.completedData) {
        throw new Error("Cette séance n'a pas de données complétées à délier.");
    }

    const completedData = sourceWorkout.completedData;

    if (targetWorkoutId) {
        // --- Transférer le completedData vers une séance planifiée ---
        const targetWorkout = schedule.workouts.find(w => w.id === targetWorkoutId);
        if (!targetWorkout) throw new Error("Séance cible non trouvée.");

        const sourceBecomesEmpty = !sourceWorkout.plannedData;
        await Promise.all([
            // Source : supprimer si vide, sinon repasser en pending
            sourceBecomesEmpty
                ? deleteWorkoutById(sourceWorkout.id)
                : updateWorkoutById(sourceWorkout.id, { status: 'pending', completedData: null }),
            // Cible : recevoir le completedData, passer en completed
            updateWorkoutById(targetWorkout.id, { status: 'completed', completedData }),
        ]);
    } else {
        // --- Créer une séance libre avec le completedData ---
        const freeWorkout: Workout = {
            id: randomUUID(),
            userId: sourceWorkout.userId,
            weekId: sourceWorkout.weekId,
            date: sourceWorkout.date,
            sportType: sourceWorkout.sportType,
            title: 'Sortie Libre',
            workoutType: 'Sortie Libre',
            mode: sourceWorkout.mode,
            status: 'completed',
            plannedData: null as any,
            completedData,
        };

        await Promise.all([
            // Source : retirer completedData, repasser en pending
            updateWorkoutById(sourceWorkout.id, { status: 'pending', completedData: null }),
            // Insérer la séance libre
            insertSingleWorkout(freeWorkout),
        ]);
    }

    revalidatePath('/');
}

export async function addManualWorkout(workout: Workout) {
    const profile = await getProfile();
    const schedule = await getSchedule();

    // ✅ Sécurité : forcer le userID au user authentifié
    workout.userId = profile.id;

    // ✅ Validation : vérifier que l'ID est unique
    const existingWorkout = schedule.workouts.find(w => w.id === workout.id);

    if (existingWorkout) {
        throw new Error(`Un workout avec l'ID ${workout.id} existe déjà`);
    }

    // ✅ Validation : vérifier le format de date
    const parsed = parseISO(workout.date);
    if (isNaN(parsed.getTime())) {
        throw new Error(`Format de date invalide: ${workout.date}. Attendu: YYYY-MM-DD`);
    }

    // ✅ Ajout du workout
    schedule.workouts.push(workout);

    await saveSchedule(schedule);
    revalidatePath('/');
}


export async function deleteWorkout(workoutIdOrDate: string) {
    await deleteWorkoutById(workoutIdOrDate);
    revalidatePath('/');
}

/**
 * Met à jour le RPE d'une séance complétée (ex: après sync Strava sans RPE).
 * Invalide les caches IA pour recalculer avec le nouveau RPE.
 */
export async function updateWorkoutRPE(workoutId: string, rpe: number): Promise<void> {
    const schedule = await getSchedule();
    const workout = schedule.workouts.find(w => w.id === workoutId);
    if (!workout || !workout.completedData) throw new Error("Séance non trouvée ou pas complétée");

    const updatedCompletedData: CompletedData = {
        ...workout.completedData,
        perceivedEffort: rpe,
    };

    await updateWorkoutById(workoutId, {
        completedData: updatedCompletedData,
        aiSummary: null,
        aiDeviationCache: null,
    });

    revalidatePath('/');
}

export async function getWorkoutAISummary(workout: Workout): Promise<string> {
    // Cache hit → retourner directement
    if (workout.aiSummary) return workout.aiSummary;

    const { generateWorkoutSummary } = await import('@/lib/ai/coach-api');
    const profile = await getProfile();
    if (!profile || !workout.completedData) return "";
    try {
        const { summary, tokensUsed } = await generateWorkoutSummary(profile, workout);
        // Persister en DB pour ne plus recalculer
        if (summary) {
            await updateWorkoutById(workout.id, { aiSummary: summary });
        }
        // Comptabiliser les tokens
        if (tokensUsed > 0) {
            await atomicIncrementTokenCount(tokensUsed);
        }
        return summary;
    } catch (e) {
        console.error("AI Summary error:", e);
        return "";
    }
}

/**
 * Calcule les métriques de déviation planifié vs réalisé pour une séance.
 * Résultat mis en cache en DB.
 */
export async function getWorkoutDeviation(workout: Workout) {
    // Cache hit → retourner directement
    if (workout.aiDeviationCache) return workout.aiDeviationCache;

    const { computeDeviationMetrics } = await import('@/lib/stats/computeDeviation');
    const profile = await getProfile();
    if (!profile || !workout.completedData) return null;

    const deviation = computeDeviationMetrics(workout, profile);
    // Persister en DB
    if (deviation) {
        await updateWorkoutById(workout.id, { aiDeviationCache: deviation });
    }
    return deviation;
}

/**
 * Régénère le reste de la semaine suite à une déviation détectée.
 * adaptationLevel: 'conservative' | 'recommended' | 'ambitious'
 */
export async function regenerateWeekFromDeviation(
    workoutId: string,
    adaptationLevel: 'conservative' | 'recommended' | 'ambitious'
): Promise<{ updatedCount: number }> {
    const [profile, allWorkouts] = await Promise.all([getProfile(), getWorkout()]);
    if (!profile || !allWorkouts) throw new Error("Données manquantes");

    const { computeDeviationMetrics } = await import('@/lib/stats/computeDeviation');

    const triggerWorkout = allWorkouts.find(w => w.id === workoutId);
    if (!triggerWorkout || !triggerWorkout.completedData) {
        throw new Error("Séance non trouvée ou pas complétée");
    }

    const deviation = computeDeviationMetrics(triggerWorkout, profile);
    if (!deviation || deviation.signal === 'normal') {
        return { updatedCount: 0 };
    }

    // Trouver les séances futures de la même semaine (pending uniquement)
    const triggerDate = parseISO(triggerWorkout.date);
    const weekStart = startOfISOWeek(triggerDate);
    const weekEnd = endOfISOWeek(triggerDate);

    const pendingThisWeek = allWorkouts.filter(w => {
        const d = parseISO(w.date);
        return w.status === 'pending'
            && d > triggerDate
            && d >= weekStart
            && d <= weekEnd;
    }).sort((a, b) => a.date.localeCompare(b.date));

    if (pendingThisWeek.length === 0) return { updatedCount: 0 };

    // Construire le contexte semaine pour l'IA
    const weekWorkouts = allWorkouts.filter(w => {
        const d = parseISO(w.date);
        return d >= weekStart && d <= weekEnd;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const surroundingContext: Record<string, string> = {};
    for (const w of weekWorkouts) {
        const status = w.status === 'completed' ? '(FAIT)' : w.status === 'missed' ? '(RATÉ)' : '(prévu)';
        surroundingContext[w.date] = `${w.title} ${w.workoutType} ${w.plannedData?.durationMinutes ?? '?'}min ${status}`;
    }

    // Déterminer le modificateur selon le niveau d'adaptation
    const levelInstruction: Record<string, string> = {
        conservative: 'Ajustement léger (-10/+10%). Garde la structure globale, baisse légèrement les intensités ou le volume.',
        recommended: deviation.signal === 'fatigue'
            ? 'Adaptation modérée. Remplace les intervalles haute intensité par du sweet spot ou Z2. Réduis le volume de 15-20% si fatigue centrale. Si une séance clé a été ratée, reprogramme-la en supprimant une séance secondaire.'
            : 'Adaptation modérée. Augmente légèrement l\'intensité (+3-5%) des séances qualité sans toucher au volume. Ne jamais augmenter volume ET intensité en même temps.',
        ambitious: deviation.signal === 'fatigue'
            ? 'Adaptation forte. Réduis le volume de 25-30%, transforme les séances qualité restantes en endurance Z2, ajoute une journée de repos si possible.'
            : 'Adaptation ambitieuse. Augmente l\'intensité des séances qualité (+5-8%). Garde le volume stable. Attention au surentraînement.',
    };

    // Régénérer chaque séance pending
    const currentBlockFocus = triggerWorkout.workoutType || "General Fitness";
    let updatedCount = 0;

    for (const pendingWorkout of pendingThisWeek) {
        try {
            const adaptInstruction = `CONTEXTE ADAPTATION: ${deviation.headline}. ${deviation.adaptationReason}
NIVEAU: ${levelInstruction[adaptationLevel]}
SIGNAUX: ${deviation.details.join('; ')}
Score déviation: ${deviation.score}`;

            const { workout: newWorkout, tokensUsed: tkAdapt } = await generateSingleWorkoutFromAI(
                profile,
                null,
                pendingWorkout.date,
                pendingWorkout.sportType,
                surroundingContext,
                pendingWorkout,
                currentBlockFocus,
                adaptInstruction
            );
            if (tkAdapt > 0) await atomicIncrementTokenCount(tkAdapt);

            await updateWorkoutById(pendingWorkout.id, {
                title: newWorkout.title,
                workoutType: newWorkout.workoutType,
                mode: newWorkout.mode,
                plannedData: newWorkout.plannedData,
            });

            // Mettre à jour le contexte pour la prochaine séance
            surroundingContext[pendingWorkout.date] = `${newWorkout.title} ${newWorkout.workoutType} ${newWorkout.plannedData?.durationMinutes ?? '?'}min (ADAPTÉ)`;
            updatedCount++;
        } catch (e) {
            console.error(`Erreur régénération adaptative pour ${pendingWorkout.date}:`, e);
        }
    }

    revalidatePath('/');
    return { updatedCount };
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
            profile?.role !== 'admin';

        // 2. Compter les activités Strava existantes (pour la limite free)
        const stravaWorkouts = workouts.filter(w =>
            w.status === 'completed' &&
            w.completedData?.source?.type === 'strava'
        );

        // 3. Sync complète de l'année en cours (pagination).
        //    On récupère toujours toutes les summaries (1-2 appels légers per_page=200),
        //    le dedup en étape 4 évite de re-fetcher les détails des activités déjà connues.
        //    Cela garantit qu'aucune activité n'est ratée, même si la première sync était incomplète.
        const currentYear = new Date().getFullYear();
        const startOfYear = Math.floor(new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000);

        console.log(`📅 Sync complète ${currentYear} (pagination)...`);
        const activitiesSummary: { id: number; start_date: string; [key: string]: unknown }[] =
            await getStravaActivitiesAllPages(startOfYear);
        console.log(`📊 ${activitiesSummary.length} activité(s) trouvée(s) sur Strava pour ${currentYear}`);

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

            const { raw: detail, completedData } = result.value;
            const activityDate = summary.start_date.split('T')[0];
            const stravaSport = mapStravaSport(String(summary.type ?? detail.type ?? ''));

            // 🧠 MATCHING : séance planifiée existante pour cette date ET le même sport ?
            const matchingIndex = workouts.findIndex(w =>
                w.date === activityDate &&
                w.status !== 'completed' &&
                w.sportType === stravaSport
            );

            if (matchingIndex !== -1) {
                console.log(`   🤝 Match le ${activityDate} (${stravaSport}) -> mise à jour du plan.`);
                workouts[matchingIndex].status = 'completed';
                workouts[matchingIndex].completedData = completedData;
            } else {
                console.log(`   ➕ Activité libre ajoutée : ${activityDate} (${stravaSport})`);

                const sportType: SportType = stravaSport !== 'other' ? stravaSport
                    : completedData.metrics.swimming ? 'swimming'
                    : completedData.metrics.running ? 'running'
                    : completedData.metrics.cycling ? 'cycling'
                    : 'other';

                // Trouver la semaine du bloc actif correspondant à cette date
                let activeWeekID = '';
                const newWorkoutId = randomUUID();
                if (existingBlocks && existingWeeks) {
                    const activityDateObj = parseISO(activityDate);

                    const activeBlock = existingBlocks.find(block => {
                        const blockStart = parseISO(block.startDate);
                        const blockEnd = addDays(blockStart, block.weekCount * 7);
                        return activityDateObj >= blockStart && activityDateObj < blockEnd;
                    });

                    if (activeBlock) {
                        const blockStart = parseISO(activeBlock.startDate);
                        const blockWeeks = existingWeeks.filter(w => activeBlock.weeksId?.includes(w.id));
                        const activeWeek = blockWeeks.find(week => {
                            const weekStart = addDays(blockStart, (week.weekNumber - 1) * 7);
                            const weekEnd = addDays(weekStart, 6);
                            return activityDateObj >= weekStart && activityDateObj <= weekEnd;
                        });

                        if (activeWeek) {
                            activeWeekID = activeWeek.id;
                            const weekIdx = updatedWeeks.findIndex(w => w.id === activeWeek.id);
                            if (weekIdx !== -1) {
                                if (!updatedWeeks[weekIdx].workoutsId.includes(newWorkoutId)) {
                                    updatedWeeks[weekIdx] = {
                                        ...updatedWeeks[weekIdx],
                                        workoutsId: [...updatedWeeks[weekIdx].workoutsId, newWorkoutId],
                                    };
                                }
                            }
                        }
                    }
                }

                workouts.push({
                    id: newWorkoutId,
                    userId: profile?.id ?? '',
                    weekId: activeWeekID,
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

        // 6b. Marquer les séances planifiées passées (avant aujourd'hui, fuseau Europe/Paris) non réalisées comme "missed"
        const todayParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const todayStr = `${todayParis.getFullYear()}-${String(todayParis.getMonth() + 1).padStart(2, '0')}-${String(todayParis.getDate()).padStart(2, '0')}`;
        for (const w of workouts) {
            if (w.status === 'pending' && !w.completedData && w.date < todayStr) {
                w.status = 'missed';
                newItemsCount++;
            }
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
        const start = parseISO(b.startDate);
        const end = addDays(start, b.weekCount * 7);
        return targetDate >= start && targetDate < end;
    });
    if (!block) return null;

    const blockStart = parseISO(block.startDate);
    const blockWeeks = weeks.filter(w => block.weeksId?.includes(w.id));
    const week = blockWeeks.find(w => {
        const wStart = addDays(blockStart, (w.weekNumber - 1) * 7);
        const wEnd = addDays(wStart, 6);
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

    const result = findBlockAndWeekForDate(blocks, weeks, parseISO(weekStartDate));
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

    const result = findBlockAndWeekForDate(blocks, weeks, parseISO(weekStartDate));
    if (!result) return 0;

    return workouts.filter(w => w.weekId === result.week.id && w.status === 'pending').length;
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

    const result = findBlockAndWeekForDate(blocks, weeks, parseISO(weekStartDate));
    if (!result) throw new Error("Aucun bloc actif pour cette semaine.");

    const { block, week } = result;
    const plan = plans?.find(p => p.id === block.planId);
    if (!plan) throw new Error("Plan introuvable.");

    // Trouver les objectifs pertinents (cette semaine + semaine suivante)
    const objectives = await getObjectives();
    const weekStart = parseISO(weekStartDate);
    const weekEndPlusOne = addDays(weekStart, 13);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const weekObjectives = objectives.filter(o =>
        o.status === 'upcoming' && o.date >= todayStr
        && parseISO(o.date) >= weekStart && parseISO(o.date) <= weekEndPlusOne
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

    // Supprimer les séances pending de cette semaine uniquement si la génération a réussi
    const keptWorkouts = (existingWorkouts ?? []).filter(
        w => !(w.weekId === week.id && w.status === 'pending')
    );

    // Mettre à jour workoutsId de la semaine
    const updatedWeeks = weeks.map(w =>
        w.id === week.id
            ? { ...w, workoutsId: newWorkouts.map(wo => wo.id) }
            : w
    );

    await Promise.all([
        saveWorkout([...keptWorkouts, ...newWorkouts]),
        saveWeek(updatedWeeks),
    ]);

    revalidatePath('/');
}

// ─── Plan Overview ───────────────────────────────────────────────────────────

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
    workouts: { id: string; date: string; title: string; sportType: SportType; status: string; plannedTSS: number | null }[];
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

        const blockStart = parseISO(block.startDate);
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
            const actualTSS = weekWorkouts.reduce((s, w) => {
                if (w.status !== 'completed' || !w.completedData) return s;
                const cd = w.completedData;
                const tss = cd.metrics?.cycling?.tss ?? cd.calculatedTSS ?? w.plannedData?.plannedTSS ?? 0;
                return s + tss;
            }, 0);

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