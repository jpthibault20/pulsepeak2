// src/lib/strava-service.ts
import { getProfile, updateProfileStravaData } from './profile-db';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;



/**
 * Cette fonction récupère un token valide.
 * Si l'actuel est périmé, elle le rafraîchit automatiquement et met à jour le JSON.
 */
async function getValidAccessToken() {
    const profile = await getProfile();

    if (!profile.strava) {
        throw new Error("Pas de compte Strava connecté.");
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);

    // On prend une marge de sécurité de 60 secondes
    if (profile.strava.expiresAt > nowInSeconds + 60) {
        return profile.strava.accessToken;
    }

    console.log("🔄 Token périmé ou proche de l'expiration. Rafraîchissement...");

    // Appel à Strava pour refresh
    const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: profile.strava.refreshToken,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Erreur refresh Strava", errorBody);
        throw new Error("Impossible de rafraîchir le token Strava");
    }

    const data = await response.json();

    // Mise à jour de la DB (fichier JSON) avec les nouveaux tokens
    await updateProfileStravaData({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athleteId: profile.strava.athleteId
    });

    console.log("✅ Token rafraîchi avec succès !");
    return data.access_token;
}

/**
 * Fonction principale pour récupérer les dernières activités
 */
export async function getStravaActivities(after: number | null = null, perPage: number = 30) {
  const accessToken = await getValidAccessToken();
  
  let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`;
  
  if (after) {
    url += `&after=${after}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 }, // Important: pas de cache ici car on veut du frais
  });

  if (!res.ok) {
    console.error("Erreur fetch activities:", res.statusText);
    return [];
  }

  return res.json();
}

export async function getStravaActivityById(id: number) {
  const accessToken = await getValidAccessToken(); // Assure-toi d'utiliser ta fonction de token existante
  
  const res = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 3600 }, // Cache d'une heure
  });

  if (!res.ok) {
    console.error(`Erreur fetch detail activity ${id}:`, res.statusText);
    return null;
  }

  return res.json();
}
