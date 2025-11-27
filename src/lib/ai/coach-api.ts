import { Profile, Workout } from "../data/type";

// Lecture de la clé API depuis les variables d'environnement du serveur
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const MAX_RETRIES = 5;

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction générique pour appeler l'API (pour éviter la duplication de code)
async function callGeminiAPI(payload: unknown) {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

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
 */
export async function generateSingleWorkoutFromAI(
    profile: Profile,
    date: string,
    currentBlockFocus: string
): Promise<Workout> {
    
    // Trouver le jour de la semaine pour la dispo
    const d = new Date(date);
    const daysMap = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const dayName = daysMap[d.getDay()];
    const availability = profile.weeklyAvailability[dayName];

    const systemPrompt = "Tu es un coach cycliste expert. Tu dois générer une séance de remplacement.";
    
    const userPrompt = `
    CONTEXTE:
    L'athlète souhaite remplacer sa séance du ${date} (${dayName}).
    
    PROFIL:
    - Niveau: ${profile.experience}
    - FTP: ${profile.ftp} W
    - Poids: ${profile.weight || 70} kg
    - Points Faibles: ${profile.weaknesses}
    
    CONTRAINTES DU JOUR:
    - Durée Max Disponible: ${availability} minutes (Si 0, génère du Repos).
    - Focus du Bloc Actuel: ${currentBlockFocus}
    
    MISSION:
    Propose une séance alternative pertinente qui s'inscrit bien dans le bloc actuel mais varie par rapport à une séance standard. 
    Sois créatif tout en restant scientifique (Zones Coggan).
    Génère les versions Indoor et Outdoor.
    `;

    const responseSchema = {
        type: "OBJECT",
        properties: {
            "workout": {
                "type": "OBJECT",
                "properties": {
                    "title": { "type": "STRING", "description": "Titre Court & Pro." },
                    "type": { "type": "STRING", "description": "Type d'effort." },
                    "duration": { "type": "NUMBER", "description": "Durée en minutes." },
                    "tss": { "type": "NUMBER", "description": "TSS estimé." },
                    "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"], "description": "Mode recommandé." },
                    "description_outdoor": { "type": "STRING", "description": "Détails extérieur." },
                    "description_indoor": { "type": "STRING", "description": "Détails home trainer." }
                },
                "required": ["title", "type", "duration", "tss", "mode", "description_outdoor", "description_indoor"]
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
        },
    };

    const result = await callGeminiAPI(payload);
    
    // On retourne un objet Workout complet en fusionnant avec la date
    return {
        date: date,
        status: 'pending',
        ...result.workout
    } as Workout;
}

/**
 * Génère un plan d'entraînement complet (Fonction existante conservée et refactorisée pour utiliser callGeminiAPI).
 */
export async function generatePlanFromAI(
    profile: Profile,
    history: string,
    blockFocus: string,
    customTheme: string | null,
    startDateInput: string | null
): Promise<{ synthesis: string, workouts: Omit<Workout, 'status' | 'completedData'>[] }> {

    // --- Logique de Date et Durée ---
    let startD = new Date();
    if (startDateInput) {
        startD = new Date(startDateInput);
    } else {
        startD.setDate(startD.getDate() + 1);
    }

    let numDays = 28;
    if (blockFocus === 'Semaine de Tests (FTP, VO2max)') {
        numDays = 7;
    }

    const daysMap = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    let dateConstraints = "";
    
    // Calcul volume hebdo (même logique qu'avant)
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
    const blockDuration = blockFocus === 'Semaine de Tests (FTP, VO2max)' ? "7 jours (Semaine de Tests)" : "4 semaines (28 jours)";

    const systemPrompt = "Tu es un Directeur Sportif et Entraîneur de Cyclisme 'World Tour'. Tu réponds toujours UNIQUEMENT au format JSON strict.";
    const userPrompt = `
    PROFIL ATHLÈTE:
    - Niveau: ${profile.experience}
    - FTP: ${profile.ftp} W
    - Poids: ${profile.weight || 'Non spécifié'} kg
    - Volume Cible Hebdomadaire: ~${targetHoursFromAvailability}h/semaine.
    
    HISTORIQUE: ${history}
    
    DEMANDE:
    - Début: ${startDateString}
    - Durée: ${blockDuration}
    - Thème: "${finalFocus}"
    
    MISSION:
    1. Analyse conformité (si retard, réduis volume).
    2. Périodisation (3+1 par défaut).
    3. Génère plan jour par jour avec versions Indoor/Outdoor.
    
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
                        "duration": { "type": "NUMBER" },
                        "tss": { "type": "NUMBER" },
                        "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"] },
                        "description_outdoor": { "type": "STRING" },
                        "description_indoor": { "type": "STRING" }
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