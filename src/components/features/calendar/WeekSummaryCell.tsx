import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Bot, Plus, Sparkles, Zap } from 'lucide-react';
import { WeekStatsPopover } from './WeekStatsPopover';
import type { WeekStats } from '@/hooks/useWeekStats';

interface WeekSummaryCellProps {
    stats: WeekStats;
}

export function WeekSummaryCell({ stats }: WeekSummaryCellProps) {
    const [showPopover, setShowPopover] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);
    const [showAIModal, setShowAIModal] = useState(false);

    const handleAIClick = (e: { stopPropagation: () => void; }) => {
        e.stopPropagation(); // Arrête la propagation pour ne pas ouvrir les stats
        setShowAIModal(true);
    };

    // Gestionnaire pour le clic global (Ouvrir les stats)
    // On ne l'exécute que si on n'a pas cliqué sur le bouton IA
    const handleCardClick = () => {
        setShowPopover(!showPopover);
    };
    // ✅ Détection de la position
    useEffect(() => {
        if (showPopover && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const spaceBelow = windowHeight - rect.bottom;

            // Si moins de 400px en dessous, ouvrir vers le haut
            setOpenUpward(spaceBelow < 400);
        }
    }, [showPopover]);

    const formatDuration = (totalMinutes: number) => {
        if (!totalMinutes) return '0h00';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return `${hours}h${minutes.toString().padStart(2, '0')}`;
    };

    const durationPercentage = stats.plannedDuration === 0
        // CAS 1 : Rien n'était prévu (0 min)
        ? (stats.actualDuration > 0 ? 100 : 0)
        // CAS 2 : Calcul normal avec ton plafond à 100
        : Math.min((stats.actualDuration / stats.plannedDuration) * 100, 100);




    return (
        <div className="relative h-full w-full">
            {/* On change <button> en <div> pour éviter les conflits de boutons imbriqués,
               mais on garde l'interactivité globale via onClick sur le conteneur.
            */}
            <div
                ref={buttonRef}
                onClick={handleCardClick}
                className="group relative w-full h-full p-2 flex flex-col justify-between hover:bg-slate-800/40 transition-all duration-300 cursor-pointer overflow-hidden rounded-lg"
            >
                {/* ------------------------------------------------------- */}
                {/* 1. HEADER (Reste TOUJOURS visible et net au-dessus)     */}
                {/* ------------------------------------------------------- */}
                <div className="relative z-20 flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider group-hover:text-slate-300 transition-colors">
                        Bilan
                    </span>
                    {/* Ton icône existante, intouchée */}
                    <BarChart3 size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                </div>

                {/* ------------------------------------------------------- */}
                {/* 2. OVERLAY D'ACTION (Apparaît uniquement au survol)     */}
                {/* ------------------------------------------------------- */}
                <div className="absolute inset-0 top-6 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100">
                    <button
                        onClick={handleAIClick}
                        className="flex flex-col items-center gap-1 group/btn"
                    >
                        {/* Cercle du bouton + */}
                        <div className="w-10 h-10 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] flex items-center justify-center text-white group-hover/btn:scale-110 transition-transform duration-200">
                            <Plus size={24} strokeWidth={3} />
                        </div>
                        {/* Petit texte descriptif optionnel */}
                        <div className="flex items-center gap-1 text-[9px] font-bold text-blue-200 bg-slate-900/80 px-2 py-0.5 rounded-full border border-blue-500/30 backdrop-blur-md">
                            <Sparkles size={8} />
                            <span>Générer IA</span>
                        </div>
                    </button>
                </div>

                {/* ------------------------------------------------------- */}
                {/* 3. CONTENU DATA (Devient flou au survol)                */}
                {/* ------------------------------------------------------- */}
                <div className="flex flex-col justify-between grow transition-all duration-300 group-hover:blur-[3px] group-hover:opacity-20 group-hover:scale-95 origin-center">
                    
                    {/* Main Stats Block */}
                    <div className="flex flex-col gap-3 py-1">
                        <div className="flex items-end gap-1.5">
                            <div className="flex items-baseline gap-1.5">
                                <div className="text-xl font-bold text-white leading-none tracking-tight">
                                    {Math.round(stats.completedTSS)}
                                </div>
                                <div className="text-sm font-medium text-slate-500 leading-none">
                                    <span className="opacity-50 mr-1">/</span>
                                    {Math.round(stats.plannedTSS)}
                                </div>
                            </div>
                            <div className="text-[10px] font-medium text-slate-500 flex items-center gap-0.5">
                                <Zap size={10} className="text-yellow-500/70" /> TSS
                            </div>
                        </div>

                        <div className="w-full space-y-1.5">
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/50">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${durationPercentage >= 100
                                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                        : 'bg-line  r-to-r from-blue-600 to-blue-400'
                                        }`}
                                    style={{ width: `${durationPercentage}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-[10px] leading-none">
                                <span className={`font-semibold ${stats.actualDuration > 0 ? 'text-blue-200' : 'text-slate-500'}`}>
                                    {formatDuration(stats.actualDuration)}
                                </span>
                                <span className="text-slate-600 font-medium">
                                    {formatDuration(stats.plannedDuration)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-2 flex items-center gap-1 text-[9px] text-slate-600 font-medium border-t border-slate-800/50 w-full">
                        <div className={`w-1.5 h-1.5 rounded-full ${stats.completed >= stats.total ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                        {stats.completed}/{stats.total} séances
                    </div>
                </div>
            </div>

            {/* --- MODALES (Rien ne change ici) --- */}
            
            {/* Popover Bilan Classique */}
            {showPopover && (
                <WeekStatsPopover
                    stats={stats}
                    onClose={() => setShowPopover(false)}
                    openUpward={openUpward}
                />
            )}

            {/* Modal IA (Exemple basique) */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="absolute inset-0" onClick={() => setShowAIModal(false)} />
                    <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4 text-blue-400">
                            <Bot size={24} />
                            <h3 className="font-bold text-white text-lg">Générateur IA</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">
                            Voulez-vous que l&apos;IA analyse votre charge de <strong>{Math.round(stats.completedTSS)} TSS</strong> pour créer la semaine prochaine ?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowAIModal(false)} className="text-slate-400 text-sm hover:text-white">Annuler</button>
                            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Générer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
