import * as fs from 'fs/promises';
import * as path from 'path';
import { Block, Plan, Profile, Schedule, Week, Workout } from './DatabaseTypes';


// ATTENTION: CE FICHIER UTILISE DES MODULES NODE.JS (fs, path). 
// SES EXPORTS NE DOIVENT JAMAIS ÊTRE IMPORTÉS DIRECTEMENT DANS UN COMPOSANT CLIENT ('use client').
// Utilisez une Server Action intermédiaire pour l'accès aux données.

// Définition du chemin racine pour les fichiers JSON locaux
const dataDir = path.join(process.cwd(), 'src', 'lib', 'data', 'tables');

/**
 * Lit le contenu d'un fichier JSON local.
 * @param filename Le nom du fichier (ex: 'profile.json', 'schedule.json').
 * @returns Le contenu JSON parsé.
 */
export async function readJsonFile<T>(filename: string): Promise<T> {
    const filePath = path.join(dataDir, filename);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            console.warn(`File ${filename} not found. Returning empty object or array.`);
            
            if (filename.includes('schedule')) {
                return {
                    dbVersion: "1.0",
                    workouts: [], // C'est maintenant un tableau vide, plus un objet
                    summary: null,
                    lastGenerated: null
                } as unknown as T;
            }
            
            return {} as T;
        }
        console.error(`Error reading ${filename}:`, error);
        throw new Error(`Failed to read data from ${filename}`);
    }
}

/**
 * Écrit un objet JavaScript dans un fichier JSON local.
 * @param filename Le nom du fichier.
 * @param data L'objet à écrire.
 */
export async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
    const filePath = path.join(dataDir, filename);
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error writing to ${filename}:`, error);
        throw new Error(`Failed to write data to ${filename}`);
    }
}



/* CRUD Get Functions */
export async function getProfile(): Promise<Profile | null> {
    const data = await readJsonFile<Partial<Profile>>('profile.json');
    if (data && data.firstName && data.cycling?.Test?.ftp) {
        return data as Profile;
    }
    return null;
}

export async function getSchedule(): Promise<Schedule> {
    return readJsonFile<Schedule>('schedule.json');
}

export async function getPlan(): Promise<Plan[] | null> {
    const data = await readJsonFile<Partial<Plan[]>>('plan.json');
    if (data && Array.isArray(data)) {
        return data as Plan[];
    }
    return null;
}

export async function getBlock(): Promise<Block[] | null> {
    const data = await readJsonFile<Partial<Block[]>>('block.json');
    if (data && Array.isArray(data)) {
        return data as Block[];
    }
    return null;
}

export async function getWeek(): Promise<Week[] | null> {
    const data = await readJsonFile<Partial<Week[]>>('week.json');
    if (data && Array.isArray(data)) {
        return data as Week[];
    }
    return null;
}

export async function getWorkout(): Promise<Workout[] | null> {
    const data = await readJsonFile<Partial<Workout[]>>('workout.json');
    if (data && Array.isArray(data)) {
        return data as Workout[];
    }
    return null;
}

/* CRUD Save Functions */
export async function saveProfile(profile: Profile): Promise<void> {
    await writeJsonFile('profile.json', profile);
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
    await writeJsonFile('schedule.json', schedule);    
}

export async function savePlan(plan: Plan[]): Promise<void> {
    await writeJsonFile('plan.json', plan);
}

export async function saveBlock(blocks: Block[]): Promise<void> {
    await writeJsonFile('block.json', blocks);
}   

export async function saveWeek(week: Week): Promise<void> {
    await writeJsonFile('week.json', week);
}

export async function saveWorkout(workout: Workout): Promise<void> {
    await writeJsonFile('workout.json', workout);
}

