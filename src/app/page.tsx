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
  deleteWorkout,     // Nouvelle action
  regenerateWorkout  // Nouvelle action
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
        // Si on était en loading, on va au dashboard. Sinon on reste sur la vue actuelle.
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
  };

  const handleViewWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setView('workout-detail');
  };

  // --- Handlers (Server Actions Wrappers) ---

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

    // Mise à jour locale pour la vue détail immédiate
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

  // Suppression d'une séance
  const handleDeleteWorkout = async (dateKey: string) => {
    await deleteWorkout(dateKey);
    await loadData();
    // Retour au dashboard car la séance n'existe plus
    setView('dashboard');
    setSelectedWorkout(null);
  };

  // Régénération d'une séance (avec instruction optionnelle)
  const handleRegenerateWorkout = async (dateKey: string, instruction?: string) => {
    await regenerateWorkout(dateKey, instruction);

    // Rechargement pour obtenir la nouvelle séance depuis le fichier
    const { schedule: newSchedule } = await loadInitialData();
    setSchedule(newSchedule);

    // Mise à jour de la séance sélectionnée pour l'affichage
    if (newSchedule && newSchedule.workouts[dateKey]) {
      setSelectedWorkout(newSchedule.workouts[dateKey]);
    }
  };

  // --- Logique d'affichage ---

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 animate-pulse">Chargement de PulsePeak...</p>
      </div>
    );
  }

  const showNav = view !== 'onboarding';

  // Affiche le bouton retour dans le header pour Settings et Stats
  const showBackButton = view === 'settings' || view === 'stats';

  return (
    <>
      {showNav && (
        <Nav
          onViewChange={handleViewChange}
          currentView={view}
          // Passage des props pour le logo et le retour
          appName="PulsePeak"
          showBack={showBackButton}
          onBack={() => handleViewChange('dashboard')}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <Card className="bg-red-900/50 border-red-500/50 mb-6">
            <p className="text-red-300 font-bold">Erreur Critique: {error}</p>
            <p className="text-red-400 text-sm mt-1">Veuillez vérifier vos logs et la configuration.</p>
          </Card>
        )}

        {view === 'onboarding' && (
          <div className="max-w-2xl mx-auto py-8">
            <ProfileForm
              initialProfileData={profile}
              onSave={handleSaveProfile}
              onSuccess={() => handleViewChange('dashboard')}
              onCancel={() => handleViewChange('dashboard')}
            />
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl mx-auto py-8 animate-in fade-in duration-300">
            {/* Le bouton retour manuel a été retiré ici car géré par la Nav */}
            <ProfileForm
              initialProfileData={profile}
              onSave={handleSaveProfile}
              onSuccess={() => handleViewChange('dashboard')}
              onCancel={() => handleViewChange('dashboard')}
              isSettings={true}
            />
          </div>
        )}

        {view === 'dashboard' && schedule && (
          <CalendarView
            scheduleData={schedule}
            onViewWorkout={handleViewWorkout}
            onGenerate={handleGenerate}
            onAddManualWorkout={handleAddManualWorkout}
          />
        )}

        {view === 'workout-detail' && selectedWorkout && profile && (
          <WorkoutDetailView
            workout={selectedWorkout}
            profile={profile}
            onClose={() => handleViewChange('dashboard')}
            onUpdate={handleUpdateStatus}
            onToggleMode={handleToggleMode}
            onMoveWorkout={handleMoveWorkout}
            // Passage des nouvelles fonctions
            onDelete={handleDeleteWorkout}
            onRegenerate={handleRegenerateWorkout}
          />
        )}

        {view === 'stats' && schedule && profile && (
          <StatsView
            scheduleData={schedule}
            profile={profile}
          />
        )}
      </main>
    </>
  );
}