'use client';

import React, { useState, useMemo } from 'react'; // Ajout de useMemo
import {
    Activity, Clock, Zap, Home, Mountain,
    ChevronLeft, CheckCircle, XCircle,
    CalendarDays, Edit, Trash2, RefreshCw,
    AlertTriangle, Send, X,
    Bike, FootprintsIcon as Running, Waves, Heart,
    Timer // Ajout pour la durée
} from 'lucide-react';
import type { Workoutold, SportType, CompletedDataFeedback } from '@/lib/data/type';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import { FeedbackForm } from './FeedbackForm';
import { Profile } from '@/lib/data/DatabaseTypes';

// --- Types ---
interface WorkoutDetailViewProps {
    workout: Workoutold;
    profile: Profile;
    onClose: () => void;
    onUpdate: (
        dateKey: string,
        status: 'pending' | 'completed' | 'missed',
        feedback?: CompletedDataFeedback
    ) => Promise<void>;
    onToggleMode: (dateKey: string) => Promise<void>;
    onMoveWorkout: (originalDateStr: string, newDateStr: string) => Promise<void>;
    onDelete: (dateKey: string) => Promise<void>;
    onRegenerate: (dateKey: string, instruction?: string) => Promise<void>;
}

// --- Configuration Sport ---
const SPORT_CONFIG: Record<SportType, {
    icon: React.ElementType;
    color: string;
    label: string;
    unit: string;
}> = {
    cycling: {
        icon: Bike,
        color: 'text-blue-400',
        label: 'Vélo',
        unit: 'W'
    },
    running: {
        icon: Running,
        color: 'text-orange-400',
        label: 'Course',
        unit: 'min/km'
    },
    swimming: {
        icon: Waves,
        color: 'text-cyan-400',
        label: 'Natation',
        unit: 'min/100m'
    }
};

// --- Helpers ---

// Fonction pour formater la durée en HH:MM:SS ou MM:SS
const formatDuration = (totalSeconds: number | undefined): string => {
    if (totalSeconds === undefined || totalSeconds === null) return '-';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Helper pour extraire les métriques communes et spécifiques
const getSportMetrics = (workout: Workoutold) => {
    if (!workout.completedData) return null;

    const { sportType, completedData } = workout;
    const metrics = completedData.metrics;

    const baseMetrics = {
        distance: completedData.distanceKm !== undefined && completedData.distanceKm > 0
            ? `${completedData.distanceKm.toFixed(2)} km`
            : null,
        duration: formatDuration(completedData.actualDurationMinutes * 60),
        calories: completedData.caloriesBurned !== undefined ? `${completedData.caloriesBurned} kcal` : null,
        heartRate: completedData.heartRate?.avgBPM ? {
            avg: `${completedData.heartRate.avgBPM} bpm`,
            max: completedData.heartRate.maxBPM ? `/${completedData.heartRate.maxBPM} bpm` : ''
        } : null,
        rpe: completedData.perceivedEffort !== null && completedData.perceivedEffort !== undefined
            ? completedData.perceivedEffort
            : null,
    };

    let sportSpecificMetrics = null;

    switch (sportType) {
        case 'cycling':
            sportSpecificMetrics = metrics.cycling ? {
                primary: metrics.cycling.avgPowerWatts !== undefined ? `${metrics.cycling.avgPowerWatts} W` : '-',
                secondary: metrics.cycling.tss !== undefined ? `TSS: ${metrics.cycling.tss}` : 'TSS: -',
                tertiary: metrics.cycling.normalizedPowerWatts !== undefined ? `NP: ${metrics.cycling.normalizedPowerWatts} W` : null,
                // Ajout Power Curve si disponible
                // powerCurve: metrics.cycling.?.map((p) => `${p.power} W @ ${p.duration}s`)
            } : null;
            break;

        case 'running':
            sportSpecificMetrics = metrics.running ? {
                primary: metrics.running.avgPaceMinPerKm !== undefined ? `${metrics.running.avgPaceMinPerKm} min/km` : '-',
                secondary: metrics.running.elevationGainMeters !== undefined ? `D+: ${metrics.running.elevationGainMeters} m` : null,
                tertiary: metrics.running.bestPaceMinPerKm !== undefined ? `Vmax: ${metrics.running.bestPaceMinPerKm} min/km` : null,
            } : null;
            break;

        case 'swimming':
            sportSpecificMetrics = metrics.swimming ? {
                primary: metrics.swimming.avgPace100m !== undefined ? `${metrics.swimming.avgPace100m} min/100m` : '-',
                secondary: metrics.swimming.strokeType ? `Style: ${metrics.swimming.strokeType}` : null,
                tertiary: metrics.swimming.bestPace100m !== undefined ? `Vmax: ${metrics.swimming.bestPace100m} min/100m` : null,
            } : null;
            break;
        default:
            // Pour 'other' ou types non gérés spécifiquement
            break;
    }

    return {
        ...baseMetrics,
        ...sportSpecificMetrics,
    };
};

// Composant Carte pour les stats Strava
const StatsCard: React.FC<{
    title: string;
    icon: React.ElementType;
    color: string;
    data: { label: string; value: string | null | undefined; icon?: React.ElementType }[];
    note?: string;
    rpe?: number | null;
    rpeColor?: string;
}> = ({ title, icon: Icon, color, data, note, rpe, rpeColor }) => {
    return (
        <div className={`relative overflow-hidden rounded-xl p-4 sm:p-5 shadow-lg border ${color.replace('text-', 'border-')}/30 bg-linear-to-br from-slate-800/70 via-slate-900/90 to-slate-800/70`}>
            <div className={`absolute -top-2 -right-2 w-24 h-24 rounded-full opacity-20 ${color} blur-lg`}></div>
            <div className={`absolute -bottom-4 -left-4 w-32 h-32 rounded-full opacity-15 ${color} blur-xl`}></div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center mb-3 sm:mb-4">
                    <Icon size={20} className={`mr-2 ${color}`} />
                    <h3 className={`text-lg sm:text-xl font-bold ${color}`}>{title}</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-4 grow">
                    {data.map((item, index) => (
                        <div key={index} className="flex flex-col items-start col-span-1">
                            <div className="flex items-center text-xs sm:text-sm text-slate-400 font-medium mb-1">
                                {item.icon && <item.icon size={14} className="mr-1" />}
                                {item.label}
                            </div>
                            <div className={`text-sm sm:text-base font-bold font-mono ${item.value ? 'text-white' : 'text-slate-500'}`}>
                                {item.value ?? '-'}
                            </div>
                        </div>
                    ))}
                </div>

                {(rpe !== null && rpe !== undefined) && (
                     <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center text-slate-400">
                            <Heart size={16} className={`mr-1.5 ${rpeColor || 'text-red-400'}`} />
                            RPE
                        </div>
                        <span className={`font-bold ${rpeColor || 'text-red-400'}`}>{rpe.toFixed(1)}</span>
                    </div>
                )}

                {note && (
                    <p className="mt-3 text-xs sm:text-sm text-slate-500 italic">{note}</p>
                )}
            </div>
        </div>
    );
};


// --- Composant Principal ---
export const WorkoutDetailView: React.FC<WorkoutDetailViewProps> = ({
    workout,
    profile,
    onClose,
    onUpdate,
    onToggleMode,
    onMoveWorkout,
    onDelete,
    onRegenerate
}) => {
    // --- États ---
    const [isCompleting, setIsCompleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [showRegenInput, setShowRegenInput] = useState(false);
    const [regenInstruction, setRegenInstruction] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [newMoveDate, setNewMoveDate] = useState('');
    const [isMutating, setIsMutating] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);

    // --- Helpers Locaux ---
    // Utilisation de `other` si sportType n'est pas dans le config
    const sportConfig = SPORT_CONFIG[workout.sportType];
    const SportIcon = sportConfig.icon;

    const currentDescription = workout.mode === 'Outdoor'
        ? workout.plannedData?.descriptionOutdoor
        : workout.plannedData?.descriptionIndoor;

    const ModeIcon = workout.mode === 'Outdoor' ? Mountain : Home;

    // Utilisation de useMemo pour éviter les recalculs inutiles
    const sportMetrics = useMemo(() => getSportMetrics(workout), [workout]);

    // --- Handlers ---
    // ... (les handlers restent les mêmes, sauf ajustements si nécessaire) ...
    const handleToggle = async () => {
        setIsMutating(true);
        try {
            await onToggleMode(workout.date);
        } catch (e) {
            console.error("Erreur bascule de mode:", e);
            // Gérer l'erreur pour l'utilisateur si besoin
        } finally {
            setIsMutating(false);
        }
    };

    const handleMove = async () => {
        if (!newMoveDate) {
            // Afficher un message d'erreur si aucune date n'est sélectionnée
            alert("Veuillez sélectionner une nouvelle date.");
            return;
        }
        setIsMutating(true);
        try {
            await onMoveWorkout(workout.date, newMoveDate);
            onClose(); // Fermer la vue après succès
        } catch (e) {
            console.error("Erreur de déplacement:", e);
            // Gérer l'erreur pour l'utilisateur
        } finally {
            setIsMutating(false);
        }
    };

    const handleRegenerateClick = async () => {
        if (!regenInstruction.trim()) {
             // Ne pas régénérer si l'instruction est vide
             setShowRegenInput(false);
             return;
        }
        setIsMutating(true);
        setIsRegenerating(true);
        try {
            await onRegenerate(workout.date, regenInstruction);
            setShowRegenInput(false);
            setRegenInstruction('');
        } catch (e) {
            console.error("Erreur régénération:", e);
             // Gérer l'erreur pour l'utilisateur
        } finally {
            setIsMutating(false);
            setIsRegenerating(false);
        }
    };

    const handleDeleteClick = async () => {
        setIsMutating(true);
        try {
            await onDelete(workout.date);
             // Pas besoin de fermer ici, le parent s'en chargera peut-être
        } catch (e) {
            console.error("Erreur suppression:", e);
            // Gérer l'erreur pour l'utilisateur
            setIsMutating(false); // Important pour réactiver les boutons
        }
    };

    const handleStatusUpdate = async (
        status: 'pending' | 'completed' | 'missed',
        feedback?: CompletedDataFeedback
    ) => {
        setIsMutating(true);
        try {
            await onUpdate(workout.date, status, feedback);
            setIsCompleting(false);
            setIsEditing(false);
            // Si le statut devient 'pending' après 'completed', on peut peut-être fermer la vue
            if (status === 'pending' && workout.status === 'completed') {
                onClose();
            }
        } catch (e) {
            console.error("Erreur de mise à jour:", e);
             // Gérer l'erreur pour l'utilisateur
        } finally {
            setIsMutating(false);
        }
    };

    // --- Calcul RPE Color Dynamiquement ---
    const rpeColor = useMemo(() => {
        if (sportMetrics?.rpe === null || sportMetrics?.rpe === undefined) return 'text-slate-400';
        // Exemple: < 7 Vert, 7-8 Orange, > 8 Rouge
        if (sportMetrics.rpe < 7) return 'text-emerald-400';
        if (sportMetrics.rpe < 8.5) return 'text-orange-400';
        return 'text-red-400';
    }, [sportMetrics?.rpe]);


    // --- Render ---
    return (
        <div className="w-full max-w-3xl mx-auto py-4 md:py-8 animate-in zoom-in-95 duration-300 pb-24 md:pb-8">
            {/* Bouton Retour */}
            <button
                onClick={onClose}
                className="flex items-center text-slate-400 hover:text-white mb-4 md:mb-6 transition-colors px-1"
                aria-label="Retour au calendrier"
            >
                <ChevronLeft size={20} className="mr-1" /> Retour
            </button>

            <Card className="relative overflow-hidden">
                {/* Header: Titre, Dates, Badges */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4 pb-4 border-b border-slate-800">
                    <div className="w-full">
                        {/* Badges Sport & Type */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${sportConfig.color} text-xs md:text-sm font-semibold bg-white/5`}>
                                <SportIcon size={14} />
                                <span>{sportConfig.label}</span>
                            </div>
                            <Badge type={workout.workoutType} />
                            {workout.status === 'completed' && <Badge type="completed" />}
                        </div>

                        {/* Titre */}
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">
                            {workout.title}
                        </h1>
                        {/* Dates */}
                        <p className="text-slate-400 text-sm flex items-center gap-2">
                            <CalendarDays size={14} className="text-slate-500" />
                            <span className="font-mono">{formatDate(workout.date)}</span>
                            {workout.status === 'completed' && workout.date && (
                                <span className="text-xs text-slate-500 ml-2">
                                    ({formatDate(workout.date)})
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Métriques Planifiées (si pas complété) */}
                    {workout.status !== 'completed' && workout.plannedData && (
                        <div className="flex items-center gap-3 text-slate-400 bg-slate-800/50 rounded-full px-3 py-1 text-xs md:text-sm shrink-0">
                            <span className="flex items-center">
                                <Clock size={12} className="mr-1.5" />
                                {workout.plannedData.durationMinutes} min
                            </span>
                            <div className="w-px h-3 bg-slate-600"></div>
                            <span className="flex items-center">
                                <Zap size={12} className="mr-1.5" />
                                TSS: {workout.plannedData.plannedTSS || '-'}
                            </span>
                        </div>
                    )}
                </div>

                {/* === CARTE DES STATISTIQUES COMPLÉTÉES === */}
                {workout.status === 'completed' && sportMetrics && (
                    <StatsCard
                        title={sportConfig.label}
                        icon={sportConfig.icon}
                        color={sportConfig.color}
                        rpe={sportMetrics.rpe}
                        rpeColor={rpeColor}
                        data={[
                            { label: 'Durée', value: sportMetrics.duration, icon: Timer },
                            { label: 'Distance', value: sportMetrics.distance },
                            { label: 'Calories', value: sportMetrics.calories },
                            { label: 'FC Moyenne', value: sportMetrics.heartRate?.avg, icon: Heart },
                            // Métriques spécifiques sport
                            ...(sportMetrics.primary ? [{ label: 'Principal', value: sportMetrics.primary }] : []),
                            ...(sportMetrics.secondary ? [{ label: 'Secondaire', value: sportMetrics.secondary }] : []),
                            ...(sportMetrics.tertiary ? [{ label: 'Tertiaire', value: sportMetrics.tertiary }] : []),
                            // ...(sportMetrics.primary ? [{ label: 'Puissance NP', value: sportMetrics. }] : []), // Exemple pour vélo si NP est séparé
                        ].filter(item => item.value !== null && item.value !== undefined && item.value !== '-') // Filtrer les valeurs vides ou nulles
                        }
                        note={workout.completedData?.notes}
                    />
                )}

                {/* Barre d'actions secondaire */}
                {workout.workoutType !== 'Rest' && (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center my-6 border-b border-slate-800 pb-6 gap-4">
                        <div className="w-full md:w-auto">
                            {showRegenInput ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 w-full md:w-auto">
                                    <input
                                        type="text"
                                        placeholder={`Ex: Plus court, focus endurance...`}
                                        className="flex-1 md:w-64 bg-slate-900 border border-blue-500/50 rounded-lg text-sm px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={regenInstruction}
                                        onChange={(e) => setRegenInstruction(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleRegenerateClick()}
                                        aria-label="Instruction de régénération"
                                    />
                                    <Button
                                        variant="ghost"
                                        onClick={() => { setShowRegenInput(false); setRegenInstruction(''); }}
                                        disabled={isMutating}
                                        className="shrink-0"
                                        aria-label="Annuler"
                                    >
                                        <X size={18} />
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={handleRegenerateClick}
                                        disabled={isMutating || !regenInstruction.trim()}
                                        className="shrink-0 bg-blue-600 hover:bg-blue-500"
                                        aria-label="Envoyer"
                                    >
                                        {isRegenerating ? (
                                            <RefreshCw size={18} className="animate-spin" />
                                        ) : (
                                            <Send size={18} />
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar w-full">
                                    {/* Bouton Toggle Mode */}
                                    <Button
                                        variant="secondary"
                                        className="whitespace-nowrap h-9 text-xs"
                                        onClick={handleToggle}
                                        icon={ModeIcon}
                                        disabled={isMutating}
                                    >
                                        {workout.mode === 'Outdoor' ? 'Extérieur' : 'Home Tr.'}
                                    </Button>
                                    {/* Bouton Déplacer */}
                                    <Button
                                        variant="secondary"
                                        className="whitespace-nowrap h-9 text-xs"
                                        onClick={() => setIsMoving(!isMoving)}
                                        icon={CalendarDays}
                                        disabled={isMutating}
                                    >
                                        Déplacer
                                    </Button>
                                    {/* Bouton Régénérer */}
                                    {workout.status === 'pending' && (
                                        <Button
                                            variant="ghost"
                                            className="whitespace-nowrap h-9 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                            onClick={() => setShowRegenInput(true)}
                                            disabled={isMutating}
                                        >
                                            <RefreshCw size={14} className="mr-1.5" />
                                            Régénérer l&apos;IA
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Boutons secondaires pour les actions urgentes */}
                        <div className="flex gap-2 shrink-0">
                             <Button
                                variant="ghost"
                                className="px-3 text-slate-500 hover:text-red-400"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isMutating}
                                aria-label="Supprimer la séance"
                                icon={Trash2}
                                // iconOnly // Pour n'afficher que l'icône
                            >Supprimer</Button>
                            
                        </div>
                    </div>
                )}

                {/* Modal de déplacement INLINE */}
                {isMoving && (
                    <div className="mb-6 bg-slate-900/80 border border-blue-500/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center">
                            <CalendarDays size={16} className="mr-2 text-blue-400" />
                            Choisir une nouvelle date
                        </h4>
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-blue-500"
                                onChange={(e) => setNewMoveDate(e.target.value)}
                                aria-label="Nouvelle date"
                                defaultValue={workout.date} // Pré-remplir avec la date actuelle
                            />
                            <Button
                                variant="ghost"
                                onClick={() => setIsMoving(false)}
                                disabled={isMutating}
                                className="h-9"
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="primary"
                                disabled={isMutating || !newMoveDate}
                                onClick={handleMove}
                                className="h-9"
                            >
                                Confirmer
                            </Button>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmation Suppression INLINE */}
                {showDeleteConfirm && (
                    <div className="mb-6 bg-red-900/10 border border-red-500/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center">
                            <AlertTriangle size={16} className="mr-2" />
                            Supprimer cette séance ?
                        </h4>
                        <p className="text-xs text-red-300/70 mb-4">
                            Cette action est irréversible et supprimera les données associées.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="secondary"
                                className="h-8 text-xs"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isMutating}
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="danger"
                                className="h-8 text-xs bg-red-600 hover:bg-red-500 text-white border-0"
                                onClick={handleDeleteClick}
                                disabled={isMutating}
                                icon={Trash2}
                            >
                                {isMutating ? "..." : "Supprimer"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Description de la séance (si applicable) */}
                {currentDescription && (
                    <div className="bg-slate-900/50 rounded-xl p-4 md:p-6 mb-8 border border-slate-800">
                        <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center">
                            <Activity size={18} className="mr-2 text-blue-400" />
                            Structure de la séance
                        </h3>
                        <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                            {currentDescription}
                        </div>
                    </div>
                )}

                {/* Zone Feedback / Formulaire */}
                {isCompleting || isEditing ? (
                    <FeedbackForm
                        workout={workout}
                        profile={profile}
                        onSave={async (feedback) => {
                            await handleStatusUpdate('completed', feedback);
                        }}
                        onCancel={() => {
                            setIsCompleting(false);
                            setIsEditing(false);
                        }}
                    />
                ) : (
                    /* Actions Principales (Bas du Card) */
                    <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-800">
                        {workout.status !== 'completed' && !showDeleteConfirm && (
                            <Button
                                variant="success"
                                onClick={() => setIsCompleting(true)}
                                className="w-full h-12 md:h-10 text-base font-semibold shadow-lg shadow-emerald-900/20"
                                disabled={isMutating}
                                icon={CheckCircle}
                            >
                                Marquer comme fait
                            </Button>
                        )}

                        {workout.status === 'completed' && !showDeleteConfirm && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => handleStatusUpdate('pending')}
                                    disabled={isMutating}
                                    icon={RefreshCw}
                                >
                                    Réinitialiser
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsEditing(true)}
                                    disabled={isMutating}
                                    icon={Edit}
                                >
                                    Modifier le feedback
                                </Button>
                            </>
                        )}
                        {/* Bouton pour 'raté' si pas encore marqué et pas en cours d'édition */}
                        {workout.status !== 'missed' && workout.status !== 'completed' && !isCompleting && !isEditing && !showDeleteConfirm && (
                             <Button
                                variant="danger"
                                onClick={() => handleStatusUpdate('missed')}
                                className="h-10 text-sm font-medium bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-900/50"
                                disabled={isMutating}
                                icon={XCircle}
                            >
                                Marquer comme raté
                            </Button>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};
