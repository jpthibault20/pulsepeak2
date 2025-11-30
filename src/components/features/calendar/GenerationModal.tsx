'use client';

import React, { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modale';


interface GenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Mise à jour de la signature pour accepter le nombre de semaines
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) => Promise<void>;
    isGenerating: boolean;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({ isOpen, onClose, onGenerate, isGenerating }) => {
    const [blockFocus, setBlockFocus] = useState('Endurance');
    const [customTheme, setCustomTheme] = useState('');
    const [numWeeks, setNumWeeks] = useState(4); // Par défaut 4 semaines
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
        // On passe numWeeks seulement si on est en mode personnalisé
        const durationToSend = blockFocus === 'Personnalisé' ? numWeeks : undefined;
        await onGenerate(blockFocus, blockFocus === 'Personnalisé' ? customTheme : null, startDate, durationToSend);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Créer un Nouveau Bloc"
        >
            <div className="space-y-6">
                <p className="text-slate-400 text-sm">
                    L&apos;IA va analyser votre historique pour calibrer l&apos;intensité.
                </p>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Date de début</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Thème / Focus</label>
                    <div className="grid grid-cols-2 gap-2">
                        {themes.map((focus) => (
                            <button
                                key={focus}
                                onClick={() => setBlockFocus(focus)}
                                className={`p-3 rounded-lg text-sm text-left transition-all border truncate ${blockFocus === focus
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                {focus === 'Semaine de Tests (FTP, VO2max)' ? 'Tests' : focus}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Zone spécifique au thème personnalisé */}
                {blockFocus === 'Personnalisé' && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 border-t border-slate-700/50 pt-4">
                        <div>
                            <label className="block text-xs text-blue-400 mb-1">Description du thème</label>
                            <textarea
                                value={customTheme}
                                onChange={(e) => setCustomTheme(e.target.value)}
                                placeholder="Ex: Semaine choc montagne, Vitesse Piste..."
                                className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-3 text-white text-sm h-20 resize-none focus:ring-1 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-blue-400 mb-1">Durée du bloc (semaines)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1"
                                    max="8"
                                    step="1"
                                    value={numWeeks}
                                    onChange={(e) => setNumWeeks(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <span className="text-white font-mono bg-slate-800 px-3 py-1 rounded border border-slate-700 min-w-4rem text-center">
                                    {numWeeks} sem.
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-700">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isGenerating}>Annuler</Button>
                    <Button
                        variant="primary"
                        className="flex-1"
                        icon={BrainCircuit}
                        onClick={handleGenerate}
                        disabled={isGenerating || (blockFocus === 'Personnalisé' && customTheme.length < 3)}
                    >
                        {isGenerating ? "Génération..." : "Générer"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};