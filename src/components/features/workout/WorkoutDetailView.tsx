'use client';

import React, { useState, useMemo } from 'react';
import {
    Activity, Clock, Zap, Mountain,
    ChevronLeft, CheckCircle, XCircle,
    CalendarDays, Edit, Trash2, RefreshCw,
    AlertTriangle, Send, X, MapPin,
    Bike, FootprintsIcon as Running, Waves, Heart,
    Timer, Gauge, TrendingUp
} from 'lucide-react';
import type { SportType, CompletedDataFeedback } from '@/lib/data/type';
import type { Workout } from '@/lib/data/DatabaseTypes';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FeatureGate } from '@/components/features/billing/FeatureGate';
import { formatDate } from '@/lib/utils';
import { FeedbackForm } from './FeedbackForm';
import { Profile } from '@/lib/data/DatabaseTypes';

// --- Types ---
interface WorkoutDetailViewProps {
    workout: Workout;
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
    bgLight: string;
    label: string;
}> = {
    cycling:  { icon: Bike,     color: 'text-blue-600 dark:text-blue-400',    bgLight: 'bg-blue-50 dark:bg-blue-500/10',    label: 'Vélo' },
    running:  { icon: Running,  color: 'text-orange-600 dark:text-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-500/10', label: 'Course' },
    swimming: { icon: Waves,    color: 'text-cyan-600 dark:text-cyan-400',    bgLight: 'bg-cyan-50 dark:bg-cyan-500/10',    label: 'Natation' },
    other:    { icon: Mountain, color: 'text-emerald-600 dark:text-emerald-400', bgLight: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Autre' },
};

// --- Helpers ---
function fmtDuration(minutes: number | undefined | null): string {
    if (!minutes) return '-';
    if (minutes >= 60) {
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return `${h}h${String(m).padStart(2, '0')}`;
    }
    return `${Math.round(minutes)} min`;
}

function fmtDurationSec(totalSeconds: number | undefined): string {
    if (!totalSeconds) return '-';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// Metric tile data
interface MetricTile {
    label: string;
    value: string;
    icon: React.ElementType;
    accent?: string;
}

function getCompletedMetrics(workout: Workout): MetricTile[] {
    const cd = workout.completedData;
    if (!cd) return [];
    const tiles: MetricTile[] = [];
    const sport = workout.sportType;

    // Duration
    if (cd.actualDurationMinutes) {
        tiles.push({ label: 'Durée', value: fmtDurationSec(cd.actualDurationMinutes * 60), icon: Timer });
    }
    // Distance
    if (cd.distanceKm && cd.distanceKm > 0) {
        tiles.push({ label: 'Distance', value: `${cd.distanceKm.toFixed(1)} km`, icon: MapPin });
    }
    // TSS (cycling)
    if (cd.metrics?.cycling?.tss) {
        tiles.push({ label: 'TSS', value: `${Math.round(cd.metrics.cycling.tss)}`, icon: Zap, accent: 'text-amber-600 dark:text-amber-400' });
    }
    // Avg HR
    if (cd.heartRate?.avgBPM) {
        const maxStr = cd.heartRate.maxBPM ? ` / ${cd.heartRate.maxBPM}` : '';
        tiles.push({ label: 'FC Moy / Max', value: `${cd.heartRate.avgBPM}${maxStr} bpm`, icon: Heart, accent: 'text-rose-600 dark:text-rose-400' });
    }
    // Power (cycling)
    if (sport === 'cycling' && cd.metrics?.cycling) {
        const c = cd.metrics.cycling;
        if (c.avgPowerWatts) tiles.push({ label: 'Puissance', value: `${c.avgPowerWatts} W`, icon: Gauge });
        if (c.normalizedPowerWatts) tiles.push({ label: 'NP', value: `${c.normalizedPowerWatts} W`, icon: TrendingUp });
    }
    // Pace (running)
    if (sport === 'running' && cd.metrics?.running) {
        const r = cd.metrics.running;
        if (r.avgPaceMinPerKm) tiles.push({ label: 'Allure Moy.', value: `${r.avgPaceMinPerKm} min/km`, icon: Gauge });
        if (r.elevationGainMeters) tiles.push({ label: 'D+', value: `${r.elevationGainMeters} m`, icon: Mountain });
    }
    // Pace (swimming)
    if (sport === 'swimming' && cd.metrics?.swimming) {
        const s = cd.metrics.swimming;
        if (s.avgPace100m) tiles.push({ label: 'Allure', value: `${s.avgPace100m} /100m`, icon: Gauge });
    }
    // Calories
    if (cd.caloriesBurned) {
        tiles.push({ label: 'Calories', value: `${cd.caloriesBurned} kcal`, icon: Activity });
    }
    // RPE
    if (cd.perceivedEffort != null) {
        tiles.push({ label: 'RPE', value: `${cd.perceivedEffort.toFixed(1)} / 10`, icon: Heart, accent: cd.perceivedEffort >= 8.5 ? 'text-red-600 dark:text-red-400' : cd.perceivedEffort >= 7 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400' });
    }
    return tiles;
}

// --- Composant Principal ---
export const WorkoutDetailView: React.FC<WorkoutDetailViewProps> = ({
    workout,
    profile,
    onClose,
    onUpdate,
    onMoveWorkout,
    onDelete,
    onRegenerate,
}) => {
    const [isCompleting, setIsCompleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [showRegenInput, setShowRegenInput] = useState(false);
    const [regenInstruction, setRegenInstruction] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [newMoveDate, setNewMoveDate] = useState('');
    const [isMutating, setIsMutating] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const sportConfig = SPORT_CONFIG[workout.sportType] ?? SPORT_CONFIG.other;
    const SportIcon = sportConfig.icon;
    const isCompleted = workout.status === 'completed';
    const isMissed = workout.status === 'missed';
    const isPending = !isCompleted && !isMissed;
    const planned = workout.plannedData;
    const description = planned?.description;

    const completedMetrics = useMemo(() => getCompletedMetrics(workout), [workout]);

    // --- Handlers ---
    const handleMove = async () => {
        if (!newMoveDate) return;
        setIsMutating(true);
        try {
            await onMoveWorkout(workout.date, newMoveDate);
            onClose();
        } catch (e) { console.error(e); }
        finally { setIsMutating(false); }
    };

    const handleRegenerateClick = async () => {
        if (!regenInstruction.trim()) { setShowRegenInput(false); return; }
        setIsMutating(true); setIsRegenerating(true);
        try {
            await onRegenerate(workout.date, regenInstruction);
            setShowRegenInput(false); setRegenInstruction('');
        } catch (e) { console.error(e); }
        finally { setIsMutating(false); setIsRegenerating(false); }
    };

    const handleDeleteClick = async () => {
        setIsMutating(true);
        try { await onDelete(workout.id); }
        catch (e) { console.error(e); setIsMutating(false); }
    };

    const handleStatusUpdate = async (status: 'pending' | 'completed' | 'missed', feedback?: CompletedDataFeedback) => {
        setIsMutating(true);
        try {
            await onUpdate(workout.date, status, feedback);
            setIsCompleting(false); setIsEditing(false);
            if (status === 'pending' && isCompleted) onClose();
        } catch (e) { console.error(e); }
        finally { setIsMutating(false); }
    };

    // --- Render ---
    return (
        <div className="w-full max-w-2xl mx-auto py-4 md:py-8 animate-in fade-in duration-300 pb-24 md:pb-8">

            {/* Retour */}
            <button onClick={onClose} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white mb-5 transition-colors">
                <ChevronLeft size={18} /> Retour
            </button>

            {/* ═══ HEADER ═══ */}
            <div className="mb-6">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sportConfig.color} ${sportConfig.bgLight}`}>
                        <SportIcon size={13} />
                        {sportConfig.label}
                    </span>
                    {workout.workoutType && <Badge type={workout.workoutType} />}
                    {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle size={10} /> Fait
                        </span>
                    )}
                    {isMissed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                            <XCircle size={10} /> Raté
                        </span>
                    )}
                </div>

                {/* Titre */}
                <h1 className={`text-2xl md:text-3xl font-bold leading-tight mb-1.5 ${isMissed ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                    {workout.title}
                </h1>

                {/* Date */}
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                    <CalendarDays size={14} />
                    {formatDate(workout.date)}
                </p>
            </div>

            {/* ═══ PLANNED METRICS BAR (pending only) ═══ */}
            {isPending && planned && (
                <div className="flex items-center gap-4 px-4 py-3 mb-6 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/50 shadow-sm">
                    {planned.durationMinutes && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <Clock size={14} className="text-slate-400" />
                            <span className="font-semibold">{fmtDuration(planned.durationMinutes)}</span>
                        </div>
                    )}
                    {planned.plannedTSS != null && planned.plannedTSS > 0 && (
                        <>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                                <Zap size={14} className="text-amber-500" />
                                <span className="font-semibold">{planned.plannedTSS} TSS</span>
                            </div>
                        </>
                    )}
                    {planned.distanceKm != null && planned.distanceKm > 0 && (
                        <>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                                <MapPin size={14} className="text-slate-400" />
                                <span className="font-semibold">{planned.distanceKm} km</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ═══ COMPLETED METRICS GRID ═══ */}
            {isCompleted && completedMetrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {completedMetrics.map((tile, i) => {
                        const TileIcon = tile.icon;
                        return (
                            <div key={i} className="flex flex-col gap-1 p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/50 shadow-sm">
                                <div className="flex items-center gap-1.5">
                                    <TileIcon size={12} className={tile.accent || 'text-slate-400 dark:text-slate-500'} />
                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{tile.label}</span>
                                </div>
                                <p className="text-base font-bold font-mono text-slate-900 dark:text-white">{tile.value}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ NOTES (completed) ═══ */}
            {isCompleted && workout.completedData?.notes && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40">
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">{workout.completedData.notes}</p>
                </div>
            )}

            {/* ═══ DESCRIPTION (planned) ═══ */}
            {description && (
                <div className="mb-6 p-4 md:p-5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Activity size={15} className={sportConfig.color} />
                        Structure de la séance
                    </h3>
                    <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                        {description}
                    </div>
                </div>
            )}

            {/* ═══ ACTIONS BAR ═══ */}
            {workout.workoutType !== 'Rest' && !isCompleting && !isEditing && (
                <div className="mb-6">
                    {/* Regen input (expanded) */}
                    {showRegenInput ? (
                        <div className="flex items-center gap-2 animate-in fade-in duration-200">
                            <input
                                type="text"
                                placeholder="Ex: Plus court, focus endurance..."
                                className="flex-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-500/50 rounded-lg text-sm px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={regenInstruction}
                                onChange={(e) => setRegenInstruction(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleRegenerateClick()}
                            />
                            <button onClick={() => { setShowRegenInput(false); setRegenInstruction(''); }} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" disabled={isMutating}>
                                <X size={18} />
                            </button>
                            <Button variant="primary" onClick={handleRegenerateClick} disabled={isMutating || !regenInstruction.trim()} className="shrink-0">
                                {isRegenerating ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {/* Move */}
                            <button
                                onClick={() => setIsMoving(!isMoving)}
                                disabled={isMutating}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                            >
                                <CalendarDays size={14} /> Déplacer
                            </button>

                            {/* Regenerate (pending only) */}
                            {isPending && (
                                <FeatureGate feature="regenerate-workout" mode="modal" label="Régénérer avec l'IA">
                                    <button
                                        onClick={() => setShowRegenInput(true)}
                                        disabled={isMutating}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                                    >
                                        <RefreshCw size={14} /> Régénérer IA
                                    </button>
                                </FeatureGate>
                            )}

                            <div className="flex-1" />

                            {/* Delete */}
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isMutating}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                title="Supprimer"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Move panel */}
            {isMoving && (
                <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-blue-200 dark:border-blue-500/30 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">Nouvelle date</p>
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            style={{ colorScheme: 'auto' }}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={(e) => setNewMoveDate(e.target.value)}
                            defaultValue={workout.date}
                        />
                        <button onClick={() => setIsMoving(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" disabled={isMutating}>Annuler</button>
                        <Button variant="primary" disabled={isMutating || !newMoveDate} onClick={handleMove} className="h-9 text-sm">Confirmer</Button>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {showDeleteConfirm && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-red-500" />
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">Supprimer cette séance ?</p>
                    </div>
                    <p className="text-xs text-red-600/70 dark:text-red-300/60 mb-3">Cette action est irréversible.</p>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg" disabled={isMutating}>Annuler</button>
                        <button
                            onClick={handleDeleteClick}
                            disabled={isMutating}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                            <Trash2 size={12} /> {isMutating ? '...' : 'Supprimer'}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ FEEDBACK FORM ═══ */}
            {(isCompleting || isEditing) ? (
                <FeedbackForm
                    workout={workout}
                    profile={profile}
                    onSave={async (feedback) => { await handleStatusUpdate('completed', feedback); }}
                    onCancel={() => { setIsCompleting(false); setIsEditing(false); }}
                />
            ) : (
                /* ═══ PRIMARY ACTIONS ═══ */
                <div className="flex flex-col gap-2.5 pt-5 border-t border-slate-200/80 dark:border-slate-800">
                    {/* Pending → Mark done */}
                    {isPending && !showDeleteConfirm && (
                        <Button
                            variant="success"
                            onClick={() => setIsCompleting(true)}
                            className="w-full h-12 text-base font-semibold shadow-md shadow-emerald-500/10"
                            disabled={isMutating}
                            icon={CheckCircle}
                        >
                            Marquer comme fait
                        </Button>
                    )}

                    {/* Pending → Mark missed */}
                    {isPending && !showDeleteConfirm && (
                        <button
                            onClick={() => handleStatusUpdate('missed')}
                            disabled={isMutating}
                            className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                        >
                            <XCircle size={16} /> Marquer comme raté
                        </button>
                    )}

                    {/* Completed → Edit / Reset */}
                    {isCompleted && !showDeleteConfirm && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditing(true)}
                                disabled={isMutating}
                                className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                            >
                                <Edit size={14} /> Modifier feedback
                            </button>
                            <button
                                onClick={() => handleStatusUpdate('pending')}
                                disabled={isMutating}
                                className="h-10 px-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
