// Définition d'une zone unique (plage de puissance)
export interface PowerZone {
  min: number;
  max: number;
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
  weight?: number; // Poids en kg (Optionnel mais recommandé pour W/kg)
  experience: 'Débutant' | 'Intermédiaire' | 'Avancé' | string;
  ftp: number; // Functional Threshold Power en Watts
  // targetWeeklyHours a été supprimé car calculé dynamiquement via weeklyAvailability
  goal: string;
  objectiveDate: string;
  weaknesses: string;
  weeklyAvailability: {
    [key: string]: number; // Durée max en minutes pour chaque jour (Lundi, Mardi...)
  };
  powerTests?: {
    p5min: number;  // PMA (Puissance Maximale Aérobie)
    p8min: number;  // Capacité Anaérobie
    p15min: number; // Puissance Seuil
    p20min: number; // Test FTP standard
  };
  zones?: PowerZones; // Les zones calculées sont stockées ici
  seasonData?: {
        calculatedAt: string;
        wPrime: number; // Capacité anaérobie en Joules
        criticalPower: number;
        method: string;
        sourceTests: string[];
    };
}

// Interface pour les données de performance enregistrées après la séance
export interface CompletedWorkoutData {
  rpe: number; // Rating of Perceived Exertion (Échelle de 1 à 10)
  avgPower: number; // Puissance moyenne réelle en Watts
  notes: string; // Notes de l'athlète sur la séance
  actualDuration?: number; // Durée réelle de la séance en minutes
  distance?: number; // Distance parcourue en kilomètres
}

// Interface pour une séance d'entraînement individuelle
export interface Workout {
  date: string; // Date de la séance (YYYY-MM-DD)
  title: string;
  type: string; // Type d'effort (ex: Endurance, Threshold, VO2max, Test)
  duration: number; // Durée prévue en minutes
  tss: number; // Training Stress Score estimé
  distance?: number; // Distance prévue en km (Optionnel)
  mode: 'Outdoor' | 'Indoor';
  description_outdoor: string;
  description_indoor: string;
  status: 'pending' | 'completed' | 'missed';
  completedData?: CompletedWorkoutData;
}

// Interface pour l'ensemble du programme d'entraînement
export interface Schedule {
  workouts: { [dateKey: string]: Workout };
  summary: string | null; // Synthèse de la périodisation générée par l'IA
  lastGenerated: string; // Date de la dernière génération du plan (YYYY-MM-DD)
}