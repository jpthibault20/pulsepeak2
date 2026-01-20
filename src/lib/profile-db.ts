"use server"

// src/lib/profile-db.ts
import fs from 'fs/promises';
import path from 'path';
import { StravaConfig } from '@/lib/data/type';
import { Profile } from './data/DatabaseTypes';

// On définit le chemin ici
const PROFILE_PATH = path.join(process.cwd(), '/src/lib/data/profile.json');

export async function getProfile(): Promise<Profile> {
    try {
        const file = await fs.readFile(PROFILE_PATH, 'utf8');
        return JSON.parse(file) as Profile;
    } catch (error) {
        // Si le fichier n'existe pas, on peut gérer l'erreur ou retourner null
        console.error("Erreur lecture profil:", error);
        throw error;
    }
}

export async function updateProfileStravaData(stravaData: StravaConfig): Promise<Profile> {
    try {
        // 1. Lire le profil existant
        let profile: Profile;
        try {
            profile = await getProfile();
        } catch {
            // Fallback si le profil n'existe pas encore (cas rare mais possible)
            // Tu devras peut-être ajuster ceci selon ta logique par défaut
            profile = {} as Profile; 
        }

        // 2. Mettre à jour avec Strava
        const updatedProfile: Profile = {
            ...profile,
            strava: stravaData
        };

        // 3. Écrire le fichier
        await fs.writeFile(PROFILE_PATH, JSON.stringify(updatedProfile, null, 2));
        
        return updatedProfile;
    } catch (error) {
        console.error("Erreur sauvegarde Strava:", error);
        throw error;
    }
}
