import { Profile } from "../data/DatabaseTypes";
import { SportType } from "../data/type";
import { Workout } from "../data/DatabaseTypes";

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

// Nettoie les sorties IA des caractères "décoratifs" unicode qui s'affichent mal
// dans certaines UI/fonts (flèches, em-dash, puces, guillemets typographiques, etc.)
// Les accents français (é è à etc.) sont conservés car ce sont des lettres valides.
function sanitizeAIText(s: string): string {
    if (!s) return s;
    return s
        .replace(/[→←↑↓⇒⇐↔⇔]/g, ', puis ')
        .replace(/\s?(?:->|=>|-->)\s?/g, ', puis ')
        .replace(/[—–―]/g, '-')
        .replace(/[•◦▪▫●○■□★☆✓✔✗✘]/g, '-')
        .replace(/[“”„]/g, '"')
        .replace(/[‘’‚]/g, "'")
        .replace(/…/g, '...')
        .replace(/\u00A0/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// Tronque un titre à maxLen caractères en respectant la frontière de mot.
// Retire la ponctuation finale pour un rendu propre.
function smartTruncateTitle(s: string, maxLen = 70): string {
    const clean = sanitizeAIText(s);
    if (clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    const base = lastSpace > 30 ? cut.slice(0, lastSpace) : cut;
    return base.replace(/[\s,;:.\-]+$/, '').trim();
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
    description_outdoor: string;
    description_indoor: string;
}

// Résultat d'un appel Gemini avec les tokens consommés
export interface GeminiResult<T = unknown> {
    data: T;
    tokensUsed: number;
}

// Fonction générique pour appeler l'API
export async function callGeminiAPI(payload: unknown): Promise<GeminiResult> {
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

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enhancedPayload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorBody.substring(0, 200)}`);
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const tokensUsed: number = data.usageMetadata?.totalTokenCount ?? 0;

            if (!rawText) throw new Error("AI response empty.");

            // Nettoyage du markdown éventuel
            const cleanText = rawText
                .trim()
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '');

            try {
                return { data: JSON.parse(cleanText), tokensUsed };
            } catch (parseError) {
                console.error("JSON invalide reçu de Gemini :", cleanText);
                throw new Error(`JSON parsing failed: ${parseError}`);
            }

        } catch (error) {
            if (attempt < MAX_RETRIES - 1) {
                console.warn(`Tentative ${attempt + 1} échouée. Retry dans ${Math.pow(2, attempt)}s...`);
                await delay(Math.pow(2, attempt) * 1000);
            } else {
                throw error;
            }
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
8. **Descriptions OBLIGATOIRES** : 
   - description_indoor : DOIT contenir la structure précise des intervalles (ex: "10min Z1, 5x(30s Z5/30s Z1)...") pour TOUTES les séances, même celles prévues Outdoor (pour export Zwift/Garmin). JAMAIS de "N/A".
   - description_outdoor : DOIT contenir les conseils de route/terrain (ex: "Route vallonnée, maintiens la cadence dans les bosses").
FORMAT DE RÉPONSE :
- Tu dois répondre UNIQUEMENT avec le JSON validé par le schéma fourni.
- Aucune phrase d'introduction ou de conclusion.
- Les descriptions des séances doivent être techniques mais motivantes (style coach).
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

                        "description_outdoor": { "type": "STRING", "description": "Consignes de terrain et sensations (Ne jamais mettre N/A)"},
                        "description_indoor": { "type": "STRING", "description": "Structure technique PAS À PAS des blocs et intervalles (Ne jamais mettre N/A, même si mode=Outdoor)"}
                    },
                    "required": ["date", "sport", "title", "type", "duration", "mode", "description_outdoor", "description_indoor"]
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

                    description: w.description_outdoor ?? w.description_indoor ?? null,
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
 * Génère une SEULE séance de remplacement.
 */
export async function generateSingleWorkoutFromAI(
    profile: Profile,
    history: unknown,
    date: string,
    surroundingWorkouts: Record<string, string>,
    oldWorkout?: Workout,
    currentBlockFocus: string = "General Fitness",
    userInstruction?: string,
    sportType?: SportType
): Promise<{ workout: Omit<Workout, 'userId' | 'weekId'>; tokensUsed: number }> {

    // Résolution du sport: paramètre explicite > sport de la séance existante > cyclisme (défaut cycliste)
    const currentSport: SportType = sportType ?? oldWorkout?.sportType ?? 'cycling';

    const d = new Date(date);
    const dayName = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][d.getDay()];
    // Disponibilité du jour pour le sport ciblé (fallback 60min)
    const slot = profile.weeklyAvailability?.[dayName];
    const availabilityKey: 'cycling' | 'running' | 'swimming' = currentSport === 'other' ? 'cycling' : currentSport;
    const availability: number = (slot && typeof slot[availabilityKey] === 'number' && slot[availabilityKey] > 0)
        ? slot[availabilityKey]
        : 60;

    // Contexte zones adapté au sport cible
    let zonesContext = "";
    if (currentSport === 'cycling' && profile.cycling?.Test?.zones) {
        const z = profile.cycling.Test.zones;
        zonesContext = `ZONES VÉLO (W): Z2 ${z.z2.min}-${z.z2.max}, Z4 ${z.z4.min}-${z.z4.max}, Z5 ${z.z5.min}-${z.z5.max}. FTP: ${profile.cycling?.Test?.ftp ?? '?'}W.`;
    } else if (currentSport === 'running') {
        zonesContext = `RUNNING: utilise les allures Z1-Z5 classiques basées sur l'allure seuil (si connue, sinon raisonne en RPE/FC).`;
    } else if (currentSport === 'swimming') {
        zonesContext = `NATATION: structure en séries (ex: 10x100m), allures en min/100m, intensités par sensation (Z1 facile à Z5 sprint).`;
    }

    const scheduleContextStr = Object.entries(surroundingWorkouts)
        .map(([d, desc]) => `- ${d}: ${desc}`)
        .join('\n');

    let oldWorkoutContext = "Nouveau créneau (pas de séance existante à remplacer).";
    if (oldWorkout) {
        oldWorkoutContext = `REMPLACE: ${oldWorkout.sportType.toUpperCase()} - ${oldWorkout.title} (${oldWorkout.workoutType}, ${oldWorkout.plannedData?.durationMinutes ?? 0}min)`;
    }

    const userDirective = userInstruction ? `DEMANDE UTILISATEUR: "${userInstruction}"` : "Propose une alternative pertinente.";

    const sportLabel = currentSport === 'cycling' ? 'CYCLISME' : currentSport === 'running' ? 'COURSE À PIED' : currentSport === 'swimming' ? 'NATATION' : currentSport.toUpperCase();

    // Spécialisation du rôle du coach + consignes techniques par sport (évite les séances "globales")
    type SportPromptSpec = {
        role: string;
        methodology: string;
        workoutTypes: string;
        structureRules: string;
        indoorExample: string;
        outdoorExample: string;
        titleExample: string;
    };
    const sportSpecs: Record<Exclude<SportType, 'other'>, SportPromptSpec> = {
        cycling: {
            role: "Tu es coach cyclisme d'équipe World Tour (spécialisation route/CLM), formé à la méthodologie Coggan/Allen.",
            methodology: "Raisonne en puissance (W), FTP, TSS, IF. Utilise les 7 zones de Coggan. Alterne volume et intensité.",
            workoutTypes: "Endurance Z2, Tempo/Sweet Spot, Seuil (Z4/FTP), VO2max (Z5), Anaérobie (Z6), Sprint/Neuromusculaire (Z7), Récupération active.",
            structureRules: "Toujours: échauffement progressif (10-15min, finir par 2-3 activations courtes), puis corps de séance structuré, puis retour au calme Z1. Précise cadence cible (rpm) pour les blocs clés.",
            indoorExample: "15min progressif Z1 à Z2 (85-95 rpm) + 3x(30s all-out R:30s), puis 4x8min Z4 à 260-275W (90 rpm) R:4min Z1, puis 10min Z1 retour au calme.",
            outdoorExample: "Sortie 2h30 sur parcours vallonné. Maintenir Z2 (195-230W) sur le plat, accepter Z3 dans les bosses <5min, ne JAMAIS dépasser Z4. Cadence 85-95 rpm, relâche le buste en bosse.",
            titleExample: "Ex: 'Seuil 4x8min à FTP', 'Sortie Z2 longue vallonnée', 'VO2max 5x3min'."
        },
        running: {
            role: "Tu es coach course à pied (demi-fond/marathon), formé à la méthodologie Daniels/Pfitzinger.",
            methodology: "Raisonne en allures (min/km), FC, RPE. Utilise les zones VDOT (E, M, T, I, R) ou Z1-Z5 classiques. Attention aux impacts et à la progressivité.",
            workoutTypes: "Endurance fondamentale (E), Allure marathon (M), Seuil (T, 20-40min cumulé), VMA/Intervalles (I), Lignes droites/Sprint (R), Récupération, Sortie longue.",
            structureRules: "Toujours: échauffement 15-20min en Z1-Z2 + gammes (montées de genoux, talons-fesses, lignes droites), puis corps de séance, puis retour au calme 10min Z1 + étirements. Précise allure cible en min/km pour chaque bloc.",
            indoorExample: "Tapis. 15min Z1-Z2 progressif, puis 6x(3min à allure seuil 4:15/km R:1min30 trot), puis 10min Z1.",
            outdoorExample: "Footing 1h en forêt, allure conversationnelle (5:20-5:35/km), FC < 75% FCmax. Si côte: raccourcis la foulée, accepte +15s/km, pas de forçage cardiaque.",
            titleExample: "Ex: 'Fractionné 6x3min Seuil', 'Sortie longue 1h30 Z2', 'VMA 10x400m'."
        },
        swimming: {
            role: "Tu es coach de natation sportive (expertise crawl/triathlon et natation course), formé à la méthodologie USRPT et aux techniques swim-smooth.",
            methodology: "Raisonne en distances (m), allures (min/100m ou sec/25m), temps de récupération explicites (R:15s, R:30s...). Zones: EN1 (aérobie facile), EN2 (aérobie maintien), EN3 (seuil lactique), VMA aquatique (VO2), Sprint. Utilise le RPE si pas de temps cible.",
            workoutTypes: "Technique/Éducatifs (rattrapé, 3 temps, poings fermés, 6-1-6, polo...), Aérobie continu, Fractionné seuil, VMA courte, Sprint, Endurance spécifique triathlon, Récupération.",
            structureRules: `STRUCTURE OBLIGATOIRE en 4 blocs chiffrés en mètres:
  1. ÉCHAUFFEMENT (300-600m): mix nages, drills techniques, progressif.
  2. ÉDUCATIFS/TECHNIQUE (200-600m): 2 à 4 exos ciblés (glisse, équilibre, catch, respiration bilatérale...).
  3. SÉRIE PRINCIPALE: format XxYm à allure/RPE précis avec récup explicite (ex: "8x100m crawl à RPE 8 R:20s").
  4. RETOUR AU CALME (100-300m): souple, mix nages ou dos crawlé.
  Mentionne le matériel si pertinent (pull-buoy, plaquettes, palmes, planche, tuba frontal). Précise le bassin (25m ou 50m) si impact sur la série.`,
            indoorExample: "Bassin 25m. Échauffement 400m (200 crawl souple + 4x50 alterné dos/crawl). Technique 300m (6x50: 25 rattrapé / 25 crawl normal R:15s). Série 8x100m crawl à allure seuil (1:35/100m) R:20s. Retour 200m dos crawlé souple.",
            outdoorExample: "Eau libre (lac). Échauffement 10min crawl souple avec 4 accélérations de 20s. Série: 3x(8min allure seuil, sighting toutes les 6 brasses, R:1min surplace) + travail virages de bouée si possible. Retour 5min brasse ou dos souple.",
            titleExample: "Ex: 'Seuil 8x100m crawl', 'Technique et aérobie 2000m', 'Triathlon: 10x200 eau libre'."
        },
    };
    const spec = sportSpecs[currentSport === 'other' ? 'cycling' : currentSport];

    const systemPrompt = `
${spec.role}
MISSION: Générer UNE séance de ${sportLabel} JSON, PRÉCISE, personnalisée, jamais générique.

MÉTHODOLOGIE:
${spec.methodology}

TYPES DE SÉANCES POSSIBLES (${sportLabel}):
${spec.workoutTypes}

STRUCTURE IMPOSÉE:
${spec.structureRules}

RÈGLES D'OR:
1. Sport imposé: ${sportLabel} uniquement. N'en change JAMAIS.
2. Précision > généralité: une séance doit être exécutable telle quelle, avec blocs chiffrés, distances/durées, intensités et récupérations explicites. INTERDIT: formulations vagues comme "faire de l'endurance", "nager tranquille", "intervalles courts".
3. Physiologie claire: un seul objectif principal par séance.
4. Respect des zones/allures: utilise les valeurs fournies dans le profil, ne les invente pas.
5. Contraintes horaire: ne dépasse JAMAIS la disponibilité du jour (${availability} min).
6. Cohérence semaine: ne duplique pas une séance voisine (même focus/intensité) déjà programmée.
7. SÉPARATION TITRE / DESCRIPTION - très important:
   - "title" = ÉTIQUETTE courte, max 60 caractères, style nom de séance. JAMAIS une phrase complète, JAMAIS la structure détaillée, JAMAIS de "+" ou "puis". Une étiquette qu'on lit en 1 seconde.
     Exemples valides: ${spec.titleExample}
     Contre-exemples INTERDITS: "Seuil 4x8min à FTP avec 15min échauffement puis 10min retour au calme" (trop long, contient la structure).
   - "description_indoor" = structure pas à pas des blocs (exemple ${sportLabel}: "${spec.indoorExample}").
   - "description_outdoor" = consignes terrain/sensations (exemple ${sportLabel}: "${spec.outdoorExample}").
   - Les DEUX descriptions sont OBLIGATOIRES, JAMAIS "N/A", JAMAIS vides. Indoor est requise même si mode=Outdoor (export Zwift/Garmin).
   - description_indoor et description_outdoor doivent être DIFFÉRENTES l'une de l'autre (contenu adapté au contexte).
8. COHÉRENCE mode/description:
   - Si mode="Indoor": la séance se fait sur home-trainer/tapis/bassin intérieur. description_indoor décrit la structure principale à suivre. description_outdoor reste pertinente (utile si l'athlète sort finalement dehors) mais ne parle PAS du home-trainer.
   - Si mode="Outdoor": la séance se fait dehors. description_outdoor décrit l'exécution dehors. description_indoor reste utilisable (version indoor équivalente en cas de mauvais temps).
9. CARACTÈRES AUTORISÉS: lettres (accents français inclus: é è à ê î ô ù ç), chiffres, espaces et ponctuation standard (. , : ; ! ? ' " ( ) [ ] - / %). INTERDIT STRICTEMENT: flèches unicode (→ ← ↓ ↑), double-flèches ASCII (->, =>), em-dash et en-dash (— –), tirets cadratins, puces décoratives (• ◦ ▪), symboles mathématiques décoratifs, emojis. Pour enchaîner des blocs dans la description: utilise ", puis ", ". " ou des phrases séparées.
10. Format: réponds UNIQUEMENT avec le JSON validé par le schéma. Pas de texte hors JSON.
`;

    const userPrompt = `
DATE: ${date} (${dayName})
SPORT IMPOSÉ: ${sportLabel}
PROFIL ATHLÈTE: ${zonesContext}
DISPO MAX: ${availability} min
FOCUS DU BLOC: ${currentBlockFocus}

${oldWorkoutContext}
${userDirective}

CONTEXTE SEMAINE (séances voisines, à ne PAS dupliquer ni téléscoper):
${scheduleContextStr || "(aucune séance voisine)"}

Génère l'objet JSON pour UNE séance de ${sportLabel}, PRÉCISE et exécutable clé en main.
`;

    const responseSchema = {
        type: "OBJECT",
        properties: {
            "workout": {
                "type": "OBJECT",
                "properties": {
                    "title": { "type": "STRING", "description": "Étiquette courte de la séance. Max 60 caractères. Style nom/label (ex: 'Seuil 4x8min', 'Natation technique 2000m'). PAS une phrase, PAS la structure détaillée." },
                    "type": { "type": "STRING", "description": "Catégorie physiologique (Endurance, Seuil, VO2max, Technique, Récupération, etc.)" },
                    "duration": { "type": "NUMBER", "description": "Durée totale en minutes, <= disponibilité du jour" },
                    "tss": { "type": "NUMBER", "description": "TSS estimé de la séance" },
                    "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"] },
                    "description_outdoor": { "type": "STRING", "description": "Consignes terrain/sensations adaptées au sport. Ne jamais mettre N/A ni vide. Doit différer de description_indoor." },
                    "description_indoor": { "type": "STRING", "description": "Structure technique pas-à-pas des blocs/intervalles. Ne jamais mettre N/A ni vide, même si mode=Outdoor. Doit différer de description_outdoor." }
                },
                "required": ["title", "type", "duration", "tss", "mode", "description_outdoor", "description_indoor"]
            }
        },
        "required": ["workout"]
    };

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        // Température basse pour stabilité du format (titre court, descriptions distinctes)
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema, temperature: 0.5 },
    };

    const { data: resultData, tokensUsed } = await callGeminiAPI(payload);
    const w = (resultData as { workout: Omit<RawAIWorkout, 'date'> }).workout;

    // Nettoyage défensif: N/A / vide -> null, et normalisation via le sanitizer commun
    const cleanDesc = (s: string | null | undefined): string | null => {
        if (!s) return null;
        const cleaned = sanitizeAIText(s);
        if (!cleaned || /^n\/?a$/i.test(cleaned)) return null;
        return cleaned;
    };
    // Pick la description adaptée au mode:
    // - Indoor: structure pas-à-pas (description_indoor) d'abord
    // - Outdoor: consignes terrain (description_outdoor) d'abord
    // Avec fallback sur l'autre si la première est vide/N/A.
    const indoorClean = cleanDesc(w.description_indoor);
    const outdoorClean = cleanDesc(w.description_outdoor);
    const description = w.mode === 'Indoor'
        ? (indoorClean ?? outdoorClean)
        : (outdoorClean ?? indoorClean);

    // Titre: troncature intelligente (frontière de mot) à 70 chars + fallback
    const cleanTitle = smartTruncateTitle(w.title || '', 70) || oldWorkout?.title || 'Séance';
    // Clamp de la durée à la disponibilité du jour (garde-fou, au cas où l'IA dépasse)
    const safeDuration = Math.min(Math.max(Math.round(w.duration) || 0, 15), availability);

    // Transformation vers la nouvelle structure
    return {
        workout: {
            id: oldWorkout?.id || generateWorkoutId(date, currentSport),
            date: date,
            sportType: currentSport,
            title: cleanTitle,
            workoutType: sanitizeAIText(w.type || '') || 'Endurance',
            mode: w.mode,
            status: 'pending' as const,
            plannedData: {
                durationMinutes: safeDuration,
                plannedTSS: w.tss ?? null,
                targetPowerWatts: null,
                targetPaceMinPerKm: null,
                targetHeartRateBPM: null,
                distanceKm: null,
                description,
            },
            completedData: null,
        },
        tokensUsed,
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
                advancedStr += `\nFADE RATE: ${fade.toFixed(1)}% (1er intervalle ${first}W, dernier ${last}W)`;
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
        'Débutant': `NIVEAU SPORTIF: DÉBUTANT. Le sportif ne maîtrise pas ses données.
- Traduis TOUT en sensations physiques ("le moment où tu avais du mal à parler, c'est ta zone rouge")
- UNE seule info actionnable, pas de jargon (pas de NP, IF, TSS, découplage)
- Explique à quoi sert ce type de séance dans sa progression
- Si les zones FC sont dispo, dis-lui simplement combien de temps il a passé "facile" vs "dur"`,

        'Intermédiaire': `NIVEAU SPORTIF: INTERMÉDIAIRE. Le sportif lit ses données mais ne voit pas les liens.
- Connecte la séance au reste de sa semaine ou à ses habitudes
- Mentionne la variabilité (effort en yoyo vs stable) si pertinent
- Utilise les termes simples (puissance, zones) mais pas le jargon poussé
- Donne un conseil concret pour la prochaine séance similaire`,

        'Avancé': `NIVEAU SPORTIF: AVANCÉ. Le sportif connaît ses métriques.
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
Ce qui compte : identifier le STIMULUS RÉEL de la sortie, ce que le sportif a travaillé même sans le savoir.
- Utilise la distribution des zones FC pour dire quel système a été sollicité (endurance, tempo, seuil...)
- Si le sportif pensait rouler "tranquille" mais a passé du temps en Z3+, dis-le, c'est de la charge non prévue
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
- Pas de bullet points, pas de listes, un texte fluide
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
    // Strip HTML puis normalise les caractères décoratifs unicode
    const stripped = raw.replace(/<[^>]*>/g, '').trim();
    return { summary: sanitizeAIText(stripped), tokensUsed };
}

