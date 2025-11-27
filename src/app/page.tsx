'use client';

import React, { useState, useEffect } from 'react';
// Import des Server Actions (y compris loadInitialData)
import {
  saveAthleteProfile,
  generateNewPlan,
  updateWorkoutStatus,
  toggleWorkoutMode,
  moveWorkout,
  loadInitialData
} from '@/app/actions/schedule';
// Import des types du fichier dédié (Client-safe)
import { Profile, Schedule, Workout } from '@/lib/data/type';
import {
  Nav,
  ProfileForm,
  CalendarView,
  WorkoutDetailView,
  Card,
  ChevronLeft,
  BarChart2
} from '@/components/ui';

// --- Types pour le composant principal
type View = 'loading' | 'onboarding' | 'dashboard' | 'workout-detail' | 'settings' | 'stats';

// --- Composant Principal (Client Component pour la gestion des vues)
// C'est le point d'entrée qui orchestre l'application
export default function AppClientWrapper() {
  const [view, setView] = useState<View>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour charger les données (Utilise désormais une Server Action)
  const loadData = async () => {
    try {
      // Utilisation de la Server Action pour éviter d'importer directement 'fs'
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
      setError("Erreur lors du chargement des données. Veuillez vérifier les fichiers JSON ou la console pour les erreurs serveur.");
      setView('dashboard');
    }
  };

  useEffect(() => {
    (async () => {
      await loadData();
    })();
  }, []);

  // Fonction pour gérer la navigation et la sélection de séance
  const handleViewChange = (newView: View) => {
    if (newView !== 'workout-detail') setSelectedWorkout(null);
    setView(newView);
  };

  const handleViewWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setView('workout-detail');
  };

  // Wrapper pour les Server Actions
  // MISE À JOUR : Ajout du paramètre startDate pour correspondre à la nouvelle signature dans schedule.ts
  const handleGenerate = async (blockFocus: string, customTheme: string | null, startDate: string | null) => {
    await generateNewPlan(blockFocus, customTheme, startDate);
    await loadData(); // Recharger les données après la mutation
  };

  const handleSaveProfile = async (data: Profile) => {
    await saveAthleteProfile(data);
    await loadData();
  };

  // Met à jour le statut, recharge les données, et met à jour l'objet de la séance sélectionnée
  const handleUpdateStatus = async (dateKey: string, status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => {
    await updateWorkoutStatus(dateKey, status, feedback);
    await loadData();
    // Simuler la mise à jour de la séance sélectionnée (important pour la vue détail)
    setSchedule(prev => {
      if (prev) {
        const updatedWorkout = { ...prev.workouts[dateKey], status, completedData: feedback };
        setSelectedWorkout(updatedWorkout);
      }
      return prev;
    });
  };

  // Bascule le mode, recharge les données, et met à jour l'objet de la séance sélectionnée
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

  // --- Rendu basé sur l'état de la vue ---

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
            <p className="text-red-400 text-sm mt-1">Veuillez vérifier vos logs et la configuration de la clé API ou des fichiers JSON.</p>
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
          />
        )}
        {view === 'stats' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => handleViewChange('dashboard')} className="mb-4 flex items-center text-slate-400 hover:text-white">
              <ChevronLeft size={20} className="mr-1" /> Retour Dashboard
            </button>
            <Card className="min-h-[400px] flex items-center justify-center">
              <p className="text-2xl text-slate-400"><BarChart2 size={32} className="inline mr-2" />Vue Statistiques (à implémenter)</p>
            </Card>
          </div>
        )}
      </main>
    </>
  );
}