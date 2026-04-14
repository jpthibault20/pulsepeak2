import { CompletedData, SportType } from "@/lib/data/type";
import { getProfile } from "./data/crud";

// --- DÉFINITION DES TYPES ENTRANTS (STRAVA) ---

interface StravaLapInput {
  lap_index: number;
  name: string;
  moving_time: number;
  distance: number;
  average_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_speed?: number; // m/s
}

// Représente uniquement les champs Strava que nous utilisons ici
interface StravaActivityInput {
  id: number;
  type: string;
  moving_time: number;
  distance: number;
  description?: string | null;
  calories?: number;
  perceived_exertion?: number | null;
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
export function mapStravaSport(stravaType: string): SportType {
  switch (stravaType) {
    case 'Run':
    case 'TrailRun':
    case 'VirtualRun': return 'running';
    case 'Swim': return 'swimming';
    case 'Ride':
    case 'VirtualRide':
    case 'GravelRide':
    case 'MountainBikeRide':
    case 'EBikeRide': return 'cycling';
    default: return 'other';
  }
}

// Transforme l'objet API Strava TYPÉ en notre objet CompletedData
export async function mapStravaToCompletedData(activity: StravaActivityInput): Promise<CompletedData> {
  const sport = mapStravaSport(activity.type);
  let calculatedTSS: number | null = null;

  try {
    const profile = await getProfile();
    const durationInHours = activity.moving_time / 3600;

    // 1) Puissance (vélo) : TSS = durée(h) × IF² × 100
    const ftp = profile?.cycling?.Test?.ftp || 0;
    const np = activity.weighted_average_watts || activity.average_watts || 0;
    if (np > 0 && ftp > 0) {
        const intensityFactor = np / ftp;
        calculatedTSS = Math.round(durationInHours * intensityFactor * intensityFactor * 100);
    }

    // 2) Cardio (hrTSS) : si pas de TSS puissance, utiliser la FC
    if (calculatedTSS == null) {
        const avgHR = activity.average_heartrate;
        const maxHR = profile?.heartRate?.max;
        if (avgHR && avgHR > 0 && maxHR && maxHR > 0) {
            const restHR = profile?.heartRate?.resting ?? 0;
            const hrRatio = restHR > 0
                ? (avgHR - restHR) / (maxHR - restHR)
                : avgHR / maxHR;
            const ifHR = Math.min(Math.max(hrRatio, 0), 1);
            calculatedTSS = Math.round(durationInHours * ifHR * ifHR * 100);
        }
    }

    // 3) RPE Strava : estimation via perceived_exertion (échelle 1-10)
    if (calculatedTSS == null && activity.perceived_exertion && activity.perceived_exertion > 0) {
        calculatedTSS = Math.round(durationInHours * Math.pow(activity.perceived_exertion / 10, 2) * 100);
    }

    // 4) Défaut : TSS estimé par heure selon le sport (intensité modérée)
    if (calculatedTSS == null) {
        const defaultTSSPerHour: Record<SportType, number> = {
            cycling: 50,
            running: 60,
            swimming: 55,
            other: 50,
        };
        calculatedTSS = Math.round(durationInHours * defaultTSSPerHour[sport]);
    }

  } catch (error) {
    console.error("Erreur lors de la récupération du profil pour TSS:", error);
  }

  // --- STRUCTURE DE BASE ---
  const completed: CompletedData = {
    actualDurationMinutes: Math.floor(activity.moving_time / 60),
    distanceKm: parseFloat((activity.distance / 1000).toFixed(2)),
    perceivedEffort: activity.perceived_exertion ?? null,
    notes: activity.description || "",
    caloriesBurned: activity.calories ?? null,
    source: {
      type: 'strava',
      stravaId: activity.id,
    },
    map: { polyline: activity.map?.summary_polyline || null },
    laps: (activity.laps ?? []).map((lap) => ({
      index: lap.lap_index,
      name: lap.name || `Lap ${lap.lap_index}`,
      durationSeconds: lap.moving_time,
      distanceMeters: Math.round(lap.distance),
      avgPower: lap.average_watts ?? null,
      normalizedPower: null,
      avgHeartRate: lap.average_heartrate ?? null,
      maxHeartRate: lap.max_heartrate ?? null,
      avgCadence: lap.average_cadence ?? null,
      avgSpeedKmh: lap.average_speed ? parseFloat((lap.average_speed * 3.6).toFixed(1)) : null,
    })),
    heartRate: {
      avgBPM: activity.average_heartrate || null,
      maxBPM: activity.max_heartrate || null,
      zoneDistribution: [],
    },
    metrics: { cycling: null, running: null, swimming: null },
    calculatedTSS: calculatedTSS ?? undefined,
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
  } else if (sport === 'swimming') {
    completed.metrics.swimming = {
      avgPace100m: null,
      bestPace100m: null,
      strokeType: null,
      avgStrokeRate: null,
      avgSwolf: null,
      poolLengthMeters: null,
      totalStrokes: null,
    };
  }

  // --- INTEGRATION PULSEPEAK AUTOMATIQUE ---
  // Note: Cette partie doit idéalement être faite dans le contrôleur qui possède l'AccessToken Strava.
  // Mais si tu as accès à l'accessToken ici (via un contexte ou paramètre), tu peux décommenter :
  



  return completed;
}



// Define le style de la signature
const BRANDING_SUFFIX = "\n⚡ Powered by PulsePeak";

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
        footer = `\nTSS: ${stats.tss} • ⚡ PulsePeak`;
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
