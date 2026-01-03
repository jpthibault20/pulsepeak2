import AppClientWrapper from '@/components/AppClientWrapper';
import { getProfile } from '@/lib/profile-db'; // Adapter le chemin selon ta structure réelle
import { getSchedule } from '@/lib/data/crud'; // Adapter le chemin selon ta structure réelle

export default async function Home() {
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
