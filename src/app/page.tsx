'use client';

import React, { useState, useEffect } from 'react';
// Import des Server Actions
import {
  saveAthleteProfile,
  generateNewPlan,
  updateWorkoutStatus,
  toggleWorkoutMode,
  moveWorkout,
  loadInitialData,
  addManualWorkout,
  deleteWorkout,
  regenerateWorkout
} from '@/app/actions/schedule';

// Import des types
import { Profile, Schedule, Workout } from '@/lib/data/type';

// Import des composants
import { CalendarView } from '@/components/features/calendar/CalendarView';
import { ProfileForm } from '@/components/features/profile/ProfileForm';
import { StatsView } from '@/components/features/stats/StatsView';
import { WorkoutDetailView } from '@/components/features/workout/WorkoutDetailView';
import { Nav } from '@/components/layout/nav';
import { Card } from '@/components/ui';

// --- Types pour le composant principal
type View = 'loading' | 'onboarding' | 'dashboard' | 'workout-detail' | 'settings' | 'stats';

// --- Composant Principal
export default function AppClientWrapper() {
  const [view, setView] = useState<View>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Chargement des données ---
  const loadData = async () => {
    try {
      const { profile: profileData, schedule: scheduleData } = await loadInitialData();

      setProfile(profileData);
      setSchedule(scheduleData);

      if (!profileData || !profileData.name) {
        setView('onboarding');
      } else {
        if (view === 'loading') setView('dashboard');
      }
    } catch (e) {
      console.error("Erreur de chargement des données:", e);
      setError("Erreur lors du chargement des données. Vérifiez la console serveur.");
      setView('dashboard');
    }
  };

  useEffect(() => {
    (async () => {
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Gestion de la Navigation ---
  const handleViewChange = (newView: View) => {
    if (newView !== 'workout-detail') setSelectedWorkout(null);
    setView(newView);
    // Scroll automatique vers le haut lors du changement de vue sur mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setView('workout-detail');
  };

  // --- Handlers (Server Actions Wrappers) ---
  // ... (Je garde tes handlers tels quels car la logique métier ne change pas pour le responsive) ...

  const handleGenerate = async (blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) => {
    await generateNewPlan(blockFocus, customTheme, startDate, numWeeks);
    await loadData();
  };

  const handleSaveProfile = async (data: Profile) => {
    await saveAthleteProfile(data);
    await loadData();
  };

  const handleUpdateStatus = async (dateKey: string, status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => {
    await updateWorkoutStatus(dateKey, status, feedback);
    await loadData();
    setSchedule(prev => {
      if (prev && prev.workouts[dateKey]) {
        const updatedWorkout = { ...prev.workouts[dateKey], status, completedData: feedback };
        setSelectedWorkout(updatedWorkout);
      }
      return prev;
    });
  };

  const handleToggleMode = async (dateKey: string) => {
    await toggleWorkoutMode(dateKey);
    await loadData();
    setSchedule(prev => {
      if (prev && prev.workouts[dateKey]) {
        const currentMode = prev.workouts[dateKey].mode;
        const newMode = (currentMode === 'Outdoor' ? 'Indoor' : 'Outdoor') as 'Outdoor' | 'Indoor';
        const updatedWorkout = { ...prev.workouts[dateKey], mode: newMode };
        setSelectedWorkout(updatedWorkout);
      }
      return prev;
    });
  };

  const handleMoveWorkout = async (originalDateStr: string, newDateStr: string) => {
    await moveWorkout(originalDateStr, newDateStr);
    await loadData();
  };

  const handleAddManualWorkout = async (workout: Workout) => {
    await addManualWorkout(workout);
    await loadData();
  };

  const handleDeleteWorkout = async (dateKey: string) => {
    await deleteWorkout(dateKey);
    await loadData();
    setView('dashboard');
    setSelectedWorkout(null);
  };

  const handleRegenerateWorkout = async (dateKey: string, instruction?: string) => {
    await regenerateWorkout(dateKey, instruction);
    const { schedule: newSchedule } = await loadInitialData();
    setSchedule(newSchedule);
    if (newSchedule && newSchedule.workouts[dateKey]) {
      setSelectedWorkout(newSchedule.workouts[dateKey]);
    }
  };

  // --- Logique d'affichage ---

  if (view === 'loading') {
    return (
      // DESIGN: Utilisation de min-h-[100dvh] pour gérer les barres de navigation mobiles safari/chrome
      <div className="min-h-dvh flex flex-col items-center justify-center text-white bg-slate-950 p-4 text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 animate-pulse font-medium">Chargement de PulsePeak...</p>
      </div>
    );
  }

  const showNav = view !== 'onboarding';
  const showBackButton = view === 'settings' || view === 'stats';

  return (
    // DESIGN: bg-slate-950 assure un fond sombre cohérent sur toute la page, même au delà du contenu
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {showNav && (
        // DESIGN: Sticky nav pour qu'elle reste accessible sur mobile lors du scroll
        <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
          <Nav
            onViewChange={handleViewChange}
            currentView={view}
            appName="PulsePeak"
            showBack={showBackButton}
            onBack={() => handleViewChange('dashboard')}
          />
        </div>
      )}

      {/* DESIGN RESPONSIVE:
        - flex-1 : force le main à prendre toute la hauteur disponible
        - px-3 : marges fines sur mobile
        - sm:px-6 : marges confortables sur tablette/ordi
        - py-4 : moins d'espace vertical perdu sur mobile
        - pb-20 : espace en bas pour scroller confortablement sur mobile
      */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 sm:pb-8">

        {error && (
          <Card className="bg-red-900/50 border-red-500/50 mb-6 animate-in slide-in-from-top-2">
            <div className="p-4">
              <p className="text-red-300 font-bold flex items-center gap-2">
                ⚠️ Erreur Critique
              </p>
              <p className="text-red-400 text-sm mt-1">{error}</p>
            </div>
          </Card>
        )}

        {view === 'onboarding' && (
          <div className="max-w-2xl mx-auto py-4 sm:py-8">
            <ProfileForm
              initialProfileData={profile}
              onSave={handleSaveProfile}
              onSuccess={() => handleViewChange('dashboard')}
              onCancel={() => handleViewChange('dashboard')}
            />
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl mx-auto py-4 sm:py-8 animate-in fade-in duration-300">
            <ProfileForm
              initialProfileData={profile}
              onSave={handleSaveProfile}
              onSuccess={() => handleViewChange('dashboard')}
              onCancel={() => handleViewChange('dashboard')}
              isSettings={true}
            />
          </div>
        )}

        {/* Pour le Dashboard (Calendrier), on veut souvent utiliser toute la largeur sur mobile.
          Note: Le composant CalendarView devra lui-même gérer le passage de "Grille" à "Liste" sur mobile.
        */}
        {view === 'dashboard' && schedule && (
          <div className="animate-in fade-in duration-300">
            <CalendarView
              scheduleData={schedule}
              onViewWorkout={handleViewWorkout}
              onGenerate={handleGenerate}
              onAddManualWorkout={handleAddManualWorkout}
            />
          </div>
        )}

        {view === 'workout-detail' && selectedWorkout && profile && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <WorkoutDetailView
              workout={selectedWorkout}
              profile={profile}
              onClose={() => handleViewChange('dashboard')}
              onUpdate={handleUpdateStatus}
              onToggleMode={handleToggleMode}
              onMoveWorkout={handleMoveWorkout}
              onDelete={handleDeleteWorkout}
              onRegenerate={handleRegenerateWorkout}
            />
          </div>
        )}

        {view === 'stats' && schedule && profile && (
          <div className="animate-in fade-in duration-300">
            <StatsView
              scheduleData={schedule}
              profile={profile}
            />
          </div>
        )}
      </main>
    </div>
  );
}