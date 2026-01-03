'use client';

import React, { useState, useMemo } from 'react';
import {
    CheckCircle, Activity, Timer, TrendingUp, StickyNote,
    Bike, FootprintsIcon as Running, Waves,
    Heart, Zap, Gauge, Mountain, Flame
} from 'lucide-react';
import type {
    Workout,
    Profile,
    CompletedData,
    CompletedDataFeedback,
    SportType,
} from '@/lib/data/type';
import { Button } from '@/components/ui/Button';

// --- Types Props ---
interface FeedbackFormProps {
    workout: Workout;
    profile: Profile;
    onSave: (feedback: CompletedDataFeedback) => Promise<void>;
    onCancel: () => void;
}

// --- Configuration Sport ---
const SPORT_CONFIG: Record<SportType, {
    icon: React.ElementType;
    label: string;
    color: string;
}> = {
    cycling: { icon: Bike, label: 'Vélo', color: 'text-blue-400' },
    running: { icon: Running, label: 'Course', color: 'text-orange-400' },
    swimming: { icon: Waves, label: 'Natation', color: 'text-cyan-400' },
    other: { icon: Activity, label: 'Activité', color: 'text-purple-400' }
};

// --- Helper Type-Safe ---
function getCompletedValue<K extends keyof CompletedDataFeedback>(
    completedData: CompletedData | null,
    key: K,
    fallback: CompletedDataFeedback[K]
): CompletedDataFeedback[K] {
    if (!completedData) return fallback;

    // Mapping depuis CompletedData vers CompletedDataFeedback
    const mapping: Partial<Record<keyof CompletedDataFeedback, unknown>> = {
        rpe: completedData.perceivedEffort,
        actualDuration: completedData.actualDurationMinutes,
        distance: completedData.distanceKm,
        notes: completedData.notes,
        avgHeartRate: completedData.heartRate?.avgBPM,
        calories: completedData.caloriesBurned,

        // Cycling
        avgPower: completedData.metrics.cycling?.avgPowerWatts,
        maxPower: completedData.metrics.cycling?.maxPowerWatts,
        tss: completedData.metrics.cycling?.tss,
        avgCadence: completedData.metrics.cycling?.avgCadenceRPM,
        maxCadence: completedData.metrics.cycling?.maxCadenceRPM,
        avgSpeed: completedData.metrics.cycling?.avgSpeedKmH,
        maxSpeed: completedData.metrics.cycling?.maxSpeedKmH,
        elevation: completedData.metrics.cycling?.elevationGainMeters,

        // Running
        avgPace: completedData.metrics.running?.avgPaceMinPerKm,
        // avgSpeed: completedData.metrics.running?.avgSpeedKmH, // Conflit avec cycling
        // maxSpeed: completedData.metrics.running?.maxSpeedKmH,

        // Swimming
        strokeType: completedData.metrics.swimming?.strokeType,
        avgStrokeRate: completedData.metrics.swimming?.avgStrokeRate,
        avgSwolf: completedData.metrics.swimming?.avgSwolf
    };

    const value = mapping[key];
    return value !== undefined && value !== null ? value as CompletedDataFeedback[K] : fallback;
}

// --- Composant Principal ---
export const FeedbackForm: React.FC<FeedbackFormProps> = ({
    workout,
    profile,
    onSave,
    onCancel
}) => {
    const sportConfig = SPORT_CONFIG[workout.sportType];
    const SportIcon = sportConfig.icon;

    // --- États de Base ---
    const [rpe, setRpe] = useState<number>(
        getCompletedValue(workout.completedData, 'rpe', 6)
    );

    const [actualDuration, setActualDuration] = useState<number>(
        getCompletedValue(workout.completedData, 'actualDuration', workout.plannedData.durationMinutes)
    );

    const [distance, setDistance] = useState<number>(
        getCompletedValue(workout.completedData, 'distance', workout.plannedData.distanceKm || 0)
    );

    const [notes, setNotes] = useState<string>(
        getCompletedValue(workout.completedData, 'notes', '')
    );

    // --- États Universels ---
    const [avgHeartRate, setAvgHeartRate] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'avgHeartRate', undefined)
    );

    const [calories, setCalories] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'calories', undefined)
    );

    const [elevation, setElevation] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'elevation', undefined)
    );

    // --- États Cyclisme ---
    const [avgPower, setAvgPower] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'avgPower',
            profile.ftp ? Math.round(profile.ftp * 0.7) : undefined
        )
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [maxPower, setMaxPower] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'maxPower', undefined)
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [tss, setTss] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'tss', undefined)
    );

    const [avgCadence, setAvgCadence] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'avgCadence', undefined)
    );

    // --- États Running ---
    const [avgPace, setAvgPace] = useState<string | undefined>(
        getCompletedValue(workout.completedData, 'avgPace', undefined)
    );

    const [avgSpeed, setAvgSpeed] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'avgSpeed', undefined)
    );

    // --- États Swimming ---
    const [strokeType, setStrokeType] = useState<string | undefined>(
        getCompletedValue(workout.completedData, 'strokeType', undefined)
    );

    const [avgStrokeRate, setAvgStrokeRate] = useState<number | undefined>(
        getCompletedValue(workout.completedData, 'avgStrokeRate', undefined)
    );

    const [isSaving, setIsSaving] = useState(false);

    // --- Calcul Intensité ---
    const intensity = useMemo(() => {
        if (workout.sportType === 'cycling' && profile.ftp && avgPower) {
            return Math.round((avgPower / profile.ftp) * 100);
        }
        return null;
    }, [workout.sportType, profile.ftp, avgPower]);

    // --- Soumission ---
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const feedback: CompletedDataFeedback = {
                sportType: workout.sportType,
                rpe,
                actualDuration,
                distance,
                notes,
                avgHeartRate,
                calories,
                elevation,
                ...(workout.sportType === 'cycling' && {
                    avgPower,
                    maxPower,
                    tss,
                    avgCadence
                }),
                ...(workout.sportType === 'running' && {
                    avgPace,
                    avgSpeed
                }),
                ...(workout.sportType === 'swimming' && {
                    strokeType,
                    avgStrokeRate
                })
            };

            await onSave(feedback);
        } catch (error) {
            console.error('Erreur sauvegarde feedback:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render ---
    return (
        <div className="bg-slate-800/90 backdrop-blur-sm p-4 sm:p-5 rounded-xl border border-emerald-500/30 mt-4 animate-in fade-in slide-in-from-top-2 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-emerald-400 font-bold flex items-center text-base sm:text-lg">
                    <CheckCircle size={20} className="mr-2" />
                    Rapport de séance
                </h4>
                <div className={`flex items-center gap-2 ${sportConfig.color}`}>
                    <SportIcon size={18} />
                    <span className="text-sm font-medium">{sportConfig.label}</span>
                </div>
            </div>

            {/* Section 1: Données Obligatoires */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* RPE */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <Activity size={12} className="text-slate-500" />
                        RPE (Difficulté 1-10)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={rpe}
                        onChange={(e) => setRpe(Math.min(10, Math.max(1, parseInt(e.target.value) || 6)))}
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-mono text-lg"
                    />
                </div>

                {/* Durée */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <Timer size={12} className="text-slate-500" />
                        Durée (min)
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={actualDuration}
                        onChange={(e) => setActualDuration(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-mono text-lg"
                    />
                </div>

                {/* Distance */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <TrendingUp size={12} className="text-slate-500" />
                        Distance (km)
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={distance}
                        onChange={(e) => setDistance(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-mono text-lg"
                    />
                </div>

                {/* FC Moy */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <Heart size={12} className="text-red-400" />
                        FC Moy (bpm)
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={avgHeartRate || ''}
                        onChange={(e) => setAvgHeartRate(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Optionnel"
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all font-mono text-lg placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* Section 2: Métriques Sport Spécifiques */}
            {workout.sportType === 'cycling' && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-4">
                    <h5 className="text-blue-400 font-semibold text-sm mb-3 flex items-center gap-2">
                        <Bike size={16} /> Métriques Vélo
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                <Zap size={12} className="text-yellow-400" />
                                Puissance Moy (W)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    value={avgPower || ''}
                                    onChange={(e) => setAvgPower(e.target.value ? parseInt(e.target.value) : undefined)}
                                    className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-yellow-500/50 outline-none font-mono"
                                />
                                {intensity && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-yellow-400 font-bold">
                                        {intensity}% FTP
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                <Gauge size={12} /> Cadence Moy (rpm)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={avgCadence || ''}
                                onChange={(e) => setAvgCadence(e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none font-mono"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                <Mountain size={12} className="text-green-400" />
                                D+ (m)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={elevation || ''}
                                onChange={(e) => setElevation(e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-green-500/50 outline-none font-mono"
                            />
                        </div>
                    </div>
                </div>
            )}

            {workout.sportType === 'running' && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4 mb-4">
                    <h5 className="text-orange-400 font-semibold text-sm mb-3 flex items-center gap-2">
                        <Running size={16} /> Métriques Course
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                Allure Moy (min/km)
                            </label>
                            <input
                                type="text"
                                value={avgPace || ''}
                                onChange={(e) => setAvgPace(e.target.value || undefined)}
                                placeholder="5:30"
                                className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none font-mono"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                Vitesse Moy (km/h)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={avgSpeed || ''}
                                onChange={(e) => setAvgSpeed(e.target.value ? parseFloat(e.target.value) : undefined)}
                                className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none font-mono"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                <Mountain size={12} className="text-green-400" />
                                D+ (m)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={elevation || ''}
                                onChange={(e) => setElevation(e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-green-500/50 outline-none font-mono"
                            />
                        </div>
                    </div>
                </div>
            )}

            {workout.sportType === 'swimming' && (
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4 mb-4">
                    <h5 className="text-cyan-400 font-semibold text-sm mb-3 flex items-center gap-2">
                        <Waves size={16} /> Métriques Natation
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                Type de nage
                            </label>
                            <select
                                value={strokeType || ''}
                                onChange={(e) => setStrokeType(e.target.value || undefined)}
                                className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                            >
                                <option value="">Mixte</option>
                                <option value="freestyle">Crawl</option>
                                <option value="backstroke">Dos</option>
                                <option value="breaststroke">Brasse</option>
                                <option value="butterfly">Papillon</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                Fréq. Bras (coups/min)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={avgStrokeRate || ''}
                                onChange={(e) => setAvgStrokeRate(e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none font-mono"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Section 3: Calories (Universel) */}
            <div className="mb-4">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                    <Flame size={12} className="text-orange-400" />
                    Calories Brûlées
                </label>
                <input
                    type="number"
                    min="0"
                    value={calories || ''}
                    onChange={(e) => setCalories(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Optionnel"
                    className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none font-mono placeholder:text-slate-600"
                />
            </div>

            {/* Section 4: Notes */}
            <div className="mb-5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                    <StickyNote size={12} className="text-slate-500" />
                    Sensations / Notes
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaires sur la forme, la météo, les sensations..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm h-24 resize-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none placeholder:text-slate-600"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="flex-1 h-11 sm:h-10 text-sm border border-slate-700 hover:bg-slate-800"
                    disabled={isSaving}
                >
                    Annuler
                </Button>
                <Button
                    variant="success"
                    className="flex-1 h-11 sm:h-10 text-sm font-semibold shadow-lg shadow-emerald-900/20 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? "Enregistrement..." : "Valider la séance"}
                </Button>
            </div>
        </div>
    );
};
