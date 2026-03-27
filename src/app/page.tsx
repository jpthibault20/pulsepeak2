import { redirect } from 'next/navigation';
import AppClientWrapper from '@/components/AppClientWrapper';
import { getProfile } from '@/lib/profile-db';
import { getSchedule } from '@/lib/data/crud';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  console.log("--- ⚡ Chargement Page Home (Lecture DB Locale) ---");

  const [profile, schedule] = await Promise.all([
    getProfile(),
    getSchedule()
  ]);

  console.log("✅ Chargement terminée.");

  return (
    <main className="min-h-screen bg-slate-950">
      <AppClientWrapper
        initialProfile={profile}
        initialSchedule={schedule}
      />
    </main>
  );
}
