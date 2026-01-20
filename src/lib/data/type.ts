export type aiPersonality = 'Strict' | 'Encourageant' | 'Analytique';

export interface AvailabilitySlot {
    swimming: number; 
    cycling: number;
    running: number;
    comment: string;
}
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

export interface PlannedData {
  durationMinutes: number; 
  targetPowerWatts: number | null;
  targetPaceMinPerKm: string | null;
  targetHeartRateBPM: number | null;
  distanceKm: number | null;    
  plannedTSS: number | null;    
  descriptionOutdoor: string | null; 
  descriptionIndoor: string | null;  
  structure?: {
    type: 'intervals' | 'steady';
    sets: number; // ex: 5 répétitions
    repsDescription: string; // ex: "5x 5min @ Z4"
  };
}

export interface CompletedData {
  // --- Données Globales ---
  actualDurationMinutes: number; 
  distanceKm: number;
  perceivedEffort: number | null; // RPE 1-10
  notes: string;
  source: {
    type: 'manual' | 'strava';
    stravaId?: number | string | null;   // ID unique de l'activité Strava
    stravaUrl?: string;           // Lien direct
    fullJson?: boolean;           // Flag si on a stocké tout le JSON (rarement utile)
  };
  map?: {
    polyline: string | null; // La trace GPS compressée
  };
  heartRate?: {
    avgBPM: number | null;
    maxBPM: number | null;
    zoneDistribution?: number[]; // % du temps passé en Z1, Z2... (Top pour l'analyse)
  };
  caloriesBurned?: number | null;
  laps: CompletedLap[];
  metrics: {
    cycling: CyclingMetrics | null;
    running: RunningMetrics | null;
    swimming: SwimmingMetrics | null;
  };
}







// ______________________________________________________
// --- Sous Types ---
// ______________________________________________________
export interface CompletedLap {
  index: number;         // 1, 2, 3...
  name: string;          // "Lap 1"
  durationSeconds: number;
  distanceMeters: number;
  avgPower?: number | null;
  normalizedPower?: number | null; // Très utile sur des efforts longs
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  avgCadence?: number | null;
  avgSpeedKmh?: number | null;
}

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

export interface RunningMetrics {
  avgPaceMinPerKm: string | null; // Format "5:30"
  bestPaceMinPerKm: string | null; 
  elevationGainMeters: number | null;
  avgCadenceSPM: number | null;   // Steps Per Minute (Cadence)
  maxCadenceSPM: number | null;
  avgSpeedKmH: number | null; 
  maxSpeedKmH: number | null;
  strideLength?: number | null;   // NOUVEAU: Longueur de foulée (souvent dispo sur Strava)
}
export interface SwimmingMetrics {
  avgPace100m: number | null;
  bestPace100m: string | null;
  strokeType: string | null; // "Freestyle", "Mixed"...
  avgStrokeRate: number | null;
  avgSwolf: number | null;   // Score d'efficacité
  poolLengthMeters: number | null;
  totalStrokes: number | null;
}

export interface CyclingTest {
  ftp?: number;
  p5min?: number;
  p8min?: number;
  p15min?: number;
  p20min?: number;
  zones?: Zones;
  seasonData?: SeasonData;
  sourceTests?: string[];
}

export interface Zones {
  z1: Zone; // Récupération active
  z2: Zone; // Endurance
  z3: Zone; // Tempo
  z4: Zone; // Seuil (FTP)
  z5: Zone; // VO2max
  z6?: Zone; // Capacité Anaérobie
  z7?: Zone; // Neuromusculaire
}

export interface Zone {
  min: number;
  max: number;
}

export type SportType = 'cycling' | 'running' | 'swimming';

export interface StravaConfig {
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface CompletedDataFeedback {
  rpe: number;
  actualDuration: number;
  distance: number;
  notes: string;
  sportType: SportType;
  avgHeartRate?: number;
  calories?: number;
  elevation?: number;
  avgPower?: number;
  maxPower?: number;
  normalizedPower?: number;
  tss?: number;
  intensityFactor?: number;
  avgPace?: string;
  avgCadence?: number;
  maxCadence?: number;
  avgSpeed?: number; 
  maxSpeed?: number; 
  strokeType?: string;
  avgStrokeRate?: number;
  avgSwolf?: number;
  poolLengthMeters?: number;
  totalStrokes?: number;
}

export interface PowerTests {
  p5min: number;
  p8min: number;
  p15min: number;
  p20min: number;
}

export interface SeasonData {
  calculatedAt?: string;       // ISO 8601
  wPrime?: number;             // W' en joules
  criticalPower?: number;      // CP (FTP) en watts
  method?: 'Critical Power Regression' | 'Single Test Estimation';
  sourceTests?: string[];      // Ex: ['5min', '20min']
}