import { redirect } from 'next/navigation';
import AppClientWrapper from '@/components/AppClientWrapper';
import { getObjectives, getProfile, getSchedule } from '@/lib/data/crud';
import { createClient } from '@/lib/supabase/server';
import { recalculateFitnessMetrics } from '@/app/actions/schedule';
import { touchLastLogin } from '@/app/actions/auth';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  try { await touchLastLogin(); } catch { /* non bloquant */ }

  // Mise à jour CTL/ATL avant chargement du profil :
  // recalculateFitnessMetrics itère jour par jour jusqu'à aujourd'hui,
  // les jours de récup (TSS=0) font naturellement décroître ATL.
  try { await recalculateFitnessMetrics(); } catch { /* non bloquant */ }

  const [profile, schedule, objectives] = await Promise.all([
    getProfile(),
    getSchedule(),
    getObjectives(),
  ]);

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <AppClientWrapper
        initialProfile={profile}
        initialSchedule={schedule}
        initialObjectives={objectives}
      />
    </main>
  );
}
