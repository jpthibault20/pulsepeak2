/******************************************************************************
 * @file    _internals/rate-limit.ts
 * @brief   Limitation de débit des appels IA (plan / workout) par utilisateur
 *          et par jour, en s'appuyant sur l'incrément atomique côté DB.
 * @access  Module privé — ne pas importer depuis un composant client.
 ******************************************************************************/

import { format } from 'date-fns';
import { atomicIncrementAICallCount, getProfile } from '@/lib/data/crud';

const AI_DAILY_LIMITS_FREE = { plan: 3, workout: 10 } as const;
const AI_DAILY_LIMITS_PRO  = { plan: 999, workout: 999 } as const;

/**
 * Vérifie et incrémente le compteur d'appels IA du jour pour l'utilisateur
 * courant. Déclenche une erreur si le quota du plan est atteint.
 *
 * @param type 'plan' (génération complète) ou 'workout' (séance unique)
 * @throws Error si la limite journalière est dépassée
 */
export async function checkAndIncrementAICallLimit(type: 'plan' | 'workout'): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const profile = await getProfile();
    const isPro = profile?.plan === 'pro' || profile?.plan === 'dev'
               || profile?.role === 'admin';
    const limits = isPro ? AI_DAILY_LIMITS_PRO : AI_DAILY_LIMITS_FREE;
    await atomicIncrementAICallCount(type, today, limits[type]);
}
