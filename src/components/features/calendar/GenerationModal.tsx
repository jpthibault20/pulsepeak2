'use client';

import React, { useState } from 'react';
import { BrainCircuit, Calendar, Sliders, Target, Trophy, ChevronRight, MapPin, Mountain, ChevronLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modale';
import { AvailabilityTable } from './AvailabilityTable';
import type { Objective, Profile } from '@/lib/data/DatabaseTypes';
import type { AvailabilitySlot } from '@/lib/data/type';

type Mode = 'block' | 'objective';
type Step = 'config' | 'availability';

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

interface GenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string, numWeeks: number, availability: { [key: string]: AvailabilitySlot }) => Promise<void>;
    onGenerateToObjective: (planStartDate: string, availability: { [key: string]: AvailabilitySlot }) => Promise<void>;
    isGenerating: boolean;
    objectives: Objective[];
    profile: Profile;
}

const SPORT_LABELS: Record<string, string> = {
    cycling: 'Vélo',
    running: 'Course',
    swimming: 'Natation',
    triathlon: 'Triathlon',
    duathlon: 'Duathlon',
};

export const GenerationModal: React.FC<GenerationModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    onGenerateToObjective,
    isGenerating,
    objectives,
    profile,
}) => {
    const [mode, setMode] = useState<Mode>('objective');
    const [step, setStep] = useState<Step>('config');
    const [blockFocus, setBlockFocus] = useState('Endurance');
    const [customTheme, setCustomTheme] = useState('');
    const [numWeeks, setNumWeeks] = useState(4);
    const [startDate, setStartDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [planStartDate, setPlanStartDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Availability state for first week
    const [availability, setAvailability] = useState<{ [key: string]: AvailabilitySlot }>(() => {
        const avail: { [key: string]: AvailabilitySlot } = {};
        DAYS_FR.forEach(day => {
            avail[day] = profile.weeklyAvailability?.[day] ?? { swimming: 0, cycling: 0, running: 0, comment: '', aiChoice: false };
        });
        return avail;
    });

    const themes = [
        'Endurance', 'PMA', 'Seuil', 'Fartlek',
        'Semaine de Tests (FTP, VO2max)',
        'Sprint', 'Force', 'Cadence', 'Sweet Spot', 'Ascension', 'Personnalisé'
    ];

    const today = new Date().toISOString().split('T')[0];
    const upcomingPrimary = objectives
        .filter(o => o.priority === 'principale' && o.status === 'upcoming' && o.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0];

    const secondaryInRange = upcomingPrimary
        ? objectives.filter(
            o => o.priority === 'secondaire' && o.status === 'upcoming'
                && o.date >= today && o.date <= upcomingPrimary.date
        )
        : [];

    const goToAvailability = () => {
        // Reset availability from profile defaults
        const avail: { [key: string]: AvailabilitySlot } = {};
        DAYS_FR.forEach(day => {
            avail[day] = profile.weeklyAvailability?.[day] ?? { swimming: 0, cycling: 0, running: 0, comment: '', aiChoice: false };
        });
        setAvailability(avail);
        setStep('availability');
    };

    const handleConfirmGenerate = async () => {
        onClose();
        setStep('config');
        if (mode === 'block') {
            const durationToSend = blockFocus === 'Personnalisé' ? numWeeks : 4;
            await onGenerate(blockFocus, blockFocus === 'Personnalisé' ? customTheme : null, startDate, durationToSend, availability);
        } else {
            await onGenerateToObjective(planStartDate, availability);
        }
    };

    const handleClose = () => {
        setStep('config');
        onClose();
    };

    const updateSlot = (day: string, sport: keyof Omit<AvailabilitySlot, 'comment'>, value: number) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], [sport]: Math.max(0, value) },
        }));
    };

    const updateDayComment = (day: string, value: string) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], comment: value },
        }));
    };

    const updateAiChoice = (day: string, value: boolean) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], aiChoice: value },
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={step === 'availability' ? 'Confirmer vos disponibilités' : 'Créer un Nouveau Plan'}>
            <div className="space-y-5 sm:space-y-6">

                {step === 'config' && (<>

                {/* ── Mode selector ── */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                    <button
                        onClick={() => setMode('objective')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${mode === 'objective'
                                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30 dark:shadow-rose-900/30'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                    >
                        <Trophy size={14} />
                        Vers un objectif
                    </button>
                    <button
                        onClick={() => setMode('block')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${mode === 'block'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-900/30'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                    >
                        <Sliders size={14} />
                        Bloc d&apos;entraînement
                    </button>
                </div>

                {/* ── BLOCK MODE ── */}
                {mode === 'block' && (
                    <div className="space-y-5">
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 p-3 rounded-lg flex gap-3 items-start">
                            <BrainCircuit className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                            <p className="text-blue-700 dark:text-blue-200/80 text-xs sm:text-sm leading-relaxed">
                                L&apos;IA va analyser votre historique récent pour calibrer l&apos;intensité et le volume de ce bloc.
                            </p>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
                                Date de début
                            </label>
                            <input
                                type="date"
                                style={{ colorScheme: 'dark' }}
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full h-11 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                <Sliders size={14} className="text-slate-500 dark:text-slate-400" />
                                Thème / Focus
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {themes.map(focus => (
                                    <button
                                        key={focus}
                                        onClick={() => setBlockFocus(focus)}
                                        className={`p-3 rounded-lg text-xs sm:text-sm text-left transition-all border whitespace-normal h-full min-h-[50px] flex items-center ${blockFocus === focus
                                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                                                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750 hover:border-slate-400 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        {focus === 'Semaine de Tests (FTP, VO2max)' ? 'Semaine de Tests' : focus}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {blockFocus === 'Personnalisé' && (
                            <div className="animate-in fade-in slide-in-from-top-2 space-y-4 border-t border-slate-300/50 dark:border-slate-700/50 pt-4">
                                <div>
                                    <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-wide">Description précise</label>
                                    <textarea
                                        value={customTheme}
                                        onChange={e => setCustomTheme(e.target.value)}
                                        placeholder="Ex: Prépa Montagne, beaucoup de D+, intensité seuil..."
                                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-500/50 rounded-lg p-3 text-slate-900 dark:text-white text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Durée du bloc</label>
                                        <span className="text-xs font-mono text-white bg-blue-600 px-2 py-0.5 rounded-full">
                                            {numWeeks} semaine{numWeeks > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                        <span className="text-xs text-slate-500 font-mono">1</span>
                                        <input
                                            type="range" min="1" max="8" step="1"
                                            value={numWeeks}
                                            onChange={e => setNumWeeks(parseInt(e.target.value))}
                                            className="flex-1 h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <span className="text-xs text-slate-500 font-mono">8</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2 sm:pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button variant="outline" className="flex-1 h-11" onClick={handleClose} disabled={isGenerating}>
                                Annuler
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-1 h-11 font-semibold shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20"
                                icon={ChevronRight}
                                onClick={goToAvailability}
                                disabled={blockFocus === 'Personnalisé' && customTheme.length < 3}
                            >
                                Suivant
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── OBJECTIVE MODE ── */}
                {mode === 'objective' && (
                    <div className="space-y-5">
                        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-500/20 p-3 rounded-lg flex gap-3 items-start">
                            <Trophy className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" size={18} />
                            <p className="text-rose-700 dark:text-rose-200/80 text-xs sm:text-sm leading-relaxed">
                                L&apos;IA va créer un plan complet de plusieurs blocs, de aujourd&apos;hui jusqu&apos;à votre objectif principal, en intégrant les objectifs secondaires.
                            </p>
                        </div>

                        {/* Date de début du plan */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
                                Date de début du plan
                            </label>
                            <input
                                type="date"
                                style={{ colorScheme: 'dark' }}
                                value={planStartDate}
                                min={today}
                                onChange={e => setPlanStartDate(e.target.value)}
                                className="w-full h-11 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        {upcomingPrimary ? (
                            <div className="space-y-3">
                                {/* Objectif principal */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Objectif principal</p>
                                    <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-600/20 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center shrink-0">
                                            <Trophy size={16} className="text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">{upcomingPrimary.name}</p>
                                            <p className="text-rose-600 dark:text-rose-300/70 text-xs mt-0.5">{SPORT_LABELS[upcomingPrimary.sport] ?? upcomingPrimary.sport}</p>
                                            <div className="flex flex-wrap gap-3 mt-2">
                                                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <Calendar size={11} />
                                                    {new Date(upcomingPrimary.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </span>
                                                {upcomingPrimary.distanceKm && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <MapPin size={11} />
                                                        {upcomingPrimary.distanceKm} km
                                                    </span>
                                                )}
                                                {upcomingPrimary.elevationGainM && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <Mountain size={11} />
                                                        {upcomingPrimary.elevationGainM} m D+
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-rose-400/50 shrink-0 mt-1" />
                                    </div>
                                </div>

                                {/* Objectifs secondaires */}
                                {secondaryInRange.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                            {secondaryInRange.length} objectif{secondaryInRange.length > 1 ? 's' : ''} secondaire{secondaryInRange.length > 1 ? 's' : ''} intégré{secondaryInRange.length > 1 ? 's' : ''}
                                        </p>
                                        <div className="space-y-2">
                                            {secondaryInRange.map(o => (
                                                <div key={o.id} className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
                                                    <Target size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300 flex-1 truncate">{o.name}</span>
                                                    <span className="text-xs text-slate-500 shrink-0">
                                                        {new Date(o.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-amber-600 dark:text-amber-400/70 mt-1.5">→ Une semaine de taper sera prévue autour de chaque objectif secondaire.</p>
                                    </div>
                                )}

                                <div className="bg-slate-100/40 dark:bg-slate-800/40 rounded-lg p-3 text-xs text-slate-500 dark:text-slate-400 border border-slate-200/40 dark:border-slate-700/40">
                                    ⚠️ Cette génération <span className="text-slate-900 dark:text-white font-medium">remplace</span> votre plan actif.
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 px-4">
                                <Trophy size={32} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Aucun objectif principal à venir</p>
                                <p className="text-slate-500 text-xs mt-1">Ajoutez un objectif principal dans votre profil pour utiliser cette fonctionnalité.</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2 sm:pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button variant="outline" className="flex-1 h-11" onClick={handleClose} disabled={isGenerating}>
                                Annuler
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-1 h-11 font-semibold shadow-lg shadow-rose-500/20 dark:shadow-rose-900/20 bg-rose-600 hover:bg-rose-500 border-rose-500"
                                icon={ChevronRight}
                                onClick={goToAvailability}
                                disabled={!upcomingPrimary}
                            >
                                Suivant
                            </Button>
                        </div>
                    </div>
                )}

                </>)}

                {/* ── AVAILABILITY STEP ── */}
                {step === 'availability' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 p-3 rounded-lg flex gap-3 items-start">
                            <Clock className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                            <p className="text-blue-700 dark:text-blue-200/80 text-xs sm:text-sm leading-relaxed">
                                Confirmez vos disponibilités pour la première semaine. L&apos;IA adaptera les séances en conséquence.
                            </p>
                        </div>

                        <AvailabilityTable
                            availability={availability}
                            activeSports={profile.activeSports}
                            onSlotChange={updateSlot}
                            onCommentChange={updateDayComment}
                            onAiChoiceChange={updateAiChoice}
                        />

                        <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <Button variant="outline" className="flex-1 h-11" onClick={() => setStep('config')}>
                                <ChevronLeft size={16} className="mr-1" />
                                Retour
                            </Button>
                            <Button
                                variant="primary"
                                className={`flex-1 h-11 font-semibold shadow-lg ${mode === 'objective' ? 'bg-rose-600 hover:bg-rose-500 border-rose-500 shadow-rose-500/20' : 'shadow-blue-500/20'}`}
                                icon={isGenerating ? undefined : BrainCircuit}
                                onClick={handleConfirmGenerate}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Création...
                                    </span>
                                ) : mode === 'objective' ? 'Générer le Plan' : 'Générer le Bloc'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
