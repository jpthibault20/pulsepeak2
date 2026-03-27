"use server"

// src/lib/profile-db.ts
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { StravaConfig } from '@/lib/data/type';
import { Profile } from './data/DatabaseTypes';
import { getProfile as getProfileFromCrud } from './data/crud';

export async function getProfile(): Promise<Profile> {
    return getProfileFromCrud();
}

export async function updateProfileStravaData(stravaData: StravaConfig): Promise<Profile> {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Utilisateur non authentifié');

    const userId = user.id;

    await db
        .update(profiles)
        .set({ strava: stravaData, updatedAt: new Date() })
        .where(eq(profiles.id, userId));

    return getProfileFromCrud();
}
