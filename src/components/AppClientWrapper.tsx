'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';

// Import des Server Actions
import {
    saveAthleteProfile,
    CreateAdvancedPlan,
    updateWorkoutStatus,
    toggleWorkoutMode,
    moveWorkout,
    loadInitialData,
    addManualWorkout,
    deleteWorkout,
    regenerateWorkout,
    syncStravaActivities,
    CreatePlanToObjective,
} from '@/app/actions/schedule';
import {
    saveObjectiveAction,
    deleteObjectiveAction,
} from '@/app/actions/objectives';

// Import des types
import type { CompletedDataFeedback } from '@/lib/data/type';
import type { Objective, Workout } from '@/lib/data/DatabaseTypes';
import { SubscriptionProvider, type Plan } from '@/lib/subscription/context';
import { FreePlanGate } from '@/components/features/billing/FreePlanGate';

// Import des composants
import { CalendarView } from '@/components/features/calendar/CalendarView';
import { ProfileForm } from '@/components/features/profile/ProfileForm';
import { StatsView } from '@/components/features/stats/StatsView';
import { WorkoutDetailView } from '@/components/features/workout/WorkoutDetailView';
import { Nav, View } from '@/components/layout/nav';
import { ChatView } from '@/components/features/chat/ChatView';
import { GenerationProgressModal, type GenProgressState } from '@/components/features/calendar/GenerationProgressModal';
import { Card } from '@/components/ui';
import { createCompletedData } from '@/lib/utils';
import { Profile, Schedule } from '@/lib/data/DatabaseTypes';

// Definition des Props reçues du Server Component
interface AppClientWrapperProps {
    initialProfile: Profile;
    initialSchedule: Schedule;
    initialObjectives: Objective[];
}

// --- Composant Principal ---
export default function AppClientWrapper({ initialProfile, initialSchedule, initialObjectives }: AppClientWrapperProps) {

    // --- State Management ---
    const startView: View = initialProfile.firstName ? 'dashboard' : 'onboarding';
    const [view, setView] = useState<View>(startView);

    const [profile, setProfile] = useState<Profile>(initialProfile);
    const [schedule, setSchedule] = useState<Schedule | null>(initialSchedule);
    const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
    const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

    // Calendrier — persist le mois sélectionné entre les changements de vue
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [calendarMobileDay, setCalendarMobileDay] = useState(new Date());

    // Etats UI
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const [genProgress, setGenProgress] = useState<GenProgressState | null>(null);
    const genProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (genProgressTimerRef.current) clearTimeout(genProgressTimerRef.current);
        };
    }, []);

    // --- Re-Fetch des données ---
    const refreshData = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const { profile: profileData, schedule: scheduleData, objectives: objectivesData } = await loadInitialData();
            setProfile(profileData as Profile);
            setSchedule(scheduleData);
            setObjectives(objectivesData);
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
            const result = await syncStravaActivities();
            if (result.count) {
                if (result.count > 0) {
                    await refreshData();
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
    }, [handleSyncStrava, initialProfile?.firstName]);

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

    // --- Plan Generation Handlers ---
    const handleGenerate = useCallback(async (
        blockFocus: string,
        customTheme: string | null,
        startDate: string,
        numWeeks: number
    ) => {
        const sports = [
            profile.activeSports.cycling ? 'Cyclisme' : '',
            profile.activeSports.running ? 'Course à pied' : '',
            profile.activeSports.swimming ? 'Natation' : '',
        ].filter(Boolean).join(', ');

        setGenProgress({
            active: true,
            minimized: false,
            done: false,
            startedAt: Date.now(),
            profileInfo: {
                firstName: profile.firstName,
                experience: profile.experience,
                currentCTL: profile.currentCTL,
                sports,
            },
        });

        try {
            setIsRefreshing(true);
            await CreateAdvancedPlan(blockFocus, customTheme, startDate, numWeeks, profile.id);
            await refreshData();
            setGenProgress(prev => prev ? { ...prev, done: true, minimized: false } : null);
            if (genProgressTimerRef.current) clearTimeout(genProgressTimerRef.current);
            genProgressTimerRef.current = setTimeout(() => setGenProgress(null), 1500);
        } catch (e) {
            console.error('Erreur génération plan:', e);
            setGenProgress(null);
            setError('Impossible de générer le plan. Réessayez.');
        } finally {
            setIsRefreshing(false);
        }
    }, [profile, refreshData]);

    const handleGenerateToObjective = useCallback(async (planStartDate: string) => {
        const sports = [
            profile.activeSports.cycling ? 'Cyclisme' : '',
            profile.activeSports.running ? 'Course à pied' : '',
            profile.activeSports.swimming ? 'Natation' : '',
        ].filter(Boolean).join(', ');

        setGenProgress({
            active: true,
            minimized: false,
            done: false,
            startedAt: Date.now(),
            profileInfo: {
                firstName: profile.firstName,
                experience: profile.experience,
                currentCTL: profile.currentCTL,
                sports,
            },
        });

        try {
            setIsRefreshing(true);
            const result = await CreatePlanToObjective(profile.id, planStartDate);
            if ('error' in result && result.error) {
                setGenProgress(null);
                setError(result.error);
                return;
            }
            await refreshData();
            setGenProgress(prev => prev ? { ...prev, done: true, minimized: false } : null);
            if (genProgressTimerRef.current) clearTimeout(genProgressTimerRef.current);
            genProgressTimerRef.current = setTimeout(() => setGenProgress(null), 1500);
        } catch (e) {
            console.error('Erreur génération plan vers objectif:', e);
            setGenProgress(null);
            setError('Impossible de générer le plan. Réessayez.');
        } finally {
            setIsRefreshing(false);
        }
    }, [profile, refreshData]);

    // --- Objective Handlers ---
    const handleSaveObjective = useCallback(async (obj: Objective) => {
        try {
            const result = await saveObjectiveAction(obj);
            if (result.objective) {
                setObjectives(prev => {
                    const exists = prev.some(o => o.id === result.objective!.id);
                    return exists
                        ? prev.map(o => o.id === result.objective!.id ? result.objective! : o)
                        : [...prev, result.objective!];
                });
            }
        } catch (e) {
            console.error('Erreur sauvegarde objectif:', e);
            setError('Impossible de sauvegarder l\'objectif.');
        }
    }, []);

    const handleDeleteObjective = useCallback(async (id: string) => {
        try {
            await deleteObjectiveAction(id);
            setObjectives(prev => prev.filter(o => o.id !== id));
        } catch (e) {
            console.error('Erreur suppression objectif:', e);
            setError('Impossible de supprimer l\'objectif.');
        }
    }, []);

    // --- Profile Handler ---
    const handleSaveProfile = useCallback(async (data: Profile) => {
        try {
            await saveAthleteProfile(data);
            await refreshData();
        } catch (e) {
            console.error('Erreur sauvegarde profil:', e);
            setError('Impossible de sauvegarder le profil.');
        }
    }, [refreshData]);

    // --- Workout Handlers ---
    const handleUpdateStatus = useCallback(async (
        workoutIdOrDate: string,
        status: 'pending' | 'completed' | 'missed',
        feedback?: CompletedDataFeedback
    ) => {
        try {
            await updateWorkoutStatus(workoutIdOrDate, status, feedback);
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

    if (!profile || !schedule) {
        return <div className="text-slate-900 dark:text-white p-10">Erreur critique : Données manquantes.</div>;
    }

    return (
        <SubscriptionProvider subscription={{ role: profile.role, plan: (profile.plan ?? 'free') as Plan }}>
            <div className="flex flex-col min-h-dvh">
                {showNav && (
                    <Nav
                        onViewChange={handleViewChange}
                        currentView={view}
                        appName="PulsePeak"
                    />
                )}

                <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 sm:pb-8">

                    {error && (
                        <Card className="bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-500/50 mb-6 animate-in slide-in-from-top-2">
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <p className="text-red-600 dark:text-red-300 font-bold flex items-center gap-2">
                                            <span className="text-lg">⚠️</span>
                                            Erreur
                                        </p>
                                        <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
                                    </div>
                                    <button onClick={() => setError(null)} className="text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">✕</button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {isRefreshing && !isSyncing && (
                        <div className="fixed top-20 right-4 z-40 bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-medium">Actualisation...</span>
                        </div>
                    )}

                    {view === 'onboarding' && (
                        <div className="max-w-2xl mx-auto py-4 sm:py-8">
                            <ProfileForm
                                initialData={profile}
                                onSave={handleSaveProfile}
                                onSuccess={() => handleViewChange('dashboard')}
                                onCancel={() => handleViewChange('dashboard')}
                                objectives={objectives}
                                onSaveObjective={handleSaveObjective}
                                onDeleteObjective={handleDeleteObjective}
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
                                objectives={objectives}
                                onSaveObjective={handleSaveObjective}
                                onDeleteObjective={handleDeleteObjective}
                            />
                        </div>
                    )}

                    {view === 'dashboard' && (
                        <div className="animate-in fade-in duration-300">
                            <CalendarView
                                scheduleData={schedule}
                                profile={profile}
                                userID={profile.id}
                                objectives={objectives}
                                onViewWorkout={handleViewWorkout}
                                onGenerate={handleGenerate}
                                onGenerateToObjective={handleGenerateToObjective}
                                onAddManualWorkout={handleAddManualWorkout}
                                onSaveObjective={handleSaveObjective}
                                onRefresh={refreshData}
                                onSyncStrava={handleSyncStrava}
                                isSyncing={isSyncing}
                                calendarDate={calendarDate}
                                onCalendarDateChange={setCalendarDate}
                                calendarMobileDay={calendarMobileDay}
                                onCalendarMobileDayChange={setCalendarMobileDay}
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
                                objectives={objectives}
                            />
                        </div>
                    )}

                    {view === 'chat' && (
                        <div className="animate-in fade-in duration-200 -mx-3 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-8">
                            <FreePlanGate
                                featureLabel="Coach IA"
                                featureDesc="Posez toutes vos questions à votre coach personnel disponible 24/7."
                            >
                                <ChatView
                                    profile={profile}
                                    schedule={schedule ?? undefined}
                                />
                            </FreePlanGate>
                        </div>
                    )}
                </main>
            </div>

            {genProgress && (
                <GenerationProgressModal
                    state={genProgress}
                    onMinimize={() => setGenProgress(prev => prev ? { ...prev, minimized: true } : null)}
                    onRestore={() => setGenProgress(prev => prev ? { ...prev, minimized: false } : null)}
                />
            )}

        </SubscriptionProvider>
    );
}
