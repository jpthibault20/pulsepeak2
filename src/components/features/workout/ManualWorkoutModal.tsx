import { Card, Button } from "@/components/ui";
import type { Workout, SportType, CompletedData } from "@/lib/data/type";
import {
    Plus, Calendar, Activity, Timer, TrendingUp,
    AlignLeft, Bike, Waves, User
} from "lucide-react";
import { useState } from "react";

interface ManualWorkoutModalProps {
    date: Date;
    onClose: () => void;
    onSave: (workout: Workout) => Promise<void>;
}

export const ManualWorkoutModal: React.FC<ManualWorkoutModalProps> = ({
    date,
    onClose,
    onSave
}) => {
    // États de base
    const [title, setTitle] = useState('Sortie Libre');
    const [sportType, setSportType] = useState<SportType>('cycling');
    const [workoutType, setWorkoutType] = useState('Endurance');
    const [duration, setDuration] = useState(60);
    const [distance, setDistance] = useState(0);
    const [tss, setTss] = useState(0);
    const [mode, setMode] = useState<'Outdoor' | 'Indoor'>('Outdoor');
    const [description, setDescription] = useState('');

    // Métriques sport-spécifiques
    const [avgPower, setAvgPower] = useState<number | undefined>();
    const [avgHeartRate, setAvgHeartRate] = useState<number | undefined>();
    const [rpe, setRpe] = useState(5);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Construction des données complétées
            const completedData: CompletedData = {
                actualDurationMinutes: duration,
                distanceKm: distance,
                perceivedEffort: rpe,
                notes: description,
                source: {
                    type: 'manual',
                    fullJson: false
                },
                laps: [],
                map: {
                    polyline: null
                },
                heartRate: avgHeartRate ? {
                    avgBPM: avgHeartRate,
                    maxBPM: null
                } : undefined,
                caloriesBurned: null,
                metrics: {
                    cycling: sportType === 'cycling' ? {
                        tss: tss || null,
                        avgPowerWatts: avgPower || null,
                        maxPowerWatts: null,
                        normalizedPowerWatts: null,
                        avgCadenceRPM: null,
                        maxCadenceRPM: null,
                        elevationGainMeters: null,
                        avgSpeedKmH: distance && duration ? (distance / duration) * 60 : null,
                        maxSpeedKmH: null,
                        intensityFactor: null
                    } : null,
                    running: sportType === 'running' ? {
                        avgPaceMinPerKm: null,
                        bestPaceMinPerKm: null,
                        elevationGainMeters: null,
                        avgCadenceSPM: null,
                        maxCadenceSPM: null,
                        avgSpeedKmH: distance && duration ? (distance / duration) * 60 : null,
                        maxSpeedKmH: null
                    } : null,
                    swimming: sportType === 'swimming' ? {
                        avgPace100m: null,
                        bestPace100m: null,
                        strokeType: null,
                        avgStrokeRate: null,
                        avgSwolf: null,
                        poolLengthMeters: null,
                        totalStrokes: null
                    } : null
                }
            };

            const newWorkout: Workout = {
                title: title || 'Sortie Libre',
                id: `manual-${Date.now()}`,
                date: dateStr,
                sportType,
                workoutType,
                status: 'completed',
                mode: mode,
                plannedData: {
                    durationMinutes: duration,
                    distanceKm: distance,
                    plannedTSS: tss || null,
                    targetPowerWatts: null,
                    targetPaceMinPerKm: null,
                    targetHeartRateBPM: null,
                    descriptionIndoor: description || 'Séance manuelle',
                    descriptionOutdoor: description || 'Séance manuelle',
                },
                completedData
            };

            await onSave(newWorkout);
            onClose();
        } catch (e) {
            console.error('Erreur sauvegarde workout manuel:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const sportIcons: Record<SportType, React.ReactNode> = {
        cycling: <Bike size={16} />,
        running: <User size={16} />,
        swimming: <Waves size={16} />,
        other: <Activity size={16} />
    };

    const workoutTypes: Record<SportType, string[]> = {
        cycling: ['Endurance', 'Tempo', 'Threshold', 'VO2max', 'Sprint', 'Recovery', 'Force'],
        running: ['Endurance', 'Tempo', 'Threshold', 'Intervals', 'Recovery', 'Long Run'],
        swimming: ['Endurance', 'Technique', 'Intervals', 'Recovery', 'Sprints'],
        other: ['Endurance', 'Intervals', 'Recovery', 'Sprints']
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <Card className="w-full max-w-lg animate-in zoom-in-95 duration-200 border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">

                {/* Header */}
                <div className="mb-6 border-b border-slate-800 pb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus className="text-blue-500" size={24} />
                        Ajouter une activité
                    </h2>
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                        <Calendar size={14} />
                        {date.toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </p>
                </div>

                <div className="space-y-4">

                    {/* Sport Type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-2">
                            Type de sport
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['cycling', 'running', 'swimming'] as SportType[]).map(sport => (
                                <button
                                    key={sport}
                                    type="button"
                                    onClick={() => {
                                        setSportType(sport);
                                        setWorkoutType(workoutTypes[sport][0]);
                                    }}
                                    className={`
                                        h-11 flex items-center justify-center gap-2 rounded-lg border-2 
                                        transition-all font-medium text-sm capitalize
                                        ${sportType === sport
                                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                        }
                                    `}
                                >
                                    {sportIcons[sport]}
                                    <span className="hidden sm:inline">{sport}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Titre */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                            <Activity size={14} className="text-slate-500" />
                            Titre de la séance
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                            placeholder="Ex: Sortie longue dimanche"
                        />
                    </div>

                    {/* Grid Type & Mode */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Type d&apos;effort
                            </label>
                            <div className="relative">
                                <select
                                    value={workoutType}
                                    onChange={e => setWorkoutType(e.target.value)}
                                    className="w-full h-11 appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    {workoutTypes[sportType].map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Environnement
                            </label>
                            <div className="relative">
                                <select
                                    value={mode}
                                    onChange={e => setMode(e.target.value as 'Outdoor' | 'Indoor')}
                                    className="w-full h-11 appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="outdoor">Extérieur</option>
                                    <option value="indoor">Intérieur</option>
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grid Durée & Distance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                                <Timer size={14} className="text-slate-500" /> Durée (min)
                            </label>
                            <input
                                type="number"
                                value={duration}
                                onChange={e => setDuration(parseInt(e.target.value) || 0)}
                                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                                <TrendingUp size={14} className="text-slate-500" /> Distance (km)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={distance}
                                onChange={e => setDistance(parseFloat(e.target.value) || 0)}
                                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                            />
                        </div>
                    </div>

                    {/* Métriques sport-spécifiques */}
                    {sportType === 'cycling' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Puissance Moy. (W)
                                </label>
                                <input
                                    type="number"
                                    value={avgPower || ''}
                                    onChange={e => setAvgPower(parseInt(e.target.value) || undefined)}
                                    placeholder="Optionnel"
                                    className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    TSS Estimé
                                </label>
                                <input
                                    type="number"
                                    value={tss}
                                    onChange={e => setTss(parseInt(e.target.value) || 0)}
                                    className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                                />
                            </div>
                        </div>
                    )}

                    {/* RPE & FC Moyenne */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                RPE (1-10)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={rpe}
                                onChange={e => setRpe(parseInt(e.target.value) || 5)}
                                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                FC Moy. (bpm)
                            </label>
                            <input
                                type="number"
                                value={avgHeartRate || ''}
                                onChange={e => setAvgHeartRate(parseInt(e.target.value) || undefined)}
                                placeholder="Optionnel"
                                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                            <AlignLeft size={14} className="text-slate-500" /> Description / Notes
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Détails de la sortie, météo, sensations..."
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 pt-4 border-t border-slate-800">
                    <Button
                        variant="ghost"
                        className="flex-1 h-12 sm:h-10 text-slate-400 hover:text-white"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1 h-12 sm:h-10 shadow-lg shadow-blue-900/20"
                        onClick={handleSave}
                        disabled={isSaving}
                        icon={isSaving ? undefined : Plus}
                    >
                        {isSaving ? "Ajout..." : "Ajouter la séance"}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
