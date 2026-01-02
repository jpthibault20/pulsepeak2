'use client';

import React, { useState, useEffect, useCallback } from 'react';

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
import type { Profile, Schedule, Workout, CompletedDataFeedback } from '@/lib/data/type';

// Import des composants
import { CalendarView } from '@/components/features/calendar/CalendarView';
import { ProfileForm } from '@/components/features/profile/ProfileForm';
import { StatsView } from '@/components/features/stats/StatsView';
import { WorkoutDetailView } from '@/components/features/workout/WorkoutDetailView';
import { Nav } from '@/components/layout/nav';
import { Card } from '@/components/ui';
import { createCompletedData } from '@/lib/utils';

// --- Types pour le composant principal ---
type View =
  | 'loading'
  | 'onboarding'
  | 'dashboard'
  | 'workout-detail'
  | 'settings'
  | 'stats';

// 📁 app/page.tsx




// --- Composant Principal ---
export default function AppClientWrapper() {
  // --- State Management ---
  const [view, setView] = useState<View>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Chargement des données (memoized) ---
  const loadData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const { profile: profileData, schedule: scheduleData } = await loadInitialData();

      setProfile(profileData);
      setSchedule(scheduleData);

      // Détermination de la vue initiale
      if (!profileData?.name && view === 'loading') {
        setView('onboarding');
      } else if (view === 'loading') {
        setView('dashboard');
      }

      // Clear error on successful load
      setError(null);
    } catch (e) {
      console.error('Erreur de chargement des données:', e);
      setError(
        e instanceof Error
          ? e.message
          : 'Erreur lors du chargement des données. Vérifiez la console serveur.'
      );
      if (view === 'loading') setView('dashboard');
    } finally {
      setIsRefreshing(false);
    }
  }, [view]);

  // Initial load
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // --- Navigation Handler (memoized) ---
  const handleViewChange = useCallback((newView: View) => {
    if (newView !== 'workout-detail') {
      setSelectedWorkout(null);
    }
    setView(newView);

    // Smooth scroll to top on view change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleViewWorkout = useCallback((workout: Workout) => {
    setSelectedWorkout(workout);
    setView('workout-detail');
  }, []);

  // --- Server Actions Handlers (memoized) ---

  const handleGenerate = useCallback(async (
    blockFocus: string,
    customTheme: string | null,
    startDate: string | null,
    numWeeks?: number
  ) => {
    try {
      await generateNewPlan(blockFocus, customTheme, startDate, numWeeks);
      await loadData();
    } catch (e) {
      console.error('Erreur génération plan:', e);
      setError('Impossible de générer le plan. Réessayez.');
    }
  }, [loadData]);

  const handleSaveProfile = useCallback(async (data: Profile) => {
    try {
      await saveAthleteProfile(data);
      await loadData();
    } catch (e) {
      console.error('Erreur sauvegarde profil:', e);
      setError('Impossible de sauvegarder le profil.');
    }
  }, [loadData]);

  const handleUpdateStatus = useCallback(async (
    workoutIdOrDate: string,
    status: 'pending' | 'completed' | 'missed',
    feedback?: CompletedDataFeedback
  ) => {
    try {

      await updateWorkoutStatus(workoutIdOrDate, status, feedback);
      await loadData();

      // Mise à jour optimiste avec la fonction helper
      if (schedule && feedback) {
        const updatedWorkout = schedule.workouts.find(
          w => w.id === workoutIdOrDate || w.date === workoutIdOrDate
        );

        if (updatedWorkout) {
          setSelectedWorkout({
            ...updatedWorkout,
            status,
            completedData: createCompletedData(feedback), // ✅ Type-safe
          });
        }
      }
    } catch (e) {
      console.error('Erreur mise à jour statut:', e);
      setError('Impossible de mettre à jour le statut.');
    }
  }, [loadData, schedule]);
  const handleToggleMode = useCallback(async (workoutIdOrDate: string) => {
    try {
      await toggleWorkoutMode(workoutIdOrDate);
      await loadData();

      // Mise à jour optimiste du workout sélectionné
      if (schedule) {
        const workout = schedule.workouts.find(
          w => w.id === workoutIdOrDate || w.date === workoutIdOrDate
        );
        if (workout) {
          const newMode = workout.mode === 'Outdoor' ? 'Indoor' : 'Outdoor';
          setSelectedWorkout({ ...workout, mode: newMode });
        }
      }
    } catch (e) {
      console.error('Erreur toggle mode:', e);
      setError('Impossible de changer le mode.');
    }
  }, [loadData, schedule]);

  const handleMoveWorkout = useCallback(async (
    originalDateOrId: string,
    newDateStr: string
  ) => {
    try {
      await moveWorkout(originalDateOrId, newDateStr);
      await loadData();
    } catch (e) {
      console.error('Erreur déplacement séance:', e);
      setError('Impossible de déplacer la séance.');
    }
  }, [loadData]);

  const handleAddManualWorkout = useCallback(async (workout: Workout) => {
    try {
      await addManualWorkout(workout);
      await loadData();
    } catch (e) {
      console.error('Erreur ajout séance:', e);
      setError('Impossible d\'ajouter la séance.');
    }
  }, [loadData]);

  const handleDeleteWorkout = useCallback(async (workoutIdOrDate: string) => {
    try {
      await deleteWorkout(workoutIdOrDate);
      await loadData();
      setView('dashboard');
      setSelectedWorkout(null);
    } catch (e) {
      console.error('Erreur suppression séance:', e);
      setError('Impossible de supprimer la séance.');
    }
  }, [loadData]);

  const handleRegenerateWorkout = useCallback(async (
    workoutIdOrDate: string,
    instruction?: string
  ) => {
    try {
      await regenerateWorkout(workoutIdOrDate, instruction);
      const { schedule: newSchedule } = await loadInitialData();
      setSchedule(newSchedule);

      // Mise à jour du workout sélectionné
      if (newSchedule) {
        const regeneratedWorkout = newSchedule.workouts.find(
          w => w.id === workoutIdOrDate || w.date === workoutIdOrDate
        );
        if (regeneratedWorkout) {
          setSelectedWorkout(regeneratedWorkout);
        }
      }
    } catch (e) {
      console.error('Erreur régénération séance:', e);
      setError('Impossible de régénérer la séance.');
    }
  }, []);

  // --- Render Logic ---

  // Loading state
  if (view === 'loading') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center text-white bg-slate-950 p-4 text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 animate-pulse font-medium">
          Chargement de PulsePeak...
        </p>
      </div>
    );
  }

  const showNav = view !== 'onboarding';
  const showBackButton = view === 'settings' || view === 'stats';

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Navigation */}
      {showNav && (
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

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 sm:pb-8">

        {/* Error Display */}
        {error && (
          <Card className="bg-red-900/50 border-red-500/50 mb-6 animate-in slide-in-from-top-2">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-red-300 font-bold flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    Erreur
                  </p>
                  <p className="text-red-400 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  aria-label="Fermer l'erreur"
                >
                  ✕
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Refresh Indicator */}
        {isRefreshing && (
          <div className="fixed top-20 right-4 z-40 bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Actualisation...</span>
          </div>
        )}

        {/* Onboarding View */}
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

        {/* Settings View */}
        {view === 'settings' && (
          <div className="max-w-2xl mx-auto py-4 sm:py-8 animate-in fade-in duration-300">
            <ProfileForm
              initialProfileData={profile}
              onSave={handleSaveProfile}
              onSuccess={() => handleViewChange('dashboard')}
              onCancel={() => handleViewChange('dashboard')}
              isSettings
            />
          </div>
        )}

        {/* Dashboard View (Calendar) */}
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

        {/* Workout Detail View */}
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

        {/* Stats View */}
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
