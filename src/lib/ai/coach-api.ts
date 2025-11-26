import { Profile, Workout } from "../data/type";

// Lecture de la clé API depuis les variables d'environnement du serveur
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const MAX_RETRIES = 5;

// Fonction utilitaire pour le backoff exponentiel
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Génère un plan d'entraînement complet pour 4 semaines ou 7 jours via l'API Gemini.
 */
export async function generatePlanFromAI(
  profile: Profile, 
  history: string, 
  blockFocus: string,
  customTheme: string | null
): Promise<{ synthesis: string, workouts: Omit<Workout, 'status' | 'completedData'>[] }> {
  
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  // --- Logique de Périodisation ---
  const startDate = new Date();
  let numDays = 28; // 4 semaines par défaut

  if (blockFocus === 'Semaine de Tests (FTP, VO2max)') {
      numDays = 7;
  }
  
  const daysMap = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  let dateConstraints = "";
  
  for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayIndex = d.getDay();
      const dayName = daysMap[dayIndex];
      const availability = profile.weeklyAvailability[dayName];
      const dateStr = d.toISOString().split('T')[0];
      
      dateConstraints += `- ${dateStr} (${dayName}): Max ${availability} minutes. ${availability === 0 ? "INTERDICTION DE ROULER (Repos)" : ""}\n`;
  }

  const startDateString = startDate.toISOString().split('T')[0];
  const finalFocus = blockFocus === 'Personnalisé' ? customTheme : blockFocus;
  const blockDuration = blockFocus === 'Semaine de Tests (FTP, VO2max)' ? "7 jours (Semaine de Tests)" : "4 semaines (28 jours)";


  const systemPrompt = "Tu es un Directeur Sportif et Entraîneur de Cyclisme 'World Tour'. Tu réponds toujours UNIQUEMENT au format JSON strict.";

  const userPrompt = `
    PROFIL ATHLÈTE:
    - Niveau: ${profile.experience}
    - FTP: ${profile.ftp} W
    - Volume Cible: ~${profile.targetWeeklyHours}h/semaine.
    - Points Faibles: ${profile.weaknesses}
    
    HISTORIQUE DE PERFORMANCE (CRUCIAL):
    ${history}
    
    DEMANDE DU BLOC:
    - Début: ${startDateString}
    - DURÉE DU BLOC: ${blockDuration}
    - THÈME DU BLOC: "${finalFocus}"
    
    MISSION (INTELLIGENCE DE PÉRIODISATION):
    1. Si le thème est "Semaine de Tests", propose un bloc d'une semaine (7 jours) incluant des tests 5min, 8min, 20min pour évaluer la forme.
    2. Sinon, ANALYSE le thème demandé ("${finalFocus}") et DÉTERMINE la meilleure configuration de périodisation (ex: 2+1, 3+1) pour 4 semaines (28 jours).
    3. CRÉE le programme en appliquant cette logique.
    4. GÉNÈRE une version Home Trainer ET une version Extérieur pour CHAQUE séance de travail. Les exercices doivent être adaptés au mode (ex: Indoor = intervalles précis, Outdoor = segment de côte ou efforts au ressenti).
    
    CONTRAINTES STRICTES:
    - Utilise Zones Coggan (Z1-Z7).
    - Respecte les disponibilités ci-dessous (si 0 min = Repos).
    ${dateConstraints}

    FORMAT DE RÉPONSE (JSON UNIQUEMENT):
  `;
  
  const responseSchema = {
    type: "OBJECT",
    properties: {
        "synthesis": { 
            "type": "STRING",
            "description": "Explication de la périodisation et de la stratégie d'entraînement." 
        },
        "workouts": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "date": { "type": "STRING", "description": "Date au format YYYY-MM-DD." },
                    "title": { "type": "STRING", "description": "Titre Court & Pro de la séance." },
                    "type": { "type": "STRING", "description": "Type d'effort (Endurance, Threshold, Test, etc.)." },
                    "duration": { "type": "NUMBER", "description": "Durée totale de la séance en minutes." },
                    "tss": { "type": "NUMBER", "description": "Score de stress d'entraînement estimé." },
                    "mode": { "type": "STRING", "enum": ["Outdoor", "Indoor"], "description": "Mode initial recommandé." },
                    "description_outdoor": { "type": "STRING", "description": "Description détaillée pour l'extérieur." },
                    "description_indoor": { "type": "STRING", "description": "Description détaillée pour le home trainer." }
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
    config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
    },
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) throw new Error("AI response structure invalid or empty.");

      // Le modèle doit retourner directement un JSON valide
      const result = JSON.parse(jsonText);
      return result;

    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        // Logique de backoff
        await delay(Math.pow(2, attempt) * 1000 + Math.random() * 1000); 
      } else {
        console.error("AI Generation Failed after multiple retries:", error);
        throw new Error("Failed to generate training plan from AI.");
      }
    }
  }
  
  throw new Error("Max retries reached without successful AI response.");
}