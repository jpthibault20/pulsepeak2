import { redirect } from 'next/navigation';
import AppClientWrapper from '@/components/AppClientWrapper';
import { getObjectives, getProfile, getSchedule } from '@/lib/data/crud';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  console.log("--- ⚡ Chargement Page Home (Lecture DB Locale) ---");

  const [profile, schedule, objectives] = await Promise.all([
    getProfile(),
    getSchedule(),
    getObjectives(),
  ]);

  console.log("✅ Chargement terminée.");

  return (
    <main className="min-h-screen bg-slate-950">
      <AppClientWrapper
        initialProfile={profile}
        initialSchedule={schedule}
        initialObjectives={objectives}
      />
    </main>
  );
}
