// ATTENTION: server-only. Ne jamais importer depuis un composant client.

import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export type AdminContext = { userId: string; email: string };

/**
 * Vérifie que l'utilisateur courant est connecté ET a le rôle 'admin'.
 * Lève une erreur sinon. À appeler au début de toute action/route admin.
 */
export async function requireAdmin(): Promise<AdminContext> {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Utilisateur non authentifié');

    const row = await db.query.profiles.findFirst({
        where: eq(profiles.id, user.id),
        columns: { role: true },
    });

    if (!row || row.role !== 'admin') {
        throw new Error('Accès refusé : rôle admin requis');
    }

    return { userId: user.id, email: user.email ?? '' };
}

/**
 * Retourne true si l'utilisateur courant est admin, false sinon.
 * Ne lève jamais — utile pour les guards de layout/page.
 */
export async function isAdmin(): Promise<boolean> {
    try {
        await requireAdmin();
        return true;
    } catch {
        return false;
    }
}
