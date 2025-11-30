'use client';

import React, { useState } from 'react';
import {
    BrainCircuit
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';


interface GenerationModalProps {
    onClose: () => void;
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string | null) => Promise<void>;
    isGenerating: boolean;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({ onClose, onGenerate, isGenerating }) => {
    const [blockFocus, setBlockFocus] = useState('Endurance');
    const [customTheme, setCustomTheme] = useState('');
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
        await onGenerate(blockFocus, blockFocus === 'Personnalisé' ? customTheme : null, startDate);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <Card className="max-w-md w-full animate-in zoom-in-95">
                <h2 className="text-2xl font-bold text-white mb-4">Créer un Nouveau Bloc</h2>
                <p className="text-slate-400 mb-6 text-sm">
                    L&apos;IA va analyser votre historique récent pour calibrer l&apos;intensité et la périodisation (3+1 par défaut).
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Date de début du bloc</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    />

                    <label className="block text-sm font-medium text-slate-300 mb-2">Thème / Focus du bloc</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {themes.map((focus) => (
                            <button
                                key={focus}
                                onClick={() => setBlockFocus(focus)}
                                className={`p-3 rounded-lg text-sm text-left transition-all border truncate ${blockFocus === focus
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                    }`}
                                title={focus}
                            >
                                {focus === 'Semaine de Tests (FTP, VO2max)' ? 'Semaine de Tests' : focus}
                            </button>
                        ))}
                    </div>

                    {blockFocus === 'Personnalisé' && (
                        <div className="animate-in fade-in slide-in-from-top-2 mt-4">
                            <label className="block text-xs text-blue-400 mb-1">Décrivez votre thème</label>
                            <textarea
                                value={customTheme}
                                onChange={(e) => setCustomTheme(e.target.value)}
                                placeholder="Ex: Semaine choc montagne, Vitesse Piste..."
                                className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-3 text-white text-sm h-24 resize-none focus:ring-1 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isGenerating}>Annuler</Button>
                    <Button
                        variant="primary"
                        className="flex-1"
                        icon={BrainCircuit}
                        onClick={handleGenerate}
                        disabled={isGenerating || (blockFocus === 'Personnalisé' && customTheme.length < 3)}
                    >
                        {isGenerating ? "Génération..." : "Générer le Bloc"}
                    </Button>
                </div>
            </Card>
        </div>
    );
};