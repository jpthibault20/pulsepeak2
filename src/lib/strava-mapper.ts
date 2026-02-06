import { CompletedData, SportType } from "@/lib/data/type";
import { getProfile } from "./data/crud";

// --- DÉFINITION DES TYPES ENTRANTS (STRAVA) ---

interface StravaLapInput {
  moving_time: number;
  distance: number;
  average_watts?: number;
  average_heartrate?: number;
}

// Représente uniquement les champs Strava que nous utilisons ici
interface StravaActivityInput {
  id: number;
  type: string;
  moving_time: number;
  distance: number;
  description?: string | null;
  calories?: number;
  map?: {
    summary_polyline?: string | null;
  };

  laps?: StravaLapInput[];

  // Cardio
  average_heartrate?: number;
  max_heartrate?: number;

  // Puissance / Vélo
  average_watts?: number;
  weighted_average_watts?: number;
  max_watts?: number;

  // Vitesse / Cadence globals
  average_cadence?: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
}

// --- LOGIQUE ---

// Fonction utilitaire pour mapper le sport Strava -> Notre Sport
function mapStravaSport(stravaType: string): SportType {
  switch (stravaType) {
    case 'Run': return 'running';
    case 'Swim': return 'swimming';
    case 'Ride':
    case 'VirtualRide':
    case 'GravelRide': return 'cycling';
    default: return 'cycling';
  }
}

// Transforme l'objet API Strava TYPÉ en notre objet CompletedData
export async function mapStravaToCompletedData(activity: StravaActivityInput): Promise<CompletedData> {
  const sport = mapStravaSport(activity.type);
  let calculatedTSS: number | null = null; // Typage explicite

  try {
    const profile = await getProfile();
    // Optimisation : on vérifie profile?.ftp direct
    const ftp = profile?.cycling?.Test?.ftp || 200; 
    
    // Normalisation de la puissance (Weighted > Average > 0)
    const np = activity.weighted_average_watts || activity.average_watts || 0;

    if (np > 0 && ftp > 0) {
        // Calcul IF et TSS
        const intensityFactor = np / ftp;
        const durationInHours = activity.moving_time / 3600;
        calculatedTSS = Math.round(durationInHours * (intensityFactor * intensityFactor) * 100);
    }

  } catch (error) {
    console.error("Erreur lors de la récupération du profil pour TSS:", error);
  }

  // --- STRUCTURE DE BASE ---
  const completed: CompletedData = {
    actualDurationMinutes: Math.floor(activity.moving_time / 60),
    distanceKm: parseFloat((activity.distance / 1000).toFixed(2)),
    perceivedEffort: null,
    notes: activity.description || "",
    caloriesBurned: activity.calories ?? null,
    source: {
      type: 'strava',
      stravaId: activity.id,
    },
    map: { polyline: activity.map?.summary_polyline || null },
    laps: [],
    heartRate: {
      avgBPM: activity.average_heartrate || null,
      maxBPM: activity.max_heartrate || null,
      zoneDistribution: [],
    },
    metrics: { cycling: null, running: null, swimming: null }
  };

  // --- METRICS PAR SPORT ---
  if (sport === 'cycling') {
    completed.metrics.cycling = {
      tss: calculatedTSS, // On utilise la variable calculée plus haut
      avgPowerWatts: activity.average_watts || null,
      normalizedPowerWatts: activity.weighted_average_watts || null,
      maxPowerWatts: activity.max_watts || null,
      intensityFactor: null, // Tu pourrais aussi stocker l'IF calculé haut dessus ici
      avgCadenceRPM: activity.average_cadence || null,
      maxCadenceRPM: null,
      elevationGainMeters: activity.total_elevation_gain,
      avgSpeedKmH: activity.average_speed * 3.6,
      maxSpeedKmH: activity.max_speed * 3.6,
    };
  } else if (sport === 'running') {
    completed.metrics.running = {
      avgPaceMinPerKm: null,
      bestPaceMinPerKm: null,
      elevationGainMeters: activity.total_elevation_gain,
      avgCadenceSPM: activity.average_cadence ? activity.average_cadence * 2 : null,
      maxCadenceSPM: null,
      avgSpeedKmH: activity.average_speed * 3.6,
      maxSpeedKmH: activity.max_speed * 3.6,
      strideLength: null
    };
  }

  // --- INTEGRATION PULSEPEAK AUTOMATIQUE ---
  // Note: Cette partie doit idéalement être faite dans le contrôleur qui possède l'AccessToken Strava.
  // Mais si tu as accès à l'accessToken ici (via un contexte ou paramètre), tu peux décommenter :
  



  return completed;
}



// Define le style de la signature
const BRANDING_SUFFIX = "\n──────────────\n⚡ Powered by PulsePeak";

/**
 * Met à jour la description sur Strava via leur API
 * À appeler juste après la synchronisation de l'activité
 */
export async function tagStravaActivity(
    accessToken: string, // Le token de l'utilisateur
    activityId: number | string,
    currentDescription: string | null,
    stats?: { tss?: number | null }
) {
    const description = currentDescription || "";

    // 1. Éviter de taguer deux fois (boucle infinie)
    if (description.includes("⚡ PulsePeak") || description.includes("by PulsePeak")) {
        return;
    }

    // 2. Construction du footer minimaliste
    let footer = BRANDING_SUFFIX;
    
    // Bonus : Si on a calculé un TSS, on l'affiche joliment avant le branding
    if (stats?.tss && stats.tss > 0) {
        // On remplace le footer standard par une version avec stats
        // Rendu: "TSS: 120 • ⚡ Powered by PulsePeak"
        footer = `\n\n──────────────\nTSS: ${stats.tss} • ⚡ PulsePeak`;
    }

    const newDescription = description + footer;

    // 3. Appel API Strava (PUT)
    try {
        const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description: newDescription
            })
        });

        if (!response.ok) {
            console.warn("Impossible de mettre à jour la description Strava", await response.text());
        }
    } catch (error) {
        console.error("Erreur réseau update Strava:", error);
    }
}
