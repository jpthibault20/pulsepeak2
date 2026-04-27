'use server';

import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq, isNull, lt, or } from 'drizzle-orm';

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
            coachType:     'triathlon',
            plan:          'free',
            goal:          '',
            weaknesses:    '',
        })
        .onConflictDoNothing();
}

/**
 * Marque la dernière connexion de l'utilisateur courant.
 * Mise à jour au plus une fois par heure pour éviter le spam d'updates.
 */
export async function touchLastLogin(): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    await db.update(profiles)
        .set({ lastLoginAt: now })
        .where(and(
            eq(profiles.id, user.id),
            or(isNull(profiles.lastLoginAt), lt(profiles.lastLoginAt, oneHourAgo)),
        ));
}
