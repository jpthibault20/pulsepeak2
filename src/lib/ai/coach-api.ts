import { Profile, Workout, SportType } from "../data/type";

// Lecture de la clé API depuis les variables d'environnement du serveur
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const MAX_RETRIES = 5;

interface RawAIWorkout {
    date: string; // Présent uniquement dans la génération de plan complet
    title: string;
    type: string;
    duration: number;
    tss: number;
    mode: 'Outdoor' | 'Indoor';
    description_outdoor: string;
    description_indoor: string;
}

// Fonction utilitaire pour le backoff exponentiel
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction utilitaire pour générer des IDs uniques
function generateWorkoutId(date: string, sport: SportType): string {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${sport}_${date.replace(/-/g, '')}_${randomSuffix}`;
}

/**
 * Génère un plan d'entraînement complet via l'API Gemini.
 */
export async function generatePlanFromAI(
    profile: Profile,
    history: string,
    blockFocus: string,
    customTheme: string | null,
    startDateInput: string | null,
    numWeeks?: number
): Promise<{ synthesis: string, workouts: Workout[] }> {
    if (!GEMINI_API_KEY) {
        console.error("ERREUR CRITIQUE: GEMINI_API_KEY est NULL.");
        throw new Error("GEMINI_API_KEY is not set.");
    }

    console.log(`Appel à l'API Gemini...`);

    // --- Logique de Périodisation ---
    let startD = new Date();
    if (startDateInput) {
        startD = new Date(startDateInput);
    } else {
        startD.setDate(startD.getDate() + 1);
    }

    let numDays = 28; // 4 semaines par défaut

    if (blockFocus === 'Semaine de Tests (FTP, VO2max)') {
        numDays = 7;
    }

    const daysMap = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    let dateConstraints = "";

    // TODO: Multisport Evolution - Calculer la dispo par sport si nécessaire à l'avenir
    let totalWeeklyMinutesAvailable = 0;
    if (profile.weeklyAvailability) {
        totalWeeklyMinutesAvailable = Object.values(profile.weeklyAvailability).reduce((acc, val) => acc + val, 0);
    }
    const targetHoursFromAvailability = Math.floor(totalWeeklyMinutesAvailable / 60);

    for (let i = 0; i < numDays; i++) {
        const d = new Date(startD);
        d.setDate(d.getDate() + i);
        const dayIndex = d.getDay();
        const dayName = daysMap[dayIndex];
        const availability = profile.weeklyAvailability[dayName];
        const dateStr = d.toISOString().split('T')[0];

        // TODO: Multisport Evolution - Préciser ici si un jour est dédié au Running ou Swimming
        dateConstraints += `- ${dateStr} (${dayName}): Max ${availability} minutes. ${availability === 0 ? "INTERDICTION DE ROULER (Repos)" : ""}\n`;
    }

    const startDateString = startD.toISOString().split('T')[0];
    const finalFocus = blockFocus === 'Personnalisé' ? customTheme : blockFocus;
    const blockDuration = blockFocus === 'Semaine de Tests (FTP, VO2max)' ? "7 jours" :
        blockFocus == 'Personnalisé' ? `${numWeeks} semaines` : "4 semaines";

    // --- Contextes ---
    let zonesContext = "ZONES: Utilise les % FTP standard.";
    if (profile.zones) {
        const z = profile.zones;
        zonesContext = `ZONES ATHLÈTE (W): Z1 <${z.z1.max}, Z2 ${z.z2.min}-${z.z2.max}, Z3 ${z.z3.min}-${z.z3.max}, Z4 ${z.z4.min}-${z.z4.max}, Z5 ${z.z5.min}-${z.z5.max}`;
    }

    const systemPrompt = "Tu es Entraîneur de Cyclisme 'World Tour'. Tu réponds toujours UNIQUEMENT au format JSON strict.";

    const userPrompt = `
    PROFIL: Niveau ${profile.experience}, FTP ${profile.ftp}W, Poids ${profile.weight || '?'}kg.
    Volume hebdo max: ~${targetHoursFromAvailability}h.
    
    ${zonesContext}
    
    HISTORIQUE: ${history}
    
    DEMANDE:
    - Début: ${startDateString}
    - Durée: ${blockDuration}
    - Thème: "${finalFocus}"
    
    MISSION:
    1. Génère un plan jour par jour (Sport: CYCLISME uniquement pour l'instant).
    2. Description Indor et Outdoor avec les WATTS cibles.
    
    RÈGLES:
    - Durée en MINUTES.
    - Pas de séance les jours de repos (dispo = 0).
    
    CONTRAINTES:
    ${dateConstraints}
    
    FORMAT JSON ATTENDU (Array 'workouts'):
    `;

    // On demande un format plat à l'IA pour simplifier la génération, on transformera en structure complexe après
    const responseSchema = {
        type: "OBJECT",
        properties: {
            "synthesis": { "type": "STRING" },
            "workouts": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "date": { "type": "STRING" },
                        "title": { "type": "STRING" },
                        "type": { "type": "STRING" }, // Deviendra workoutType
                        "duration": { "type": "NUMBER" }, // Deviendra plannedData.durationMinutes
                        "tss": { "type": "NUMBER" }, // Deviendra plannedData.plannedTSS
                        "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"] },
                        "description_outdoor": { "type": "STRING" }, // Deviendra plannedData.descriptionOutdoor
                        "description_indoor": { "type": "STRING" }   // Deviendra plannedData.descriptionIndoor
                    },
                    "required": ["date", "title", "type", "duration", "tss", "mode", "description_outdoor", "description_indoor"]
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

    const rawResponse = await callGeminiAPI(payload) as { synthesis: string, workouts: RawAIWorkout[] };

    // Transformation de la réponse de l'IA vers la nouvelle structure de données (Workout[])
    const structuredWorkouts: Workout[] = rawResponse.workouts.map((w) => ({
        id: generateWorkoutId(w.date, 'cycling'),
        date: w.date,
        sportType: 'cycling',
        title: w.title,
        workoutType: w.type, // TS sait maintenant que w.type existe
        mode: w.mode,
        status: 'pending',
        plannedData: {
            durationMinutes: w.duration,
            plannedTSS: w.tss,
            descriptionOutdoor: w.description_outdoor,
            descriptionIndoor: w.description_indoor,
            distanceKm: 0
        },
        completedData: null
    }));

    return {
        synthesis: rawResponse.synthesis,
        workouts: structuredWorkouts
    };
}

// Fonction générique pour appeler l'API
async function callGeminiAPI(payload: unknown) {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorBody.substring(0, 200)}`);
            }

            const data = await response.json();
            const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!jsonText) throw new Error("AI response empty.");

            return JSON.parse(jsonText);

        } catch (error) {
            if (attempt < MAX_RETRIES - 1) {
                console.warn(`Tentative ${attempt + 1} échouée. Retry...`);
                await delay(Math.pow(2, attempt) * 1000);
            } else {
                throw error;
            }
        }
    }
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
    userInstruction?: string
): Promise<Workout> {

    // Le type de sport est forcé à vélo pour l'instant
    const currentSport: SportType = 'cycling'; // TODO: Passer le sport en paramètre si on supporte la course à pied plus tard

    // .. (Extraction des dispos inchangée) ..
    const d = new Date(date);
    const dayName = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][d.getDay()];
    const availability = profile.weeklyAvailability[dayName] || 60;

    let zonesContext = "";
    if (profile.zones) {
        // Version simplifiée pour économiser des tokens
        const z = profile.zones;
        zonesContext = `ZONES (W): Z2 ${z.z2.min}-${z.z2.max}, Z4 ${z.z4.min}-${z.z4.max}, Z5 ${z.z5.min}-${z.z5.max}`;
    }

    const scheduleContextStr = Object.entries(surroundingWorkouts)
        .map(([d, desc]) => `- ${d}: ${desc}`)
        .join('\n');

    let oldWorkoutContext = "Nouveau créneau.";
    if (oldWorkout) {
        oldWorkoutContext = `REMPLACE: ${oldWorkout.title} (${oldWorkout.workoutType}, ${oldWorkout.plannedData.durationMinutes}min)`;
    }

    const userDirective = userInstruction ? `DEMANDE UTILISATEUR: "${userInstruction}"` : "Propose une alternative pertinente.";

    const systemPrompt = "Tu es expert cyclisme. JSON uniquement.";

    const userPrompt = `
    DATE: ${date}. SPORT: ${currentSport.toUpperCase()}.
    PROFIL: FTP ${profile.ftp}. ${zonesContext}.
    DISPO MAX: ${availability} min.
    FOCUS: ${currentBlockFocus}.
    
    ${oldWorkoutContext}
    ${userDirective}
    
    CONTEXTE SEMAINE:
    ${scheduleContextStr}
    
    Génère un objet JSON pour la séance.
    `;

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
                    "description_outdoor": { "type": "STRING" },
                    "description_indoor": { "type": "STRING" }
                },
                "required": ["title", "type", "duration", "tss", "mode", "description_outdoor", "description_indoor"]
            }
        },
        "required": ["workout"]
    };

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema, temperature: 0.7 },
    };

    const result = await callGeminiAPI(payload) as { workout: Omit<RawAIWorkout, 'date'> };
    const w = result.workout;

    // Transformation vers la nouvelle structure
    return {
        id: oldWorkout?.id || generateWorkoutId(date, currentSport),
        date: date,
        sportType: currentSport,
        title: w.title,
        workoutType: w.type,
        mode: w.mode,
        status: 'pending',
        plannedData: {
            durationMinutes: w.duration,
            plannedTSS: w.tss,
            descriptionOutdoor: w.description_outdoor,
            descriptionIndoor: w.description_indoor
        },
        completedData: null
    } as Workout;
}
