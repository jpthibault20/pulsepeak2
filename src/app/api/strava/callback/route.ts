import { NextResponse, NextRequest } from 'next/server';
import { updateProfileStravaData } from '@/lib/profile-db';
import { StravaConfig } from '@/lib/data/type'; // Vérifie le chemin d'import

// Interface pour la réponse brute de l'API Strava (celle qui vient du fetch)
interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    username?: string;
    firstname?: string;
    lastname?: string;
    // On peut ajouter d'autres champs si besoin, mais 'id' est le plus important
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.json({ error: 'Erreur autorisation Strava' }, { status: 400 });
  }

  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Les variables d\'environnement STRAVA sont manquantes.');
    }

    // 1. Échanger le CODE temporaire contre un TOKEN permanent
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    // On type la réponse reçue
    const data = (await tokenResponse.json()) as StravaTokenResponse;

    if (!tokenResponse.ok) {
        // Si Strava renvoie une erreur JSON, on l'attrape ici
        throw new Error(JSON.stringify(data));
    }

    // 2. Préparer les données à sauvegarder (Mapping vers notre format Clean)
    const stravaData: StravaConfig = {
      athleteId: data.athlete.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    };

    // 3. Sauvegarder dans profile.json
    await updateProfileStravaData(stravaData);

    // 4. Rediriger l'utilisateur
    return NextResponse.redirect(new URL('/', request.url)); 

  } catch (err: unknown) {
    // Gestion type-safe de l'erreur
    console.error('Erreur Strava Callback:', err);
    
    let errorMessage = 'Une erreur inconnue est survenue';
    if (err instanceof Error) {
        errorMessage = err.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
