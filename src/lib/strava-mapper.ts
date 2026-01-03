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
  let calculatedTSS = null;

  try {
    const profile = await getProfile();
    if (profile) {
      const np = activity.weighted_average_watts || activity.average_watts || 0;
      const ftp = profile.ftp || 200; // Valeur par défaut si profil incomplet
      let intensityFactor = 0;

      if (np > 0 && ftp > 0) {
        // 3. Calcul de l'Intensity Factor (IF) = NP / FTP
        intensityFactor = np / ftp;

        // 4. Calcul du TSS
        // Formule : (Durée en heures) x (IF au carré) x 100
        const durationInHours = activity.moving_time / 3600;

        calculatedTSS = Math.round(durationInHours * (intensityFactor * intensityFactor) * 100);
      }
    }



  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error);
  }

  // 1. Structure de base
  const completed: CompletedData = {
    actualDurationMinutes: Math.floor(activity.moving_time / 60),
    distanceKm: parseFloat((activity.distance / 1000).toFixed(2)),
    perceivedEffort: null,
    notes: activity.description || "",
    caloriesBurned: activity.calories ?? null,

    // INFO SOURCE IMPORTANTE
    source: {
      type: 'strava',
      stravaId: activity.id,
    },

    // CARTE
    map: {
      polyline: activity.map?.summary_polyline || null
    },

    // TOURS (Tyage strict ici aussi)
    laps: [],

    // Freq Cardiaque globale
    heartRate: {
      avgBPM: activity.average_heartrate || null,
      maxBPM: activity.max_heartrate || null,
      zoneDistribution: [],
    },

    metrics: { cycling: null, running: null, swimming: null }
  };

  // 2. Metrics Spécifiques
  if (sport === 'cycling') {
    completed.metrics.cycling = {
      tss: calculatedTSS,
      avgPowerWatts: activity.average_watts || null,
      normalizedPowerWatts: activity.weighted_average_watts || null,
      maxPowerWatts: activity.max_watts || null,
      intensityFactor: null,
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
      // Strava donne souvent en RPM (1 jambe), on multiplie par 2 pour SPM si présent
      avgCadenceSPM: activity.average_cadence ? activity.average_cadence * 2 : null,
      maxCadenceSPM: null,
      avgSpeedKmH: activity.average_speed * 3.6,
      maxSpeedKmH: activity.max_speed * 3.6,
      strideLength: null
    };
  }
  // TODO: Ajouter map pour Swimming si nécessaire

  return completed;
}
