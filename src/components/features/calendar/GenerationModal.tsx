'use client';

import React, { useState } from 'react';
import { BrainCircuit, Calendar, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modale';

interface GenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string, numWeeks: number) => Promise<void>;
    isGenerating: boolean;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({ isOpen, onClose, onGenerate, isGenerating }) => {
    const [blockFocus, setBlockFocus] = useState('Endurance');
    const [customTheme, setCustomTheme] = useState('');
    const [numWeeks, setNumWeeks] = useState(4);
    const [startDate, setStartDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });

    const themes = [
        'Endurance', 'PMA', 'Seuil', 'Fartlek',
        'Semaine de Tests (FTP, VO2max)',
        'Sprint', 'Force', 'Cadence', 'Sweet Spot', 'Ascension', 'Personnalisé'
    ];

    const handleGenerate = async () => {
        const durationToSend = blockFocus === 'Personnalisé' ? numWeeks : 4;
        await onGenerate(blockFocus, blockFocus === 'Personnalisé' ? customTheme : null, startDate, durationToSend);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Créer un Nouveau Bloc"
        >
            <div className="space-y-5 sm:space-y-6">

                {/* Intro Text */}
                <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg flex gap-3 items-start">
                    <BrainCircuit className="text-blue-400 shrink-0 mt-0.5" size={18} />
                    <p className="text-blue-200/80 text-xs sm:text-sm leading-relaxed">
                        L&apos;IA va analyser votre historique récent pour calibrer l&apos;intensité et le volume de ce bloc.
                    </p>
                </div>

                {/* Date Input */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Calendar size={14} className="text-slate-400" />
                        Date de début
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        // DESIGN: h-11 pour une bonne zone de touche sur mobile
                        className="w-full h-11 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                </div>

                {/* Thèmes Grid */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Sliders size={14} className="text-slate-400" />
                        Thème / Focus
                    </label>

                    {/* DESIGN: 
              - max-h-[240px] + overflow-y-auto : Garde la modale compacte sur petit écran, on scroll dans les thèmes si besoin.
              - grid-cols-2 (mobile) -> sm:grid-cols-3 (desktop)
          */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {themes.map((focus) => (
                            <button
                                key={focus}
                                onClick={() => setBlockFocus(focus)}
                                // DESIGN: whitespace-normal permet au texte de passer à la ligne au lieu d'être coupé
                                className={`
                  p-3 rounded-lg text-xs sm:text-sm text-left transition-all border whitespace-normal h-full min-h-[50px] flex items-center
                  ${blockFocus === focus
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'
                                    }
                `}
                            >
                                {focus === 'Semaine de Tests (FTP, VO2max)' ? 'Semaine de Tests' : focus}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Zone Personnalisée (Expandable) */}
                {blockFocus === 'Personnalisé' && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 border-t border-slate-700/50 pt-4">

                        {/* Champ Description */}
                        <div>
                            <label className="block text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wide">Description précise</label>
                            <textarea
                                value={customTheme}
                                onChange={(e) => setCustomTheme(e.target.value)}
                                placeholder="Ex: Prépa Montagne, beaucoup de D+, intensité seuil..."
                                // DESIGN: resize-none évite de casser le layout de la modale
                                className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-3 text-white text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>

                        {/* Slider Durée */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Durée du bloc</label>
                                <span className="text-xs font-mono text-white bg-blue-600 px-2 py-0.5 rounded-full">
                                    {numWeeks} semaine{numWeeks > 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                <span className="text-xs text-slate-500 font-mono">1</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="8"
                                    step="1"
                                    value={numWeeks}
                                    onChange={(e) => setNumWeeks(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <span className="text-xs text-slate-500 font-mono">8</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="flex gap-3 pt-2 sm:pt-4 border-t border-slate-800">
                    <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={isGenerating}>
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1 h-11 font-semibold shadow-lg shadow-blue-900/20"
                        icon={isGenerating ? undefined : BrainCircuit}
                        onClick={handleGenerate}
                        disabled={isGenerating || (blockFocus === 'Personnalisé' && customTheme.length < 3)}
                    >
                        {isGenerating ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Création...
                            </span>
                        ) : "Générer le Plan"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};