'use client';

import React, { useState, useCallback } from 'react';

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
    regenerateWorkout,
    syncStravaActivities,
} from '@/app/actions/schedule';

// Import des types
import type { Profile, Schedule, Workout, CompletedDataFeedback } from '@/lib/data/type';

// Import des composants
import { CalendarView } from '@/components/features/calendar/CalendarView';
import { ProfileForm } from '@/components/features/profile/ProfileForm';
import { StatsView } from '@/components/features/stats/StatsView';
import { WorkoutDetailView } from '@/components/features/workout/WorkoutDetailView';
import { Nav, View } from '@/components/layout/nav';
import { Card } from '@/components/ui';
import { createCompletedData } from '@/lib/utils';

// Definition des Props reçues du Server Component
interface AppClientWrapperProps {
    initialProfile: Profile;
    initialSchedule: Schedule;
}

// --- Composant Principal ---
export default function AppClientWrapper({ initialProfile, initialSchedule }: AppClientWrapperProps) {

    // --- State Management ---
    const startView: View = initialProfile.firstName ? 'dashboard' : 'onboarding';
    const [view, setView] = useState<View>(startView);

    const [profile, setProfile] = useState<Profile | null>(initialProfile);
    const [schedule, setSchedule] = useState<Schedule | null>(initialSchedule);
    const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
    
    // Etats UI
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false); // <-- NOUVEL ETAT

    // --- Re-Fetch des données (Utile après une action de l'utilisateur) ---
    const refreshData = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const { profile: profileData, schedule: scheduleData } = await loadInitialData();
            setProfile(profileData);
            setSchedule(scheduleData);
            setError(null);
        } catch (e) {
            console.error('Erreur refresh données:', e);
            setError('Erreur lors de l\'actualisation des données.');
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    // --- Strava Sync Handler ---
    const handleSyncStrava = useCallback(async () => {
        try {
            setIsSyncing(true);
            setError(null);

            // 1. Appel Server Action qui récupère les activités Strava, les mappe 
            // avec mapStravaToCompletedData et met à jour la DB
            const result = await syncStravaActivities();

            if (result.count) {
                // 2. Si des nouvelles activités ont été trouvées/liées, on rafraichit l'affichage
                if (result.count > 0) {
                    await refreshData();
                } else {
                    // Optionnel : Notification "Pas de nouvelle activité"
                    console.log("Strava : À jour");
                }
            } 

        } catch (e) {
            console.error('Erreur synchro Strava:', e);
            setError('Impossible de synchroniser avec Strava.');
        } finally {
            setIsSyncing(false);
        }
    }, [refreshData]);

    React.useEffect(() => {
        if (initialProfile?.firstName) {
            handleSyncStrava();
        }
    },[handleSyncStrava, initialProfile?.firstName]);


    // --- Navigation Handler ---
    const handleViewChange = useCallback((view: View) => {
        if (view !== 'workout-detail') {
            setSelectedWorkout(null);
        }
        setView(view);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleViewWorkout = useCallback((workout: Workout) => {
        setSelectedWorkout(workout);
        setView('workout-detail');
    }, []);

    // --- Server Actions Handlers ---
    const handleGenerate = useCallback(async (
        blockFocus: string,
        customTheme: string | null,
        startDate: string | null,
        numWeeks?: number
    ) => {
        try {
            setIsRefreshing(true);
            await generateNewPlan(blockFocus, customTheme, startDate, numWeeks);
            await refreshData();
        } catch (e) {
            console.error('Erreur génération plan:', e);
            setError('Impossible de générer le plan. Réessayez.');
            setIsRefreshing(false);
        }
    }, [refreshData]);

    const handleSaveProfile = useCallback(async (data: Profile) => {
        try {
            await saveAthleteProfile(data);
            await refreshData();
        } catch (e) {
            console.error('Erreur sauvegarde profil:', e);
            setError('Impossible de sauvegarder le profil.');
        }
    }, [refreshData]);

    const handleUpdateStatus = useCallback(async (
        workoutIdOrDate: string,
        status: 'pending' | 'completed' | 'missed',
        feedback?: CompletedDataFeedback
    ) => {
        try {
            await updateWorkoutStatus(workoutIdOrDate, status, feedback);
            // Mise à jour optimiste + Refresh
            if (schedule && feedback) {
                const updatedWorkout = schedule.workouts.find(
                    w => w.id === workoutIdOrDate || w.date === workoutIdOrDate
                );
                if (updatedWorkout) {
                    setSelectedWorkout({
                        ...updatedWorkout,
                        status,
                        completedData: createCompletedData(feedback),
                    });
                }
            }
            await refreshData();
        } catch (e) {
            console.error('Erreur mise à jour statut:', e);
            setError('Impossible de mettre à jour le statut.');
        }
    }, [refreshData, schedule]);

    const handleToggleMode = useCallback(async (workoutIdOrDate: string) => {
        try {
            await toggleWorkoutMode(workoutIdOrDate);
            // Optimiste
            if (schedule) {
                const workout = schedule.workouts.find(
                    w => w.id === workoutIdOrDate || w.date === workoutIdOrDate
                );
                if (workout) {
                    const newMode = workout.mode === 'Outdoor' ? 'Indoor' : 'Outdoor';
                    setSelectedWorkout({ ...workout, mode: newMode });
                }
            }
            await refreshData();
        } catch (e) {
            console.error('Erreur toggle mode:', e);
            setError('Impossible de changer le mode.');
        }
    }, [refreshData, schedule]);

    const handleMoveWorkout = useCallback(async (originalDateOrId: string, newDateStr: string) => {
        try {
            await moveWorkout(originalDateOrId, newDateStr);
            await refreshData();
        } catch (e) {
            console.error('Erreur déplacement séance:', e);
            setError('Impossible de déplacer la séance.');
        }
    }, [refreshData]);

    const handleAddManualWorkout = useCallback(async (workout: Workout) => {
        try {
            await addManualWorkout(workout);
            await refreshData();
        } catch (e) {
            console.error('Erreur ajout séance:', e);
            setError('Impossible d\'ajouter la séance.');
        }
    }, [refreshData]);

    const handleDeleteWorkout = useCallback(async (workoutIdOrDate: string) => {
        try {
            await deleteWorkout(workoutIdOrDate);
            await refreshData();
            setView('dashboard');
            setSelectedWorkout(null);
        } catch (e) {
            console.error('Erreur suppression séance:', e);
            setError('Impossible de supprimer la séance.');
        }
    }, [refreshData]);

    const handleRegenerateWorkout = useCallback(async (workoutIdOrDate: string, instruction?: string) => {
        try {
            await regenerateWorkout(workoutIdOrDate, instruction);
            const { schedule: newSchedule } = await loadInitialData();
            setSchedule(newSchedule);
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

    const showNav = view !== 'onboarding';
    const showBackButton = view === 'settings' || view === 'stats';

    if (!profile || !schedule) {
        return <div className="text-white p-10">Erreur critique : Données manquantes.</div>;
    }

    return (
        <div className="flex flex-col min-h-dvh">
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
                                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 transition-colors">✕</button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Global Loading Indicator (Manual Refresh) */}
                {isRefreshing && !isSyncing && (
                    <div className="fixed top-20 right-4 z-40 bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Actualisation...</span>
                    </div>
                )}
                
                {/* Strava Sync Indicator */}
                {isSyncing && (
                    <div className="fixed top-20 right-4 z-40 bg-orange-600/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Synchro Strava...</span>
                    </div>
                )}

                {/* Views */}
                {view === 'onboarding' && (
                    <div className="max-w-2xl mx-auto py-4 sm:py-8">
                        <ProfileForm
                            initialData={profile}
                            onSave={handleSaveProfile}
                            onSuccess={() => handleViewChange('dashboard')}
                            onCancel={() => handleViewChange('dashboard')}
                        />
                    </div>
                )}

                {view === 'settings' && (
                    <div className="max-w-2xl mx-auto py-4 sm:py-8 animate-in fade-in duration-300">
                        <ProfileForm
                            initialData={profile}
                            onSave={handleSaveProfile}
                            onSuccess={() => handleViewChange('dashboard')}
                            onCancel={() => handleViewChange('dashboard')}
                            isSettings
                        />
                    </div>
                )}

                {view === 'dashboard' && (
                    <div className="animate-in fade-in duration-300">
                        <CalendarView
                            scheduleData={schedule}
                            onViewWorkout={handleViewWorkout}
                            onGenerate={handleGenerate}
                            onAddManualWorkout={handleAddManualWorkout}
                            // Nouveaux Props pour Strava
                            onSyncStrava={handleSyncStrava}
                            isSyncing={isSyncing}
                        />
                    </div>
                )}

                {view === 'workout-detail' && selectedWorkout && (
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

                {view === 'stats' && (
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
