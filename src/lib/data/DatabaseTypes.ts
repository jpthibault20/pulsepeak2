import { aiPersonality, AvailabilitySlot, CompletedData, CyclingTest, PlannedData, SportType, StravaConfig, Workoutold, Zones } from "./type";


export interface Profile {
    // Identifiants
    id: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;

    // Informations générales
    lastName: string;
    firstName: string;
    email: string;
    birthDate: string;
    weight?: number;
    height?: number;
    experience: 'Débutant' | 'Intermédiaire' | 'Avancé' | string;
    activeSports: {
        swimming: boolean;
        cycling: boolean;
        running: boolean;
    };
    weeklyAvailability: {
        [key: string]: AvailabilitySlot;

    };

    heartRate?: {
        max: number | null;       // FC Maximum (obligatoire pour le calcul simple)
        resting?: number | null;  // FC au Repos (optionnel, utile pour formule de Karvonen)
        zones?: Zones;            // Zones de FC (optionnel)
    };

    cycling?: {
        Test?: CyclingTest
        comments?: string;
    }

    running?: {
        Test?: {
            recentRaceTimeSec?: string;
            recentRaceDistanceMeters?: string;
            vma?: number;
            zones?: Zones;
        }
        comments?: string;
    }

    swimming?: {
        Test?: {
            recentRaceTimeSec?: number;
            recentRaceDistanceMeters?: number;
            poolLengthMeters?: number;
            totalStrokes?: number;
        }
        comments?: string;
    }

    aiPersonality: aiPersonality;

    strava?: StravaConfig;

    goal: string;
    objectiveDate: string;
    weaknesses: string;

    workouts: Workout[]; //Not used for the moment, use in te future for relations
}

export interface Schedule {
    dbVersion: string;
    workouts: Workoutold[];
    summary: string | null;
    lastGenerated: string | null;
}

export interface Plan {
    ID: string;
    userID: string;
    blocksID: string[];
    name: string;
    goalDate: string;
    startDate: string;
    macroStrategyDescription: string;
    status: 'active' | 'archived';
}

export interface Block {
    ID: string;
    userID: string;
    weeksID: string[];
    planID: string;
    orderIndex: number;
    theme: string;
    comment: string;
    weekCount: number;
}

export interface Week {
    ID: string;
    userID: string;
    workoutsID: string[];
    blockID: string;
    weekNumber: number;
    type: 'Load' | 'Recovery' | 'Taper'; // Charge ou Assimilation
    targetTSS: number; // ex: 500
    actualTSS: number; // Somme calculée des séances complétées
    // Feedback global de la semaine (pour l'IA de la semaine suivante)
    userFeedback?: string; // "J'étais KO cette semaine"}
}

export interface Workout {
    ID: string;
    userID: string;
    weekID: string;
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
