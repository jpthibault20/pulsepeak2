
// ______________________________________________________
// --- TYPES PRINCIPALES ---
// ______________________________________________________

// Définition de l'interface pour le profil athlète
export interface Profile {
  name: string;
  strava?: StravaConfig; 
  sports: SportType[];
  weight?: number;
  experience: 'Débutant' | 'Intermédiaire' | 'Avancé' | string;
  ftp: number;
  goal: string;
  objectiveDate: string;
  weaknesses: string;
  weeklyAvailability: {
    [key: string]: number;
  };
  powerTests?: {
    p5min: number;
    p8min: number;
    p15min: number;
    p20min: number;
  };
  zones?: PowerZones;
  seasonData?: {
    calculatedAt: string;
    wPrime: number;
    criticalPower: number;
    method: string;
    sourceTests: string[];
  };
}

// Definition de l'interface pour le calendrier (Tableau de Workout)
export interface Schedule {
  dbVersion: string;
  workouts: Workout[];
  summary: string | null;
  lastGenerated: string | null;
}

// Définition de l'interface pour les données d'une séance
export interface Workout {
  id: string; 
  date: string; // "YYYY-MM-DD"
  sportType: SportType; 
  title: string;
  workoutType: string; 
  mode: 'Outdoor' | 'Indoor';
  status: 'pending' | 'completed' | 'missed';

  plannedData: PlannedData;
  completedData: CompletedData | null;
}

// Définition de l'interface pour les données des séances planifiées
export interface PlannedData {
  durationMinutes: number; 
  targetPowerWatts: number | null;
  targetPaceMinPerKm: string | null;
  targetHeartRateBPM: number | null;
  distanceKm: number | null;    
  plannedTSS: number | null;    
  descriptionOutdoor: string | null; 
  descriptionIndoor: string | null;  
  
  // NOUVEAU (Optionnel) Structure des intervalles prévus
  structure?: {
    type: 'intervals' | 'steady';
    sets: number; // ex: 5 répétitions
    repsDescription: string; // ex: "5x 5min @ Z4"
  };
}

// Définition de l'interface pour les données des séances réalisées
export interface CompletedData {
  // --- Données Globales ---
  actualDurationMinutes: number; 
  distanceKm: number;
  perceivedEffort: number | null; // RPE 1-10
  notes: string;
  
  // NOUVEAU: Source de la donnée (import Strava, manuel, etc.)
  source: {
    type: 'manual' | 'strava';
    stravaId?: number | string | null;   // ID unique de l'activité Strava
    stravaUrl?: string;           // Lien direct
    fullJson?: boolean;           // Flag si on a stocké tout le JSON (rarement utile)
  };

  // NOUVEAU: Données Géographiques (pour affichage simple)
  map?: {
    polyline: string | null; // La trace GPS compressée
  };

  // --- Physiologie Globale ---
  heartRate?: {
    avgBPM: number | null;
    maxBPM: number | null;
    zoneDistribution?: number[]; // % du temps passé en Z1, Z2... (Top pour l'analyse)
  };
  caloriesBurned?: number | null;

  // --- Analyse Structurelle (COACHING CRITIQUE) ---
  // Permet de voir les intervalles (Lap 1, Lap 2...)
  laps: CompletedLap[];

  // --- Métriques Spécifiques par Sport ---
  metrics: {
    cycling: CyclingMetrics | null;
    running: RunningMetrics | null;
    swimming: SwimmingMetrics | null;
  };
}







// ______________________________________________________
// --- Sous Types ---
// ______________________________________________________

// NOUVEAU: Représente un Tour (Lap) ou un Intervalle
// C'est ici qu'on vérifie si l'athlète a tenu les watts sur ses 5 répétitions.
export interface CompletedLap {
  index: number;         // 1, 2, 3...
  name: string;          // "Lap 1"
  durationSeconds: number;
  distanceMeters: number;
  
  // Métriques du tour
  avgPower?: number | null;
  normalizedPower?: number | null; // Très utile sur des efforts longs
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  avgCadence?: number | null;
  avgSpeedKmh?: number | null;
}

// Définition de l'interface pour les données cycle
export interface CyclingMetrics {
  tss: number | null;               // Training Stress Score (Fatigue)
  avgPowerWatts: number | null;
  maxPowerWatts: number | null;
  normalizedPowerWatts: number | null; // NOUVEAU: Indispensable pour la charge réelle
  intensityFactor: number | null;      // NOUVEAU: IF (NP / FTP)
  avgCadenceRPM: number | null;
  maxCadenceRPM: number | null;
  elevationGainMeters: number | null;
  avgSpeedKmH: number | null;
  maxSpeedKmH: number | null;
}

// Définition de l'interface pour les données de running
export interface RunningMetrics {
  avgPaceMinPerKm: number | null; // Format "5:30"
  bestPaceMinPerKm: string | null; 
  elevationGainMeters: number | null;
  avgCadenceSPM: number | null;   // Steps Per Minute (Cadence)
  maxCadenceSPM: number | null;
  avgSpeedKmH: number | null; 
  maxSpeedKmH: number | null;
  strideLength?: number | null;   // NOUVEAU: Longueur de foulée (souvent dispo sur Strava)
}

// Définition de l'interface pour les données de swimming
export interface SwimmingMetrics {
  avgPace100m: string | null;
  bestPace100m: string | null;
  strokeType: string | null; // "Freestyle", "Mixed"...
  avgStrokeRate: number | null;
  avgSwolf: number | null;   // Score d'efficacité
  poolLengthMeters: number | null;
  totalStrokes: number | null;
}



// ______________________________________________________
// --- AUTRES / UTILITAIRES ---
// ______________________________________________________

// Définition complète des 7 zones de Coggan
export interface PowerZones {
  z1: PowerZone; // Récupération active
  z2: PowerZone; // Endurance
  z3: PowerZone; // Tempo
  z4: PowerZone; // Seuil (FTP)
  z5: PowerZone; // VO2max
  z6: PowerZone; // Capacité Anaérobie
  z7: PowerZone; // Neuromusculaire
}

// Définition d'une zone unique (plage de puissance)
export interface PowerZone {
  min: number;
  max: number;
}

// Définition de l'interface pour le type de sport
export type SportType = 'cycling' | 'running' | 'swimming';

// Définition de l'interface pour le profil strava
export interface StravaConfig {
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}


// Définition de l'interface pour les données des feedbacks
export interface CompletedDataFeedback {
  rpe: number;
  actualDuration: number;
  distance: number;
  notes: string;
  sportType: SportType;

  // Universel
  avgHeartRate?: number;
  calories?: number;
  elevation?: number;

  // Cyclisme
  avgPower?: number;
  maxPower?: number;
  normalizedPower?: number;
  tss?: number;
  intensityFactor?: number;
  

  // Running/Cycling
  avgPace?: string;
  avgCadence?: number;
  maxCadence?: number;
  avgSpeed?: number; // ✅ AJOUTÉ
  maxSpeed?: number; // ✅ AJOUTÉ

  // Swimming
  strokeType?: string;
  avgStrokeRate?: number;
  avgSwolf?: number;
  poolLengthMeters?: number;
  totalStrokes?: number;
}







































