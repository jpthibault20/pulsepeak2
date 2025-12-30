export interface FeedbackInput {
  rpe: number;
  avgPower?: number;
  normalizedPower?: number;
  avgPace?: string;
  avgHeartRate?: number;
  actualDuration: number;
  distance: number;
  notes: string;
  sportType: SportType;
  // Optionnels selon le sport
  tss?: number | null;
  calories?: number | null;
  elevation?: number | null;
  avgCadence?: number | null;
  maxCadence?: number | null;
  avgSpeed?: number | null;
  maxSpeed?: number | null;
  maxPower?: number | null;
  strokeType?: string | null;
  avgStrokeRate?: number | null;
  avgSwolf?: number | null;
  poolLengthMeters?: number | null;
  totalStrokes?: number | null;
}
// Définition d'une zone unique (plage de puissance)
export interface PowerZone {
  min: number;
  max: number;
}

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
  tss?: number;

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

// Définition de l'interface pour le profil athlète
export interface Profile {
  name: string;
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

// --- NOUVELLE STRUCTURE DE DONNÉES (Multisport) ---

export type SportType = 'cycling' | 'running' | 'swimming';

// -- Métriques Spécifiques --

export interface CyclingMetrics {
  tss: number | null;
  avgPowerWatts: number | null;
  maxPowerWatts: number | null;
  normalizedPowerWatts: number | null;
  avgCadenceRPM: number | null;
  maxCadenceRPM: number | null;
  elevationGainMeters: number | null;
  avgSpeedKmH: number | null;
  maxSpeedKmH: number | null;
}

export interface RunningMetrics {
  avgPaceMinPerKm: string | null;
  bestPaceMinPerKm: string | null; // ← Était "maxPaceMinPerKm" ?
  elevationGainMeters: number | null;
  avgCadenceSPM: number | null;
  maxCadenceSPM: number | null;
  avgSpeedKmH: number | null; // ← MANQUANT dans votre objet
  maxSpeedKmH: number | null; // ← MANQUANT dans votre objet
}

export interface SwimmingMetrics {
  avgPace100m: string | null;
  bestPace100m: string | null;
  strokeType: string | null;
  avgStrokeRate: number | null;
  avgSwolf: number | null;
  poolLengthMeters: number | null;
  totalStrokes: number | null;
}

// -- Conteneurs de Données --

// Ce qui est prévu par le coach / l'IA
export interface PlannedData {
  durationMinutes: number; // Remplace 'duration'
  targetPowerWatts: number | null;
  targetPaceMinPerKm: string | null;
  targetHeartRateBPM: number | null;
  distanceKm: number | null;    // Remplace 'distance'
  plannedTSS: number | null;    // Le TSS cible
  descriptionOutdoor: string | null; // camelCase (remplace description_outdoor)
  descriptionIndoor: string | null;  // camelCase (remplace description_indoor)
}

// Ce qui a été réellement fait
export interface CompletedData {
  actualDurationMinutes: number; // Remplace 'actualDuration'
  distanceKm: number;
  perceivedEffort: number; // RPE 1-10
  notes: string;
  heartRate?: {
    avgBPM: number | null;
    maxBPM: number | null;
  };
  caloriesBurned?: number | null;
  // Les métriques sont maintenant séparées par sport
  metrics: {
    cycling: CyclingMetrics | null;
    running: RunningMetrics | null;
    swimming: SwimmingMetrics | null;
  };
}

// -- Objets Principaux --

export interface Workout {
  id: string; // NOUVEAU: Identifiant unique (ex: "cycling_20251111_a1")
  date: string; // "YYYY-MM-DD"
  sportType: SportType; // NOUVEAU: "cycling", "running", etc.
  title: string;
  workoutType: string; // Remplace 'type' (ex: Endurance, Intervals)
  mode: 'Outdoor' | 'Indoor';
  status: 'pending' | 'completed' | 'missed';
  
  // NOUVEAU: Séparation claire entre planifié et réalisé
  plannedData: PlannedData;
  completedData: CompletedData | null;
}

export interface Schedule {
  dbVersion: string; // NOUVEAU: Pour gérer les futures mises à jour
  workouts: Workout[]; // NOUVEAU: C'est maintenant un tableau, plus un objet clé/valeur
  summary: string | null;
  lastGenerated: string | null;
}
