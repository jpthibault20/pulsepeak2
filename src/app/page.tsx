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
  // --- NOUVEAUX IMPORTS ---
  deleteWorkout,      // À créer dans server actions
  regenerateWorkout   // À créer dans server actions
} from '@/app/actions/schedule';

import { Profile, Schedule, Workout } from '@/lib/data/type';
import { CalendarView } from '@/components/features/calendar/CalendarView';
import { ProfileForm } from '@/components/features/profile/ProfileForm';
import { StatsView } from '@/components/features/stats/StatsView';
import { WorkoutDetailView } from '@/components/features/workout/WorkoutDetailView';
import { Nav } from '@/components/layout/nav';
import { Card } from '@/components/ui';
import { ChevronLeft } from 'lucide-react';

type View = 'loading' | 'onboarding' | 'dashboard' | 'workout-detail' | 'settings' | 'stats';

export default function AppClientWrapper() {
  const [view, setView] = useState<View>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const { profile: profileData, schedule: scheduleData } = await loadInitialData();
      setProfile(profileData);
      setSchedule(scheduleData);

      if (!profileData || !profileData.name) {
        setView('onboarding');
      } else {
        setView('dashboard');
      }
    } catch (e) {
      console.error("Erreur de chargement des données:", e);
      setError("Erreur lors du chargement des données.");
      setView('dashboard');
    }
  };

  useEffect(() => {
    (async () => {
      await loadData();
    })();
  }, []);

  const handleViewChange = (newView: View) => {
    if (newView !== 'workout-detail') setSelectedWorkout(null);
    setView(newView);
  };

  const handleViewWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setView('workout-detail');
  };

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
      if (prev) {
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
      if (prev) {
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

  // --- NOUVELLES FONCTIONS ---

  // 1. Suppression d'une séance
  const handleDeleteWorkout = async (dateKey: string) => {
    // Optionnel : Ajouter une confirmation UI ici ou dans le composant enfant
    await deleteWorkout(dateKey);
    await loadData();
    // Après suppression, on ferme la vue détail car la séance n'existe plus
    setView('dashboard');
    setSelectedWorkout(null);
  };

  // 2. Régénération d'une séance
  const handleRegenerateWorkout = async (dateKey: string, instruction?: string) => { // Ajout instruction
    await regenerateWorkout(dateKey, instruction); // Passage instruction

    const { schedule: newSchedule } = await loadInitialData();
    setSchedule(newSchedule);

    if (newSchedule && newSchedule.workouts[dateKey]) {
      setSelectedWorkout(newSchedule.workouts[dateKey]);
    }
  };


  // --- Rendu ---

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 animate-pulse">Chargement de l&apos;application Next.js...</p>
      </div>
    );
  }

  const showNav = view !== 'onboarding';

  return (
    <>
      {showNav && <Nav onViewChange={handleViewChange} currentView={view} />}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <Card className="bg-red-900/50 border-red-500/50 mb-6">
            <p className="text-red-300 font-bold">Erreur Critique: {error}</p>
          </Card>
        )}

        {/* ... (Blocs onboarding et settings inchangés) ... */}
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
            <button onClick={() => handleViewChange('dashboard')} className="mb-4 flex items-center text-slate-400 hover:text-white">
              <ChevronLeft size={20} className="mr-1" /> Retour Dashboard
            </button>
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
            // --- PASSAGE DES NOUVELLES PROPS ---
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