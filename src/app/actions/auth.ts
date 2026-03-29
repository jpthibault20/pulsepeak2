'use server';

import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

/**
 * Crée le profil initial d'un nouvel utilisateur.
 * Utilise onConflictDoNothing pour ne jamais écraser un profil existant.
 * Vérifie que le userId fourni correspond à l'utilisateur authentifié.
 */
export async function createInitialProfile(
    userId:    string,
    firstName: string,
    lastName:  string,
    email:     string,
): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
        throw new Error('Non autorisé');
    }

    await db
        .insert(profiles)
        .values({
            id:            user.id,
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
