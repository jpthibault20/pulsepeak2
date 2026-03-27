import { createClient } from '@/lib/supabase/server';
import { createInitialProfile } from '@/app/actions/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Créer le profil si pas encore existant (confirmation email tardive).
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const meta = user.user_metadata ?? {};
                await createInitialProfile(
                    user.id,
                    meta.first_name  ?? '',
                    meta.last_name   ?? '',
                    user.email       ?? '',
                );
            }
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/auth?error=auth_callback_error`);
}
