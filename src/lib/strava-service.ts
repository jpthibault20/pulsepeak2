// src/lib/strava-service.ts
import { getProfile, updateProfileStravaData } from './profile-db';
import { mapStravaToCompletedData, tagStravaActivity, StravaStream } from './strava-mapper';

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
 * Récupère une seule page d'activités (sync incrémentale rapide).
 */
export async function getStravaActivities(after: number | null = null, perPage: number = 30) {
  const accessToken = await getValidAccessToken();

  let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`;

  if (after) {
    url += `&after=${after}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error("Erreur fetch activities:", res.statusText);
    return [];
  }

  return res.json();
}

/**
 * Récupère TOUTES les activités depuis un timestamp donné, en paginant.
 * Utilisé pour la sync complète de l'année (jusqu'à 200 activités/page, max Strava).
 */
interface StravaSummary { id: number; start_date: string; [key: string]: unknown }

export async function getStravaActivitiesAllPages(after: number): Promise<StravaSummary[]> {
  const accessToken = await getValidAccessToken();
  const PER_PAGE = 200;
  const all: StravaSummary[] = [];
  let page = 1;

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${PER_PAGE}&after=${after}&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error(`Erreur fetch page ${page}:`, res.statusText);
      break;
    }

    const batch: StravaSummary[] = await res.json();
    if (!batch.length) break;

    all.push(...batch);
    console.log(`   📄 Page ${page} : ${batch.length} activités`);

    if (batch.length < PER_PAGE) break; // Dernière page
    page++;
  }

  return all;
}

/**
 * Récupère les streams (watts, time) d'une activité Strava.
 * Retourne null si pas de capteur de puissance ou erreur.
 */
async function getStravaStreams(accessToken: string, activityId: number): Promise<StravaStream | null> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=watts,time&key_type=time`,
      { headers: { Authorization: `Bearer ${accessToken}` }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;

    const streams: { type: string; data: number[] }[] = await res.json();
    const result: StravaStream = {};
    for (const s of streams) {
      if (s.type === 'watts') result.watts = { data: s.data };
      if (s.type === 'time') result.time = { data: s.data };
    }
    return result.watts ? result : null;
  } catch {
    return null;
  }
}

export async function getStravaActivityById(id: number) {
  const accessToken = await getValidAccessToken();

  const [res, streams] = await Promise.all([
    fetch(`https://www.strava.com/api/v3/activities/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 3600 },
    }),
    getStravaStreams(accessToken, id),
  ]);

  if (!res.ok) {
    console.error(`Erreur fetch detail activity ${id}:`, res.statusText);
    return null;
  }

  const x = await res.json();

  const completedData = await mapStravaToCompletedData(x, streams);

  const profile = await getProfile();
  if (profile.stravaWriteBack !== false) {
    await tagStravaActivity(
      accessToken,
      x.id,
      x.description,
      { tss: completedData.calculatedTSS ?? null }
    );
  }

  return { raw: x, completedData };
}
