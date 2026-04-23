import { Profile } from "../data/DatabaseTypes";
import { SportType } from "../data/type";
import { Workout } from "../data/DatabaseTypes";
import { structureSessionDescription } from "./structure-session";

// Lecture de la clé API depuis les variables d'environnement du serveur
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_RETRIES = 2;

// Fonction utilitaire pour le backoff exponentiel
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction utilitaire pour générer des IDs uniques
function generateWorkoutId(date: string, sport: SportType): string {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${sport}_${date.replace(/-/g, '')}_${randomSuffix}`;
}

// Détecte les placeholders "vides" courants renvoyés par l'IA ("N/A", "—", "None", etc.)
function isPlaceholderDescription(s: string | null | undefined): boolean {
    if (!s) return true;
    const t = s.trim();
    if (t.length === 0) return true;
    return /^(n\.?\s*\/?\s*a\.?|—+|-+|none|null|aucun|vide)$/i.test(t);
}

// Nettoie une description IA : rejette "N/A" et co, sinon retourne le trim.
function sanitizeDescription(s: string | null | undefined): string | null {
    if (isPlaceholderDescription(s)) return null;
    return s!.trim();
}

/**
 * Génère un plan d'entraînement complet via l'API Gemini.
 */
// On définit l'interface de ce que l'IA va nous renvoyer (Flat Structure)
interface RawAIWorkout {
    date: string;
    sport: 'cycling' | 'running' | 'swimming';
    title: string;
    type: string;
    duration: number; // en minutes
    tss: number;
    mode: 'Outdoor' | 'Indoor';
    target_power: number | null;      // Spécifique vélo
    target_pace: string | null;       // Spécifique course/natation (ex: "5:30/km")
    target_hr: number | null;         // Universel
    description: string;              // Description unique (fusionnée)
}

// Formatage d'une allure stockée en secondes/km vers "M:SS".
function fmtPace(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

// Contexte zones athlète adapté au sport cible (pour le prompt du single-workout).
function buildSportZonesContext(profile: Profile, sportType: SportType): string {
    const parts: string[] = [];

    if (sportType === 'cycling' && profile.cycling?.Test?.zones) {
        const z = profile.cycling.Test.zones;
        const ftp = profile.cycling.Test.ftp;
        if (ftp) parts.push(`FTP: ${ftp} W`);
        parts.push(`ZONES PUISSANCE (W): Z1<${z.z1.max} · Z2:${z.z2.min}-${z.z2.max} · Z3:${z.z3.min}-${z.z3.max} · Z4:${z.z4.min}-${z.z4.max} · Z5:${z.z5.min}-${z.z5.max}${z.z6 ? ` · Z6:${z.z6.min}-${z.z6.max}` : ''}${z.z7 ? ` · Z7:>${z.z7.min}` : ''}`);
    }

    if (sportType === 'running' && profile.running?.Test?.zones) {
        const z = profile.running.Test.zones;
        parts.push(`ZONES ALLURE (min/km): Z1:${fmtPace(z.z1.min)}-${fmtPace(z.z1.max)} · Z2:${fmtPace(z.z2.min)}-${fmtPace(z.z2.max)} · Z3:${fmtPace(z.z3.min)}-${fmtPace(z.z3.max)} · Z4:${fmtPace(z.z4.min)}-${fmtPace(z.z4.max)} · Z5:${fmtPace(z.z5.min)}-${fmtPace(z.z5.max)}`);
    } else if (sportType === 'running' && profile.running?.Test?.vma) {
        parts.push(`VMA: ${profile.running.Test.vma} km/h`);
    }

    if (profile.heartRate?.zones) {
        const z = profile.heartRate.zones;
        parts.push(`ZONES FC (bpm): Z1<${z.z1.max} · Z2:${z.z2.min}-${z.z2.max} · Z3:${z.z3.min}-${z.z3.max} · Z4:${z.z4.min}-${z.z4.max} · Z5:${z.z5.min}-${z.z5.max}`);
    } else if (profile.heartRate?.max) {
        parts.push(`FC Max: ${profile.heartRate.max} bpm`);
    }

    return parts.length > 0 ? parts.join('\n') : "Aucune zone définie — utilise des valeurs cohérentes avec le niveau ou le RPE.";
}

// Règles spécifiques au sport (injection dans le system prompt).
function getSportRules(sportType: SportType): string {
    if (sportType === 'swimming') {
        return `NATATION — RÈGLES OBLIGATOIRES :
- Volume en MÈTRES, jamais en minutes. Toujours indiquer le TOTAL de la séance (ex: 2400m) et la distance de CHAQUE section.
- Chaque série doit préciser : nombre × distance (ex: "8x50m"), la NAGE (crawl/dos/brasse/papillon/4 nages/mixte), l'ALLURE CIBLE ou zone (ex: "allure Z3" ou "1'40''/100m"), et la RÉCUP au bord en secondes (ex: "15'' R").
- Travail technique : NOMME précisément les éducatifs (Rattrapage, 6 temps, Manchot, Catch-up, Sculls, Poings fermés, Jambes avec planche). INTERDIT : "éducatifs variés", "travail technique", "prise d'eau", sans spécifier l'éducatif précis.
- Matériel : préciser planche/pull-buoy/palmes/plaquettes/tuba quand pertinent.
- Structure attendue : échauffement varié 300-600m → bloc technique avec éducatifs nommés → corps principal (séries avec intensité + récup) → retour au calme 100-300m.

EXEMPLE DE DESCRIPTION ATTENDUE pour une séance technique 60 min (~2400m total) :
"Échauffement 600m : 300m crawl souple en respi 3 temps + 6x50m 4 nages (25m éducatif / 25m nage complète), 15'' R. Bloc technique 8x50m crawl avec palmes (2x Rattrapage + 2x 6 temps + 2x Poings fermés + 2x crawl complet glisse maximale), 20'' R. Corps principal 6x100m crawl à allure Z3 (1'40''/100m), 20'' R. Retour au calme 200m dos souple."

Ton de la description : technique, directe, sans remplissage littéraire. Cibles : allure /100m en priorité, fallback FC, dernier recours RPE.`;
    }
    if (sportType === 'cycling') {
        return `CYCLISME — RÈGLES :
- Cibles en WATTS en priorité (depuis les zones fournies), fallback FC, dernier recours RPE.
- Structure : échauffement progressif, corps avec intervalles (durée + watts/zone explicites), récups entre intervalles, retour au calme.
- Format séries : "NxD min Z? (XXX-YYY W), R:Xmin Z?".
- Toujours spécifier la durée de chaque section (ex: "Échauffement 15 min") et les valeurs exactes des cibles.`;
    }
    if (sportType === 'running') {
        return `COURSE À PIED — RÈGLES :
- Cibles en ALLURE (min/km) en priorité, fallback FC, dernier recours RPE.
- Structure : échauffement, corps avec intervalles, récups, retour au calme.
- Format séries : "NxD min à X:XX/km, R:Xmin trot".
- Toujours spécifier la durée de chaque section et les allures exactes.`;
    }
    return `Structure : échauffement, corps de séance, retour au calme. Cibles en RPE ou FC.`;
}

// Résultat d'un appel Gemini avec les tokens consommés
export interface GeminiResult<T = unknown> {
    data: T;
    tokensUsed: number;
}

// Timeout par défaut : coupe une tentative qui mouline (Gemini peut halluciner
// pendant plusieurs minutes avant de s'arrêter tout seul). Valeur par tentative,
// donc avec MAX_RETRIES=2 le worst-case devient 2*TIMEOUT.
const DEFAULT_GEMINI_TIMEOUT_MS = 60_000;

// Fonction générique pour appeler l'API
export async function callGeminiAPI(
    payload: unknown,
    tag: string = 'gemini',
    timeoutMs: number = DEFAULT_GEMINI_TIMEOUT_MS,
): Promise<GeminiResult> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    // Désactive le mode "thinking" de Gemini 2.5 Flash → 2-3x plus rapide
    const p = payload as Record<string, unknown>;
    const enhancedPayload = {
        ...p,
        generationConfig: {
            ...((p.generationConfig as Record<string, unknown>) ?? {}),
            thinkingConfig: { thinkingBudget: 0 },
        },
    };

    const payloadBytes = JSON.stringify(enhancedPayload).length;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const t0 = Date.now();
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enhancedPayload),
                signal: controller.signal,
            });
            const tFetch = Date.now() - t0;

            if (!response.ok) {
                const errorBody = await response.text();
                console.warn(`[callGeminiAPI:${tag}] ❌ HTTP ${response.status} en ${tFetch}ms (tentative ${attempt + 1})`);
                throw new Error(`HTTP error! status: ${response.status}. ${errorBody.substring(0, 200)}`);
            }

            const tBeforeJson = Date.now();
            const data = await response.json();
            const tParse = Date.now() - tBeforeJson;

            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const tokensUsed: number = data.usageMetadata?.totalTokenCount ?? 0;
            const inTokens: number = data.usageMetadata?.promptTokenCount ?? 0;
            const outTokens: number = data.usageMetadata?.candidatesTokenCount ?? 0;

            console.log(
                `[callGeminiAPI:${tag}] ✅ ${tFetch}ms fetch + ${tParse}ms parse | payload=${payloadBytes}B | tokens in=${inTokens} out=${outTokens} total=${tokensUsed}`
            );

            if (!rawText) throw new Error("AI response empty.");

            // Nettoyage du markdown éventuel
            let cleanText: string = rawText
                .trim()
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '');

            // Contre-mesure : Gemini peut produire des runs de \n dans les strings
            // (boucle de répétition) qui cassent le JSON. On collapse >=3 \n en un seul.
            const nRunaway = (cleanText.match(/\\n\\n\\n+/g) ?? []).length;
            if (nRunaway > 0) {
                console.warn(`[callGeminiAPI:${tag}] 🧹 ${nRunaway} run(s) de \\n détecté(s) dans la réponse — nettoyage`);
                cleanText = cleanText.replace(/(\\n){3,}/g, '\\n');
            }

            try {
                return { data: JSON.parse(cleanText), tokensUsed };
            } catch (parseError) {
                console.error(`[callGeminiAPI:${tag}] ❌ JSON invalide reçu de Gemini (preview): ${cleanText.slice(0, 400)}…`);
                throw new Error(`JSON parsing failed: ${parseError}`);
            }

        } catch (error) {
            const elapsed = Date.now() - t0;
            const isTimeout = (error as Error)?.name === 'AbortError';
            const msg = isTimeout
                ? `TIMEOUT après ${elapsed}ms (seuil=${timeoutMs}ms) — Gemini a halluciné ou est bloqué`
                : `${(error as Error)?.message ?? error} (${elapsed}ms)`;

            if (attempt < MAX_RETRIES - 1) {
                const backoff = Math.pow(2, attempt) * 1000;
                console.warn(`[callGeminiAPI:${tag}] ⚠️ Tentative ${attempt + 1} échouée : ${msg}. Retry dans ${backoff / 1000}s…`);
                await delay(backoff);
            } else {
                console.error(`[callGeminiAPI:${tag}] ❌ Toutes les tentatives ont échoué. Dernière : ${msg}`);
                throw error;
            }
        } finally {
            clearTimeout(timeoutHandle);
        }
    }
    throw new Error("callGeminiAPI: all retries exhausted");
}

/**
 * Génère un plan d'entraînement (Compatible Multisport & Multi-séance)
 */
export async function generatePlanFromAI(
    profile: Profile,
    history: string,
    blockFocus: string,
    customTheme: string | null,
    startDateInput: string | null,
    numWeeks?: number
): Promise<{ synthesis: string, workouts: Omit<Workout, 'userId' | 'weekId'>[] }> {
    if (!GEMINI_API_KEY) {
        console.error("ERREUR CRITIQUE: GEMINI_API_KEY est NULL.");
        throw new Error("GEMINI_API_KEY is not set.");
    }

    // --- 1. Calcul de la durée du bloc ---
    let startD = new Date();
    if (startDateInput) {
        startD = new Date(startDateInput);
    } else {
        startD.setDate(startD.getDate() + 1);
    }

    let numDays = 28; // Défaut 4 semaines
    if (blockFocus === 'Semaine de Tests (FTP, VO2max)') numDays = 7;
    else if (blockFocus === 'Personnalisé' && numWeeks) numDays = numWeeks * 7;

    
    // --- 2. Construction du Prompt ---
    
    // On récupère les contraintes de dispo
    let dateConstraints = "";
    
    // Pour l'instant on regarde la dispo globale, mais on prépare le terrain
    if (profile.weeklyAvailability) {
        for (let i = 0; i < numDays; i++) {
            const d = new Date(startD);
            d.setDate(d.getDate() + i);
            const dayIndex = d.getDay(); 
            // Attention: getDay() renvoie 0=Dimanche, 1=Lundi. 
            // Ton mapping daysMap est 0=Lundi. Il faut aligner ça. 
            // JS standard: 0=Sun, 1=Mon...6=Sat.
            // Si ton objet profile utilise "Lundi",... il faut convertir.
            // Supposons ici une conversion simple pour matcher tes clés:
            const standardDays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
            const dayName = standardDays[dayIndex]; // Clé exacte dans profile.weeklyAvailability
            
            const slot = profile.weeklyAvailability[dayName];
            const dateStr = d.toISOString().split('T')[0];

            const cyclingMin = slot?.cycling ?? 0;
            const runningMin = slot?.running ?? 0;
            const swimmingMin = slot?.swimming ?? 0;

            if (cyclingMin === 0 && runningMin === 0 && swimmingMin === 0) {
                dateConstraints += `- ${dateStr} (${dayName}): REPOS OBLIGATOIRE (0 min dispo).\n`;
            } else {
                const parts: string[] = [];
                if (cyclingMin > 0) parts.push(`vélo ${cyclingMin}min`);
                if (runningMin > 0) parts.push(`course ${runningMin}min`);
                if (swimmingMin > 0) parts.push(`natation ${swimmingMin}min`);
                dateConstraints += `- ${dateStr} (${dayName}): ${parts.join(', ')}.\n`;
            }
        }
    }

    const startDateString = startD.toISOString().split('T')[0];
    const finalFocus = blockFocus === 'Personnalisé' ? customTheme : blockFocus;

    // Contexte Zones
    // Contexte Zones
    let zonesContext = "ZONES: Utilise les % FTP/VMA standard car les zones exactes ne sont pas définies.";
    
    if (profile.cycling?.Test?.zones) {
        const z = profile.cycling.Test.zones;
        zonesContext = `
        ZONES CYCLISME ATHLÈTE (Watts) - À RESPECTER IMPÉRATIVEMENT :
        - Z1 (Récupération): < ${z.z1.max} W
        - Z2 (Endurance): ${z.z2.min} - ${z.z2.max} W
        - Z3 (Tempo): ${z.z3.min} - ${z.z3.max} W
        - Z4 (Seuil/FTP): ${z.z4.min} - ${z.z4.max} W
        - Z5 (VO2 Max): ${z.z5.min} - ${z.z5.max} W
        - Z6 (Anaérobie): ${z?.z6?.min} - ${z?.z6?.max} W
        - Z7 (Neuromusculaire): > ${z?.z7?.min} W
        `;
    }


    // Prompt système orienté Coach Triathlon/Cyclisme
const systemPrompt = `
RÔLE: Tu es le Directeur de la Performance d'une équipe World Tour et Triathlon Élite. Ta méthodologie est basée sur la science (Coggan, Friel, Seiler) et la périodisation moderne.

MISSION: Générer un calendrier d'entraînement JSON strict pour un athlète, en respectant son profil, ses zones de puissance/FC et ses contraintes de temps.

RÈGLES D'OR :
1. **Physiologie avant tout** : Chaque séance doit avoir un but physiologique clair (Endurance, Seuil, VO2max, Récupération, Neuromusculaire).
2. **Respect des Zones** : Utilise les valeurs de watts/fréquence cardiaque fournies dans le prompt. Ne les invente pas.
3. **Gestion de la Charge** : Alterne les jours difficiles et faciles. Si le volume est élevé, l'intensité baisse, et vice-versa.
4. **Multisport Intelligent** : Pour le triathlon, gère la fatigue croisée (ex: pas de VMA course à pied le lendemain d'un gros seuil vélo si l'athlète est fatigué).
5. **Réalisme** :
   - Si "Indoor" : Séances structurées, courtes, intenses (intervalles).
   - Si "Outdoor" : Plus de volume, gestion du terrain, descriptions axées sur le pilotage ou la route.
6. **Contraintes Horaire** : NE JAMAIS programmer une séance plus longue que la disponibilité indiquée pour ce jour-là.
7. **Jours de Repos** : Si nécessaire, n'hésite pas à laisser des jours vides (pas de JSON généré pour ce jour) pour la récupération.
8. **Description OBLIGATOIRE** : chaque séance DOIT contenir une description unique, précise et structurée (échauffement, corps, retour au calme avec valeurs de zones/watts/allures). JAMAIS de "N/A", jamais vide. Inclure les consignes de terrain ET la structure technique.
FORMAT DE RÉPONSE :
- Tu dois répondre UNIQUEMENT avec le JSON validé par le schéma fourni.
- Aucune phrase d'introduction ou de conclusion.
- Les descriptions des séances doivent être techniques mais motivantes (style coach).
- LANGUE : français UNIQUEMENT pour tous les textes (title, type, description, synthesis). Pas d'anglais sauf termes techniques sans équivalent (FTP, TSS, RPE, VO2max).
`;

    const userPrompt = `
    PROFIL ATHLÈTE:
    - Sport pratiqué: ${profile.activeSports.cycling ? 'Cyclisme' : ''}${profile.activeSports.running ? ', Course à pied' : ''}${profile.activeSports.swimming ? ', Natation' : ''}
    - Niveau: ${profile.experience}
    - FTP (Vélo): ${profile.cycling?.Test?.ftp}W
    - Poids: ${profile.weight || '?'}kg
    ${zonesContext}

    HISTORIQUE RÉCENT:
    ${history}

    COMMANDE:
    - Date de début du plan: ${startDateString}
    - Durée totale: ${numDays} jours
    - Objectif du bloc: "${finalFocus}"

    RÈGLES DE GÉNÉRATION:
    1. **Multisport**: Pour l'instant, concentre-toi sur le CYCLISME (sauf instruction contraire explicite dans l'objectif), mais tu as le droit de proposer du Running ou Swimming si pertinent pour la récupération ou le cross-training.
    2. **Plusieurs séances**: Tu peux mettre 2 séances le même jour (ex: Matin et Soir) si le volume horaire le permet.
    3. **Jours de Repos**: Si un jour est "Repos", NE GÉNÈRE PAS d'objet dans le tableau JSON pour ce jour-là. (Le tableau ne doit contenir que les séances actives).
    4. **Contraintes**: Respecte scrupuleusement les disponibilités ci-dessous.
    
    DISPONIBILITÉS & CONTRAINTES DATE:
    ${dateConstraints}

    FORMAT JSON ATTENDU:
    Renvoie un objet avec une 'synthesis' (résumé texte) et un tableau 'workouts'.
    Chaque workout doit avoir:
    - sport: "cycling", "running" ou "swimming"
    - target_power: (null si running/swimming)
    - target_pace: (null si cycling, ex: "5:00/km")
    `;

    // --- 3. Définition du Schéma JSON pour Gemini ---
    const responseSchema = {
        type: "OBJECT",
        properties: {
            "synthesis": { "type": "STRING" },
            "workouts": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "date": { "type": "STRING", "description": "YYYY-MM-DD" },
                        "sport": { "type": "STRING", "enum": ["cycling", "running", "swimming"] },
                        "title": { "type": "STRING" },
                        "type": { "type": "STRING", "description": "Ex: Endurance, Intervals, Threshold, Recovery" },
                        "duration": { "type": "NUMBER", "description": "Durée en minutes" },
                        "tss": { "type": "NUMBER", "nullable": true },
                        "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"] },
                        
                        // Métriques cibles planifiées
                        "target_power": { "type": "NUMBER", "nullable": true, "description": "Watts cibles (moyenne ou intervalle clé)" },
                        "target_pace": { "type": "STRING", "nullable": true, "description": "Allure cible (Min/km ou min/100m)" },
                        "target_hr": { "type": "NUMBER", "nullable": true, "description": "BPM cible moyen" },

                        "description": { "type": "STRING", "description": "Description technique complète (échauffement, corps, retour au calme, structure d'intervalles). Jamais N/A, jamais vide." }
                    },
                    "required": ["date", "sport", "title", "type", "duration", "mode", "description"]
                }
            }
        },
        "required": ["synthesis", "workouts"]
    };

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema },
    };

    // Appel API
    const { data: rawResponse } = await callGeminiAPI(payload);
    const typedResponse = rawResponse as { synthesis: string, workouts: RawAIWorkout[] };

    // --- 4. Transformation et Nettoyage des données ---

    const structuredWorkouts: Omit<Workout, 'userId' | 'weekId'>[] = typedResponse.workouts
        // Sécurité 1: On filtre les objets invalides ou les jours de repos explicites si l'IA s'est trompée
        .filter(w => w.duration > 0 && w.title.toLowerCase() !== "repos")
        .map((w) => {
            // Génération ID unique : Type + Date + RandomString (pour gérer le multi-séance le même jour)
            // ex: cycling_2023-10-10_abc12
            const uniqueSuffix = Math.random().toString(36).substring(2, 7);
            const id = `${w.sport}_${w.date.replace(/-/g, '')}_${uniqueSuffix}`;

            return {
                id: id,
                date: w.date,
                sportType: w.sport, // 'cycling' | 'running' | 'swimming'
                title: w.title,
                workoutType: w.type,
                mode: w.mode,
                status: 'pending',
                
                // On peuple la nouvelle structure PlannedData
                plannedData: {
                    durationMinutes: w.duration,
                    plannedTSS: w.tss || null,
                    distanceKm: null, // L'IA ne le devine pas forcément bien, on laisse null
                    
                    // Mapping des cibles selon le sport
                    targetPowerWatts: w.sport === 'cycling' ? w.target_power : null,
                    targetPaceMinPerKm: w.sport !== 'cycling' ? w.target_pace : null,
                    targetHeartRateBPM: w.target_hr || null,

                    description: sanitizeDescription(w.description),
                },

                // Pas de données réalisées pour le futur
                completedData: null
            };
        });

    return {
        synthesis: typedResponse.synthesis,
        workouts: structuredWorkouts
    };
}


/**
 * Génère une SEULE séance (création ou remplacement) pour un sport donné.
 * Le prompt et les zones s'adaptent au sportType passé en paramètre.
 */
export async function generateSingleWorkoutFromAI(
    profile: Profile,
    history: unknown,
    date: string,
    sportType: SportType,
    surroundingWorkouts: Record<string, string>,
    oldWorkout?: Workout,
    currentBlockFocus: string = "General Fitness",
    userInstruction?: string
): Promise<{ workout: Omit<Workout, 'userId' | 'weekId'>; tokensUsed: number }> {

    const tStart = Date.now();
    console.log(`[generateSingleWorkoutFromAI] ⏱️ START ${sportType} ${date}`);

    // Extraction des dispos
    const d = new Date(date);
    const dayName = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][d.getDay()];
    const slot = profile.weeklyAvailability[dayName];
    let availability: number = 60;
    if (slot && typeof slot === 'object') {
        const perSport = slot[sportType as keyof typeof slot] as number | undefined;
        if (typeof perSport === 'number' && perSport > 0) availability = perSport;
    } else if (typeof slot === 'number') {
        availability = slot;
    }

    const zonesContext = buildSportZonesContext(profile, sportType);
    const sportRules = getSportRules(sportType);

    const scheduleContextStr = Object.entries(surroundingWorkouts)
        .map(([d, desc]) => `- ${d}: ${desc}`)
        .join('\n') || '(aucun contexte)';

    let oldWorkoutContext = "Nouveau créneau.";
    if (oldWorkout) {
        oldWorkoutContext = `REMPLACE: ${oldWorkout.title} (${oldWorkout.workoutType}, ${oldWorkout.plannedData?.durationMinutes ?? 0}min)`;
    }

    const userDirective = userInstruction ? `DEMANDE UTILISATEUR: "${userInstruction}"` : "Propose une séance pertinente.";

    const systemPrompt = `Tu es coach expert en ${sportType === 'cycling' ? 'cyclisme' : sportType === 'running' ? 'course à pied' : sportType === 'swimming' ? 'natation' : 'entraînement sportif'}. Tu génères UNE séance structurée au format JSON.

LANGUE : français. Termes techniques autorisés (FTP, TSS, RPE, VO2max).

${sportRules}

RÈGLES GÉNÉRALES :
- "description" = paragraphe complet et AUTO-SUFFISANT que l'athlète peut lire et exécuter sans rien demander de plus. Il doit contenir toutes les valeurs chiffrées (durées, distances, cibles, récups, répétitions).
- Interdits : "N/A", "au choix", "varié" non précisé, "travail technique" seul, "à ton rythme". Tout doit être explicite.
- Format du texte : paragraphe dense, phrases enchaînées avec ponctuation. MAXIMUM 3 sauts de ligne simples (\\n) pour séparer les grandes sections. JAMAIS de sauts de ligne consécutifs (\\n\\n interdit).
- Longueur attendue : entre 400 et 1200 caractères selon la complexité de la séance (une séance technique natation ≈ 600-900 caractères).
- Adapte l'intensité au niveau athlète (${profile.experience ?? 'Intermédiaire'}) et au focus du bloc. Respecte la durée maximale indiquée.

FORMAT DE SORTIE : JSON uniquement, validé par le schéma. Pas de texte avant/après.`;

    const userPrompt = `DATE: ${date}
SPORT: ${sportType.toUpperCase()}
DISPO MAX: ${availability} min
FOCUS DU BLOC: ${currentBlockFocus}
NIVEAU: ${profile.experience ?? 'Intermédiaire'}

ZONES ATHLÈTE:
${zonesContext}

${oldWorkoutContext}

${userDirective}

CONTEXTE SEMAINE:
${scheduleContextStr}

Génère UN objet JSON pour la séance.`;

    const responseSchema = {
        type: "OBJECT",
        properties: {
            "workout": {
                "type": "OBJECT",
                "properties": {
                    "title": { "type": "STRING" },
                    "type": { "type": "STRING" }, // -> workoutType
                    "duration": { "type": "NUMBER" }, // -> plannedData.durationMinutes
                    "tss": { "type": "NUMBER" }, // -> plannedData.plannedTSS
                    "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"] },
                    "description": { "type": "STRING", "description": "Description technique unique. Jamais N/A, jamais vide." }
                },
                "required": ["title", "type", "duration", "mode", "description"]
            }
        },
        "required": ["workout"]
    };

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            // Compromis : assez bas pour limiter les boucles de répétition
            // observées (flots de \n), assez haut pour produire du contenu
            // détaillé plutôt qu'une version "safe" minimaliste.
            temperature: 0.5,
            // Cap dur contre les runaways. Séance typique ≈ 400-700 tokens ;
            // 2000 laisse de la marge pour natation technique (plus verbeux).
            maxOutputTokens: 2000,
            // Filet de sécurité : coupe si Gemini sort 5 \n d'affilée.
            stopSequences: ["\n\n\n\n\n"],
        },
    };

    console.log(`[generateSingleWorkoutFromAI] prompt input = sys:${systemPrompt.length}ch + user:${userPrompt.length}ch (${sportType})`);

    const tBeforeGen = Date.now();
    const { data: resultData, tokensUsed } = await callGeminiAPI(payload, `single/${sportType}/gen`);
    const tGen = Date.now() - tBeforeGen;
    console.log(`[generateSingleWorkoutFromAI] ⏱️ GEN terminé en ${tGen}ms`);

    const w = (resultData as { workout: { title: string; type: string; duration: number; tss?: number; mode: 'Outdoor' | 'Indoor'; description: string } }).workout;

    console.log(`[generateSingleWorkoutFromAI] 📥 ${sportType} ${w.duration}min — "${w.title}" (${w.type})`);
    const rawDesc = w.description ?? '';
    console.log(`  description: "${rawDesc.slice(0, 250)}${rawDesc.length > 250 ? '…' : ''}" (${rawDesc.length} chars)`);

    const description = sanitizeDescription(rawDesc);
    if (!description) {
        console.warn(`[generateSingleWorkoutFromAI] ⚠️ description inutilisable (vide / N/A) — structuration skip`);
    }

    // Second appel IA : structuration (fallback [] si pas de description ou échec).
    const tBeforeStruct = Date.now();
    const { structure, tokensUsed: structureTokens } = description
        ? await structureSessionDescription({
            description,
            sportType,
            durationMinutes: w.duration,
            profile,
        })
        : { structure: [], tokensUsed: 0 };
    const tStruct = Date.now() - tBeforeStruct;
    console.log(`[generateSingleWorkoutFromAI] ⏱️ STRUCT terminé en ${tStruct}ms`);

    const tTotal = Date.now() - tStart;
    console.log(`[generateSingleWorkoutFromAI] ⏱️ DONE ${sportType} — total=${tTotal}ms (gen=${tGen}ms + struct=${tStruct}ms)`);

    return {
        workout: {
            id: oldWorkout?.id || generateWorkoutId(date, sportType),
            date: date,
            sportType,
            title: w.title,
            workoutType: w.type,
            mode: w.mode,
            status: 'pending' as const,
            plannedData: {
                durationMinutes: w.duration,
                plannedTSS: w.tss ?? null,
                targetPowerWatts: null,
                targetPaceMinPerKm: null,
                targetHeartRateBPM: null,
                distanceKm: null,
                description,
                structure,
            },
            completedData: null,
        },
        tokensUsed: tokensUsed + structureTokens,
    };
}


/**
 * Génère une analyse post-séance à vraie valeur ajoutée.
 * Adapte le contenu au niveau du sportif et au type de séance (libre vs planifiée).
 */
export async function generateWorkoutSummary(
    profile: Profile,
    workout: Workout
): Promise<{ summary: string; tokensUsed: number }> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
    if (!workout.completedData) return { summary: "", tokensUsed: 0 };

    const cd = workout.completedData;
    const planned = workout.plannedData;
    const sport = workout.sportType;
    const ftp = profile.cycling?.Test?.ftp;
    const experience = profile.experience ?? 'Intermédiaire';
    const hasPlanned = planned && (planned.durationMinutes || planned.plannedTSS || planned.targetPowerWatts);

    // ── Métriques de base ──────────────────────────────────
    let metricsStr = `Durée: ${cd.actualDurationMinutes}min, Distance: ${cd.distanceKm}km`;
    if (cd.heartRate?.avgBPM) metricsStr += `, FC moy: ${cd.heartRate.avgBPM}bpm`;
    if (cd.heartRate?.maxBPM) metricsStr += `, FC max: ${cd.heartRate.maxBPM}bpm`;
    if (cd.perceivedEffort != null) metricsStr += `, RPE: ${cd.perceivedEffort}/10`;

    if (sport === 'cycling' && cd.metrics?.cycling) {
        const c = cd.metrics.cycling;
        if (c.avgPowerWatts) metricsStr += `, Puissance moy: ${c.avgPowerWatts}W`;
        if (c.normalizedPowerWatts) metricsStr += `, NP: ${c.normalizedPowerWatts}W`;
        if (c.tss) metricsStr += `, TSS: ${c.tss}`;
        if (c.elevationGainMeters) metricsStr += `, D+: ${c.elevationGainMeters}m`;
    }
    if (sport === 'running' && cd.metrics?.running) {
        const r = cd.metrics.running;
        if (r.avgPaceMinPerKm) metricsStr += `, Allure: ${r.avgPaceMinPerKm}/km`;
        if (r.elevationGainMeters) metricsStr += `, D+: ${r.elevationGainMeters}m`;
    }

    // ── Distribution zones FC (quel stimulus réel) ─────────
    let zonesStr = "";
    if (cd.heartRate?.zoneDistribution && cd.heartRate.zoneDistribution.length >= 3) {
        const z = cd.heartRate.zoneDistribution;
        const zoneNames = ['Z1 Récup', 'Z2 Endurance', 'Z3 Tempo', 'Z4 Seuil', 'Z5 VO2max'];
        zonesStr = "\nDISTRIBUTION ZONES FC: " + z.slice(0, 5).map((pct, i) =>
            `${zoneNames[i] ?? `Z${i + 1}`}: ${Math.round(pct)}%`
        ).join(', ');
    }

    // ── Variabilité (régularité de l'effort) ───────────────
    let stabilityStr = "";
    if (cd.variabilityIndex != null) {
        stabilityStr = `\nINDICE VARIABILITÉ: ${cd.variabilityIndex.toFixed(2)} (1.0 = effort parfaitement stable, >1.15 = effort en yoyo)`;
    }

    // ── Analyse laps : fade rate + découplage ──────────────
    let advancedStr = "";
    if (cd.laps && cd.laps.length > 0) {
        const powerLaps = cd.laps.filter(l => l.avgPower != null && l.avgPower! > 0);
        if (powerLaps.length >= 3) {
            const first = powerLaps[0].avgPower!;
            const last = powerLaps[powerLaps.length - 1].avgPower!;
            const fade = ((first - last) / first) * 100;
            if (Math.abs(fade) > 3) {
                advancedStr += `\nFADE RATE: ${fade.toFixed(1)}% (1er intervalle ${first}W → dernier ${last}W)`;
            }
        }

        const validLaps = cd.laps.filter(l => l.avgPower && l.avgPower > 0 && l.avgHeartRate && l.avgHeartRate > 0);
        if (validLaps.length >= 4) {
            const mid = Math.floor(validLaps.length / 2);
            const ratioHalf = (half: typeof validLaps) => {
                const dur = half.reduce((s, l) => s + l.durationSeconds, 0);
                if (dur === 0) return 0;
                const pw = half.reduce((s, l) => s + l.avgPower! * l.durationSeconds, 0) / dur;
                const hr = half.reduce((s, l) => s + l.avgHeartRate! * l.durationSeconds, 0) / dur;
                return hr > 0 ? pw / hr : 0;
            };
            const r1 = ratioHalf(validLaps.slice(0, mid));
            const r2 = ratioHalf(validLaps.slice(mid));
            if (r1 > 0) {
                const decoupling = ((r1 - r2) / r1) * 100;
                if (Math.abs(decoupling) > 2) {
                    advancedStr += `\nDÉCOUPLAGE AÉROBIE: ${decoupling.toFixed(1)}%`;
                }
            }
        }
    }

    // ── Laps résumé compact ────────────────────────────────
    let lapsStr = "";
    if (cd.laps && cd.laps.length > 0) {
        // Max 6 laps pour limiter les tokens
        const lapsToShow = cd.laps.length > 6 ? cd.laps.slice(0, 6) : cd.laps;
        lapsStr = `\nLAPS (${cd.laps.length}):\n` + lapsToShow.map(l => {
            let s = `- ${l.name}: ${Math.round(l.durationSeconds / 60)}min`;
            if (l.avgPower) s += `, ${l.avgPower}W`;
            if (l.avgHeartRate) s += `, ${l.avgHeartRate}bpm`;
            return s;
        }).join('\n');
    }

    // ── Contexte planifié ──────────────────────────────────
    let plannedStr = "";
    if (hasPlanned) {
        plannedStr = `\nPLANIFIÉ: ${planned!.durationMinutes}min`;
        if (planned!.plannedTSS) plannedStr += `, TSS cible: ${planned!.plannedTSS}`;
        if (planned!.targetPowerWatts) plannedStr += `, Puissance cible: ${planned!.targetPowerWatts}W`;
        if (planned!.description) plannedStr += `\nConsigne: ${planned!.description.substring(0, 200)}`;
    }

    // ── System prompt adapté au niveau et au type ──────────
    const levelInstructions: Record<string, string> = {
        'Débutant': `NIVEAU SPORTIF: DÉBUTANT — Le sportif ne maîtrise pas ses données.
- Traduis TOUT en sensations physiques ("le moment où tu avais du mal à parler, c'est ta zone rouge")
- UNE seule info actionnable, pas de jargon (pas de NP, IF, TSS, découplage)
- Explique à quoi sert ce type de séance dans sa progression
- Si les zones FC sont dispo, dis-lui simplement combien de temps il a passé "facile" vs "dur"`,

        'Intermédiaire': `NIVEAU SPORTIF: INTERMÉDIAIRE — Le sportif lit ses données mais ne voit pas les liens.
- Connecte la séance au reste de sa semaine ou à ses habitudes
- Mentionne la variabilité (effort en yoyo vs stable) si pertinent
- Utilise les termes simples (puissance, zones) mais pas le jargon poussé
- Donne un conseil concret pour la prochaine séance similaire`,

        'Avancé': `NIVEAU SPORTIF: AVANCÉ — Le sportif connaît ses métriques.
- Va droit aux détails qui font la différence (fade rate, découplage, gestion du pacing)
- Mentionne la qualité d'exécution, pas juste les moyennes
- Si les récups entre intervalles semblent mal gérées (puissance haute dans les repos), dis-le
- Utilise le vocabulaire technique quand il apporte de la précision`,
    };

    const workoutTypeInstructions = hasPlanned
        ? `TYPE: SÉANCE PLANIFIÉE avec cibles.
Ce qui compte : la QUALITÉ D'EXÉCUTION, pas juste "tu as fait X vs Y".
- Régularité des intervalles (fade rate = baisse du 1er au dernier)
- Gestion des récupérations entre efforts
- Couplage puissance/FC (si la FC dérive alors que les watts sont stables, l'effort réel était plus dur)
- Si RPE bas et métriques sous les cibles : l'athlète a choisi de rouler facile, ne dis pas "fatigue"
- Si RPE élevé et métriques sous les cibles : vraie difficulté, quelque chose a limité la perf`
        : `TYPE: SORTIE LIBRE (pas de cibles planifiées).
Ce qui compte : identifier le STIMULUS RÉEL de la sortie — ce que le sportif a travaillé, même sans le savoir.
- Utilise la distribution des zones FC pour dire quel système a été sollicité (endurance, tempo, seuil...)
- Si le sportif pensait rouler "tranquille" mais a passé du temps en Z3+, dis-le — c'est de la charge non prévue
- Identifie un pattern dans les laps si visible (départs trop forts en côte, effort en yoyo sur le plat)
- Indique si cette sortie était plutôt un stimulus d'endurance, de tempo, ou un mix`;

    const systemPrompt = `Tu t'adresses directement au sportif (tutoiement). Texte brut, sans HTML ni markdown.

TON: Toujours positif et encourageant. Chaque séance faite est une bonne séance. Valorise l'effort et ce qui a été bien fait. Tu as le droit de donner UN conseil pour progresser, mais toujours formulé positivement ("la prochaine fois tu peux essayer..." et pas "tu n'as pas réussi à...").

RÈGLE D'OR: Ne reformule JAMAIS les chiffres que le sportif peut lire lui-même. Révèle ce qu'il ne peut PAS voir seul : les liens cachés, la qualité derrière les moyennes, le stimulus réel de sa sortie.

${levelInstructions[experience] ?? levelInstructions['Intermédiaire']}

${workoutTypeInstructions}

FORMAT STRICT:
- 2-3 phrases, 3-4 lignes max à l'écran. C'est affiché sur mobile.
- Texte brut UNIQUEMENT. AUCUN HTML (<b>, <br>, <strong>), aucun markdown (**, ##)
- Pas de bullet points, pas de listes — un texte fluide
- Ne répète pas les métriques brutes que le sportif peut lire au-dessus
- Réponds en français`;

    const userPrompt = `SÉANCE: ${workout.title} (${sport}, ${workout.workoutType})
DATE: ${workout.date}
${ftp ? `FTP: ${ftp}W` : ''}
RÉALISÉ: ${metricsStr}${zonesStr}${stabilityStr}${advancedStr}${lapsStr}${plannedStr}`;

    const responseSchema = {
        type: "OBJECT",
        properties: { summary: { type: "STRING" } },
        required: ["summary"]
    };

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.6, maxOutputTokens: 200 },
    };

    const { data, tokensUsed } = await callGeminiAPI(payload);
    const raw = (data as { summary: string }).summary ?? "";
    // Strip any HTML tags that Gemini might sneak in
    return { summary: raw.replace(/<[^>]*>/g, '').trim(), tokensUsed };
}

