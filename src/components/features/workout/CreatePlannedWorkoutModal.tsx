'use client';

import { Card, Button } from '@/components/ui';
import type { SportType } from '@/lib/data/type';
import {
    CalendarPlus, Calendar, Bike, Waves, Footprints, Mountain, AlignLeft, Timer, Pencil,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { ProgressModal, type ProgressState, type ProgressModalConfig } from '../calendar/ProgressModal';

interface CreatePlannedWorkoutModalProps {
    date: Date;
    onClose: () => void;
    onCreateAI: (dateStr: string, sportType: SportType, duration: number, comment: string) => Promise<void>;
}

const sportIcons: Record<SportType, React.ReactNode> = {
    cycling: <Bike size={16} />,
    running: <Footprints size={16} />,
    swimming: <Waves size={16} />,
    other: <Mountain size={16} />,
};

const sportLabels: Record<SportType, string> = {
    cycling: 'Vélo',
    running: 'Course',
    swimming: 'Natation',
    other: 'Autre',
};

const workoutTypes: Record<SportType, string[]> = {
    cycling: ['Endurance', 'Tempo', 'Threshold', 'VO2max', 'Sprint', 'Recovery', 'Force'],
    running: ['Endurance', 'Tempo', 'Threshold', 'Intervals', 'Recovery', 'Long Run'],
    swimming: ['Endurance', 'Technique', 'Intervals', 'Recovery', 'Sprints'],
    other: ['Endurance', 'Loisir', 'Intensif', 'Recovery'],
};

const PROGRESS_CONFIG: ProgressModalConfig = {
    icon: <CalendarPlus size={18} className="text-blue-600 dark:text-blue-400" />,
    label: '',
    titleLoading: 'Création en cours…',
    titleDone: 'Séance créée !',
    titleError: 'Erreur de création',
    subtitleLoading: 'L\'IA génère votre séance',
    subtitleDone: 'Votre séance est prête',
    miniLabelLoading: 'Création…',
    miniLabelDone: 'Séance prête !',
    durationMs: 10_000,
    stages: [
        { label: 'Analyse du profil', progressAt: 10 },
        { label: 'Contexte de la semaine', progressAt: 30 },
        { label: 'Génération de la séance', progressAt: 55 },
        { label: 'Ajustement de la charge', progressAt: 80 },
        { label: 'Sauvegarde', progressAt: 95 },
    ],
};

export const CreatePlannedWorkoutModal: React.FC<CreatePlannedWorkoutModalProps> = ({
    date,
    onClose,
    onCreateAI,
}) => {
    const [sportType, setSportType] = useState<SportType>('cycling');
    const [workoutType, setWorkoutType] = useState('Endurance');
    const [isCustomType, setIsCustomType] = useState(false);
    const [customType, setCustomType] = useState('');
    const [duration, setDuration] = useState(60);
    const [description, setDescription] = useState('');

    const effectiveWorkoutType = isCustomType ? customType.trim() : workoutType;

    const [progress, setProgress] = useState<ProgressState>({
        active: false, minimized: false, done: false, error: null, startedAt: 0,
    });

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const config: ProgressModalConfig = {
        ...PROGRESS_CONFIG,
        label: `${sportLabels[sportType]} – ${effectiveWorkoutType || '?'} · ${duration} min`,
    };

    const handleCreate = async () => {
        setProgress({ active: true, minimized: false, done: false, error: null, startedAt: Date.now() });

        const comment = [effectiveWorkoutType, description.trim()].filter(Boolean).join(' – ');

        try {
            await onCreateAI(dateStr, sportType, duration, comment);
            setProgress(p => ({ ...p, done: true }));
        } catch {
            setProgress(p => ({ ...p, error: 'Impossible de créer la séance.' }));
        }
    };

    const handleProgressClose = useCallback(() => {
        setProgress(p => ({ ...p, active: false }));
        onClose();
    }, [onClose]);

    // Si le progress modal est actif, on le montre à la place du formulaire
    if (progress.active) {
        return (
            <ProgressModal
                state={progress}
                config={config}
                onMinimize={() => setProgress(p => ({ ...p, minimized: true }))}
                onRestore={() => setProgress(p => ({ ...p, minimized: false }))}
                onClose={handleProgressClose}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <Card className="w-full max-w-md animate-in zoom-in-95 duration-200 border-slate-200 dark:border-slate-800 shadow-2xl">

                {/* Header */}
                <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CalendarPlus className="text-emerald-500" size={24} />
                        Planifier une séance
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 flex items-center gap-2">
                        <Calendar size={14} />
                        {date.toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </p>
                </div>

                <div className="space-y-4">

                    {/* Sport */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                            Sport
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {(['cycling', 'running', 'swimming', 'other'] as SportType[]).map(sport => (
                                <button
                                    key={sport}
                                    type="button"
                                    onClick={() => {
                                        setSportType(sport);
                                        setWorkoutType(workoutTypes[sport][0]);
                                        setIsCustomType(false);
                                    }}
                                    className={`
                                        h-11 flex items-center justify-center gap-1.5 rounded-lg border-2
                                        transition-all font-medium text-sm
                                        ${sportType === sport
                                            ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600'
                                        }
                                    `}
                                >
                                    {sportIcons[sport]}
                                    <span className="hidden sm:inline">{sportLabels[sport]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Type de séance */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                            Type de séance
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {workoutTypes[sportType].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        setWorkoutType(type);
                                        setIsCustomType(false);
                                    }}
                                    className={`
                                        px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                                        ${!isCustomType && workoutType === type
                                            ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600'
                                        }
                                    `}
                                >
                                    {type}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setIsCustomType(true)}
                                className={`
                                    inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                                    ${isCustomType
                                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600'
                                    }
                                `}
                            >
                                <Pencil size={11} />
                                Perso
                            </button>
                        </div>
                        {isCustomType && (
                            <input
                                type="text"
                                value={customType}
                                onChange={e => setCustomType(e.target.value)}
                                placeholder="Ex: Sortie longue dénivelé, séance technique..."
                                autoFocus
                                className="mt-2 w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                            />
                        )}
                    </div>

                    {/* Durée */}
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <Timer size={13} /> Durée (minutes)
                        </label>
                        <input
                            type="number"
                            min={10}
                            max={600}
                            value={duration}
                            onChange={e => setDuration(Number(e.target.value))}
                            className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                        />
                    </div>

                    {/* Description / commentaire */}
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <AlignLeft size={13} /> Commentaire (optionnel)
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Ex: Sortie vallonnée, travailler le seuil..."
                            rows={2}
                            className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors resize-none"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleCreate}
                        disabled={duration < 10 || !effectiveWorkoutType}
                        className="flex-1 bg-emerald-600! hover:bg-emerald-500!"
                    >
                        Planifier
                    </Button>
                </div>
            </Card>
        </div>
    );
};
