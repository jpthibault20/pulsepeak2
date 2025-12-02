import { Profile, Workout } from "../data/type";

// Lecture de la clé API depuis les variables d'environnement du serveur
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const MAX_RETRIES = 5;

// Fonction utilitaire pour le backoff exponentiel
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// NOTE: Le type Workout est importé depuis data/types, non data/crud
/**
 * Génère un plan d'entraînement complet pour 4 semaines ou 7 jours via l'API Gemini.
 */
export async function generatePlanFromAI(
    profile: Profile,
    history: string,
    blockFocus: string,
    customTheme: string | null,
    startDateInput: string | null,
    numWeeks?: number
): Promise<{ synthesis: string, workouts: Omit<Workout, 'status' | 'completedData'>[] }> {
    // LOG CRITIQUE POUR DÉBOGUER LE PROBLÈME DE CONNEXION
    if (!GEMINI_API_KEY) {
        console.error("ERREUR CRITIQUE: GEMINI_API_KEY est NULL ou UNDEFINED. Veuillez vérifier votre fichier .env.local ou les variables d'environnement de déploiement.");
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
    } else {
        // Ne pas logguer la clé, mais confirmer sa présence
        console.log("INFO: GEMINI_API_KEY détectée. Tentative d'appel à l'API Gemini...");
    }
    // FIN LOG CRITIQUE
    console.log(`Appel à l'API Gemini avec la clé: ${GEMINI_API_KEY.substring(0, 5)}...`);
    
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
    
    // Calcul volume hebdo
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

        dateConstraints += `- ${dateStr} (${dayName}): Max ${availability} minutes. ${availability === 0 ? "INTERDICTION DE ROULER (Repos)" : ""}\n`;
    }

    const startDateString = startD.toISOString().split('T')[0];
    const finalFocus = blockFocus === 'Personnalisé' ? customTheme : blockFocus;
    const blockDuration = blockFocus === 'Semaine de Tests (FTP, VO2max)' ? "7 jours (Semaine de Tests)" : 
                                                blockFocus == 'Personnalisé' ? `${numWeeks} semaines (${numWeeks || 0 * 7} jours)` :
                                                "4 semaines (28 jours)";

    // --- Construction du contexte des zones ---
    let zonesContext = "ZONES: Non définies précisément. Utilise les % standard de la FTP.";
    if (profile.zones) {
        const z = profile.zones;
        zonesContext = `
    ZONES DE PUISSANCE ATHLÈTE (À UTILISER DANS LES DESCRIPTIONS):
    - Z1 (Récup): < ${z.z1.max} W
    - Z2 (Endurance): ${z.z2.min}-${z.z2.max} W
    - Z3 (Tempo): ${z.z3.min}-${z.z3.max} W
    - Z4 (Seuil): ${z.z4.min}-${z.z4.max} W
    - Z5 (PMA/VO2max): ${z.z5.min}-${z.z5.max} W
    - Z6 (Anaérobie): ${z.z6.min}-${z.z6.max} W
    - Z7 (Neuro): > ${z.z7.min} W
    `;
    }

    const systemPrompt = "Tu es Entraîneur de Cyclisme 'World Tour'. Tu réponds toujours UNIQUEMENT au format JSON strict.";

    const userPrompt = `
    PROFIL ATHLÈTE:
    - Niveau: ${profile.experience}
    - FTP: ${profile.ftp} W
    - Poids: ${profile.weight || 'Non spécifié'} kg
    - Volume Cible Hebdomadaire: ~${targetHoursFromAvailability}h/semaine.
    
    ${zonesContext}
    
    HISTORIQUE: ${history}
    
    DEMANDE:
    - Début: ${startDateString}
    - Durée: ${blockDuration}
    - Thème: "${finalFocus}"
    
    MISSION:
    1. Analyse conformité (si retard, réduis volume).
    2. Périodisation (3+1 par défaut).
    3. Génère plan jour par jour avec versions Indoor/Outdoor la version indor doit etre différente de la version outdoor pour etre plus ludique.
    4. **IMPORTANT:** Dans les descriptions ("description_outdoor" et "description_indoor"), indique TOUJOURS les watts cibles basés sur les zones fournies ci-dessus (ex: "3x10min Z4 (${profile.zones?.z4.min || '...'}W-${profile.zones?.z4.max || '...'}W)").
    
    RÈGLES CRITIQUES:
    - La durée ("duration") doit TOUJOURS être exprimée en MINUTES (ex: 90, 120, 180). Ne jamais mettre "1.5" pour 1h30.
    - Pour les journée de repos, ne génère pas de séance
    
    CONTRAINTES:
    ${dateConstraints}
    
    FORMAT JSON:
    `;

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
                        "type": { "type": "STRING" },
                        "duration": { "type": "NUMBER", "description": "Durée en MINUTES (Entier, ex: 90)." },
                        "tss": { "type": "NUMBER" },
                        "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"] },
                        "description_outdoor": { "type": "STRING", "description": "Détails avec watts cibles." },
                        "description_indoor": { "type": "STRING", "description": "Détails avec watts cibles." }
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

    return await callGeminiAPI(payload);
}

// Fonction générique pour appeler l'API (inchangée mais incluse pour contexte)
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
                throw new Error(`HTTP error! status: ${response.status}. API Error Body: ${errorBody.substring(0, 500)}`);
            }

            const data = await response.json();
            const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!jsonText || jsonText.trim() === '') {
                throw new Error("AI response structure invalid or empty.");
            }

            return JSON.parse(jsonText);

        } catch (error) {
            if (attempt < MAX_RETRIES - 1) {
                console.warn(`Tentative ${attempt + 1} échouée. Erreur: ${error}`);
                await delay(Math.pow(2, attempt) * 1000 + Math.random() * 1000);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Génère une SEULE séance de remplacement.
 * (Reprend la logique de zonesContext pour la cohérence)
 */
export async function generateSingleWorkoutFromAI(
    profile: Profile,
    date: string,
    currentBlockFocus: string
): Promise<Workout> {
    
    const d = new Date(date);
    const daysMap = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const dayName = daysMap[d.getDay()];
    const availability = profile.weeklyAvailability[dayName];

    let zonesContext = "";
    if (profile.zones) {
        const z = profile.zones;
        zonesContext = `
        ZONES DE PUISSANCE (INCLURE CES VALEURS DANS LA DESCRIPTION):
        - Z1: < ${z.z1.max} W
        - Z2: ${z.z2.min}-${z.z2.max} W
        - Z3: ${z.z3.min}-${z.z3.max} W
        - Z4: ${z.z4.min}-${z.z4.max} W
        - Z5: ${z.z5.min}-${z.z5.max} W
        - Z6: ${z.z6.min}-${z.z6.max} W
        - Z7: > ${z.z7.min} W
        `;
    }

    const systemPrompt = "Tu es un coach cycliste expert. Tu dois générer une séance de remplacement.";
    
    const userPrompt = `
    CONTEXTE: Remplacement séance du ${date} (${dayName}).
    
    PROFIL:
    - FTP: ${profile.ftp} W
    - Poids: ${profile.weight || 70} kg
    ${zonesContext}
    
    CONTRAINTES DU JOUR:
    - Durée Max: ${availability} min (0 = Repos).
    - Focus Bloc: ${currentBlockFocus}
    
    MISSION:
    Propose une séance alternative pertinente. Utilise les plages de watts spécifiques ci-dessus dans les descriptions.
    La durée doit être un entier en MINUTES.
    `;

    const responseSchema = {
        type: "OBJECT",
        properties: {
            "workout": {
                "type": "OBJECT",
                "properties": {
                    "title": { "type": "STRING" },
                    "type": { "type": "STRING" },
                    "duration": { "type": "NUMBER", "description": "Durée en MINUTES." },
                    "tss": { "type": "NUMBER" },
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
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema },
    };

    const result = await callGeminiAPI(payload);
    
    return {
        date: date,
        status: 'pending',
        ...result.workout
    } as Workout;
}