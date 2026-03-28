'use server';

import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';

/**
 * Crée le profil initial d'un nouvel utilisateur.
 * Utilise onConflictDoNothing pour ne jamais écraser un profil existant.
 * Peut être appelé avant que la session soit active (ex: après signUp avec confirmation email).
 */
export async function createInitialProfile(
    userId:    string,
    firstName: string,
    lastName:  string,
    email:     string,
): Promise<void> {
    await db
        .insert(profiles)
        .values({
            id:            userId,
            createdAt:     new Date(),
            updatedAt:     new Date(),
            firstName,
            lastName,
            email,
            currentCTL:    0,
            currentATL:    0,
            aiPersonality: 'Analytique',
            plan:          'free',
            goal:          '',
            weaknesses:    '',
        })
        .onConflictDoNothing();
}
