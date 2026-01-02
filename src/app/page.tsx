import AppClientWrapper from '@/components/AppClientWrapper';
import { getProfile } from '@/lib/profile-db';
import { getSchedule } from '@/lib/data/crud';
import { getRecentStravaActivities, getStravaActivityById } from '@/lib/strava-service'; // Import ajouté

// --- INTERFACES (Identiques à avant) ---
interface StravaLap {
  id: number;
  lap_index: number;
  distance: number;
  moving_time: number;
  average_watts?: number;
  average_heartrate?: number;
  average_cadence?: number;
  split?: number; // Parfois présent
}

interface StravaActivityDetailed {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  sport_type: string;
  laps?: StravaLap[]; // Le saint Graal
}

export default async function Home() {
  console.log("--- ⚡ Démarrage Page d'Accueil ---");

  // 1. On récupère les données de base + la LISTE des activités
  const [profile, schedule, rawList] = await Promise.all([
    getProfile(),
    getSchedule(),
    getRecentStravaActivities(5)
  ]);
  
  // Cast initial de la liste (qui contient des résumés)
  const activityList = rawList as unknown as StravaActivityDetailed[];

  if (activityList && activityList.length > 0) {
    console.log(`🚴 LISTE : ${activityList.length} résumés récupérés.`);

    // 2. FOCUS SUR LA DERNIÈRE ACTIVITÉ (La première de la liste, ex: Zwift)
    // On va chercher ses détails COMPLETS pour avoir les 'laps'
    const latestActivityId = activityList[0].id;
    console.log(`🔍 Récupération des détails pour l'ID : ${latestActivityId} (${activityList[0].name})...`);
    
    // Appel API supplémentaire pour le détail
    const rawDetail = await getStravaActivityById(latestActivityId); 
    
    if (rawDetail) {
      const detailedActivity = rawDetail as unknown as StravaActivityDetailed;

      console.log(`\n___ DÉTAILS DE : ${detailedActivity.name} ___`);
      
      // Vérification des LAPS (Tours)
      if (detailedActivity.laps && detailedActivity.laps.length > 0) {
        console.log(`✅ ${detailedActivity.laps.length} TOURS (Intervalles) trouvés !`);
        
        detailedActivity.laps.forEach((lap) => {
          const distKm = (lap.distance / 1000).toFixed(2);
          const duration = new Date(lap.moving_time * 1000).toISOString().substr(14, 5); // mm:ss
          const watts = lap.average_watts ? `${Math.round(lap.average_watts)}W` : '-';
          const bpm = lap.average_heartrate ? `${Math.round(lap.average_heartrate)}bpm` : '-';

          console.log(`   🔸 Tour ${lap.lap_index} : ${distKm}km en ${duration} | ${watts} | ${bpm}`);
        });
      } else {
        console.log("ℹ️ Aucun tour manuel (Lap button) détecté dans le détail.");
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <AppClientWrapper 
        initialProfile={profile} 
        initialSchedule={schedule}
      />
    </main>
  );
}
