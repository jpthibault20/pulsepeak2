/**
 * Validation des variables d'environnement critiques.
 * Appelé au démarrage côté serveur — fail fast si une variable manque.
 */
function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Variable d'environnement manquante : ${key}`);
    return value;
}

// Côté serveur uniquement (ne pas importer dans du code client)
export const serverEnv = {
    DATABASE_URL:          requireEnv('DATABASE_URL'),
    GEMINI_API_KEY:        requireEnv('GEMINI_API_KEY'),
    STRAVA_CLIENT_ID:      requireEnv('STRAVA_CLIENT_ID'),
    STRAVA_CLIENT_SECRET:  requireEnv('STRAVA_CLIENT_SECRET'),
} as const;

// Côté client (préfixe NEXT_PUBLIC_)
export const publicEnv = {
    SUPABASE_URL:      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
} as const;
