// app/api/strava/login/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; // ex: http://localhost:3000

    if (!clientId || !baseUrl) {
        return NextResponse.json({ error: 'Config manquante' }, { status: 500 });
    }

    // Voici l'URL exact que Strava attend pour nous renvoyer la réponse
    const redirectUri = `${baseUrl}/api/strava/callback`;

    // On demande la permission de LIRE les activités (activity:read_all)
    const scope = 'activity:read_all';

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        approval_prompt: 'auto',
        scope: scope,
    });

    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;

    return NextResponse.redirect(stravaAuthUrl);
}
