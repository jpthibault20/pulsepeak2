// Définitions des structures de données partagées
// Ce fichier est sûr à importer côté client et côté serveur.

export interface Workout {
    date: string; // YYYY-MM-DD
    title: string;
    type: string;
    duration: number; // minutes
    tss: number;
    status: 'pending' | 'completed' | 'missed';
    mode: 'Outdoor' | 'Indoor';
    description_outdoor: string;
    description_indoor: string;
    completedData?: {
        rpe: number; // Ressenti de l'effort (1-10)
        avgPower: number; // Puissance moyenne enregistrée
        notes: string;
    };
}

export interface Schedule {
    workouts: { [key: string]: Workout };
    summary: string | null;
    lastGenerated?: string;
}

export interface Profile {
    name: string;
    ftp: number; // Functional Threshold Power (Watts)
    experience: string; // Ex: Débutant, Avancé
    goal: string; // Ex: Cyclosportive, Endurance
    objectiveDate: string; // Date de l'objectif principal
    weaknesses: string; // Commentaires pour l'IA (ex: grimpeur, sprinteur)
    targetWeeklyHours: number;
    weeklyAvailability: { [day: string]: number }; // Minutes disponibles par jour
}