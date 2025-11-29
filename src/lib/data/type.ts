// Définition de l'interface pour le profil athlète
export interface Profile {
  name: string;
  weight?: number; // Poids en kg
  experience: 'Débutant' | 'Intermédiaire' | 'Avancé' | string;
  ftp: number; // Functional Threshold Power en Watts
  // targetWeeklyHours: number; // SUPPRIMÉ : Calculé dynamiquement maintenant
  goal: string;
  objectiveDate: string;
  weaknesses: string;
  weeklyAvailability: {
    [key: string]: number; // Durée max en minutes pour chaque jour de la semaine
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
  type: string; // Type d'effort (ex: Endurance, Threshold, VO2max)
  duration: number; // Durée prévue en minutes
  distance?: number; // Distance prévue en kilomètres
  tss: number; // Training Stress Score estimé
  mode: 'Outdoor' | 'Indoor';
  description_outdoor: string;
  description_indoor: string;
  status: 'pending' | 'completed' | 'missed';
  completedData?: CompletedWorkoutData;
}

// Interface pour l'ensemble du programme d'entraînement
export interface Schedule {
  workouts: { [dateKey: string]: Workout };
  summary: string; // Synthèse de la périodisation générée par l'IA
  lastGenerated: string; // Date de la dernière génération du plan (YYYY-MM-DD)
}