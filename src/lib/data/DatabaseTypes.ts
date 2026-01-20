import { aiPersonality, AvailabilitySlot, CyclingTest, StravaConfig, Workout, Zones } from "./type";


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
    workouts: Workout[];
    summary: string | null;
    lastGenerated: string | null;
}