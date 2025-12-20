'use client';

import React, { useState } from 'react';
import {
    Activity, Clock, Zap, Home, Mountain,
    ChevronLeft, CheckCircle, XCircle,
    CalendarDays,
    Edit,
    Trash2,      // Import icône poubelle
    RefreshCw,   // Import icône régénération
    AlertTriangle, // Import icône alerte pour confirmation
    Send,
    X
} from 'lucide-react';
import { Profile, Workout } from '@/lib/data/type';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import { FeedbackForm } from './FeedbackForm';

interface WorkoutDetailViewProps {
    workout: Workout;
    profile: Profile;
    onClose: () => void;
    onUpdate: (dateKey: string, status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => Promise<void>;
    onToggleMode: (dateKey: string) => Promise<void>;
    onMoveWorkout: (originalDateStr: string, newDateStr: string) => Promise<void>;
    onDelete: (dateKey: string) => Promise<void>;
    onRegenerate: (dateKey: string, instruction?: string) => Promise<void>;
}

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
    const [isCompleting, setIsCompleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [showRegenInput, setShowRegenInput] = useState(false);
    const [regenInstruction, setRegenInstruction] = useState('');

    // Nouveaux états locaux
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [newMoveDate, setNewMoveDate] = useState('');

    // isMutating bloque toutes les actions
    const [isMutating, setIsMutating] = useState(false);
    // isRegenerating sert juste pour l'animation de l'icône
    const [isRegenerating, setIsRegenerating] = useState(false);

    const currentDescription = workout.mode === 'Outdoor'
        ? workout.description_outdoor
        : workout.description_indoor;

    const ModeIcon = workout.mode === 'Outdoor' ? Mountain : Home;

    // --- HANDLERS ---
    // (J'ai gardé tes handlers tels quels, ils sont parfaits pour la logique)

    const handleToggle = async () => {
        setIsMutating(true);
        try { await onToggleMode(workout.date); }
        catch (e) { console.error("Erreur bascule de mode:", e); }
        finally { setIsMutating(false); }
    };

    const handleMove = async () => {
        if (!newMoveDate) return;
        setIsMutating(true);
        try {
            await onMoveWorkout(workout.date, newMoveDate);
            onClose();
        } catch (e) { console.error("Erreur de déplacement:", e); }
        finally { setIsMutating(false); }
    };

    const handleRegenerateClick = async () => {
        setIsMutating(true);
        setIsRegenerating(true);
        try {
            await onRegenerate(workout.date, regenInstruction);
            setShowRegenInput(false);
            setRegenInstruction('');
        } catch (e) { console.error("Erreur régénération:", e); }
        finally {
            setIsMutating(false);
            setIsRegenerating(false);
        }
    };

    const handleDeleteClick = async () => {
        setIsMutating(true);
        try { await onDelete(workout.date); }
        catch (e) {
            console.error("Erreur suppression:", e);
            setIsMutating(false);
        }
    };

    const handleStatusUpdate = async (status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => {
        setIsMutating(true);
        try {
            await onUpdate(workout.date, status, feedback);
            setIsCompleting(false);
            setIsEditing(false);
        } catch (e) { console.error("Erreur de mise à jour du statut:", e); }
        finally { setIsMutating(false); }
    };

    // --- RENDER ---

    return (
        // DESIGN: max-w-3xl est bien pour desktop, mais sur mobile on veut que ça prenne toute la largeur
        <div className="w-full max-w-3xl mx-auto py-4 md:py-8 animate-in zoom-in-95 duration-300 pb-24 md:pb-8">

            {/* Bouton Retour Mobile-First */}
            <button
                onClick={onClose}
                className="flex items-center text-slate-400 hover:text-white mb-4 md:mb-6 transition-colors px-1"
            >
                <ChevronLeft size={20} className="mr-1" /> Retour au calendrier
            </button>

            <Card className="border-t-4 border-t-blue-500 shadow-2xl relative overflow-hidden">

                {/* Header de la Card */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                    <div className="w-full">
                        {/* Badges et Métadonnées */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                            <Badge type={workout.type} />
                            <div className="flex items-center gap-3 text-slate-400 bg-slate-800/50 rounded-full px-3 py-1 text-xs md:text-sm">
                                <span className="flex items-center"><Clock size={12} className="mr-1.5" /> {workout.duration} min</span>
                                <div className="w-px h-3 bg-slate-600"></div>
                                <span className="flex items-center"><Zap size={12} className="mr-1.5" /> TSS: {workout.tss || '-'}</span>
                            </div>
                        </div>

                        {/* Titre et Date */}
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">{workout.title}</h1>
                        <p className="text-slate-400 text-sm flex items-center gap-2">
                            <CalendarDays size={14} /> {formatDate(workout.date)}
                        </p>
                    </div>

                    {/* Badge "Accompli" (Mobile: en haut à droite via flex, Desktop: à droite) */}
                    {workout.status === 'completed' && workout.completedData && (
                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-3 text-right shrink-0 w-full md:w-auto flex justify-between md:block items-center">
                            <div className="text-xs text-emerald-400 font-bold uppercase md:mb-1 flex items-center gap-1">
                                <CheckCircle size={12} /> Accompli
                            </div>
                            <div className="flex items-center gap-3 md:block">
                                <div className="text-white text-base md:text-sm font-mono font-bold">{workout.completedData.avgPower}W <span className="text-xs font-normal text-slate-500">Moy.</span></div>
                                <div className="text-slate-300 text-xs">RPE: <span className={workout.completedData.rpe > 7 ? 'text-red-400' : 'text-emerald-400'}>{workout.completedData.rpe}/10</span></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Barre d'outils secondaire */}
                {workout.type !== 'Rest' && (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-800 pb-6 gap-4">

                        {/* Zone Régénération / Actions Principales */}
                        <div className="w-full md:w-auto">
                            {showRegenInput ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 w-full md:w-auto">
                                    <input
                                        type="text"
                                        placeholder="Ex: Moins long, plus dur..."
                                        className="flex-1 md:w-64 bg-slate-900 border border-blue-500/50 rounded-lg text-sm px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={regenInstruction}
                                        onChange={(e) => setRegenInstruction(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleRegenerateClick()}
                                    />
                                    <Button variant="ghost" onClick={() => setShowRegenInput(false)} disabled={isMutating} className="shrink-0">
                                        <X size={18} />
                                    </Button>
                                    <Button variant="primary" onClick={handleRegenerateClick} disabled={isMutating} className="shrink-0 bg-blue-600 hover:bg-blue-500">
                                        {isRegenerating ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                                    </Button>
                                </div>
                            ) : (
                                /* Boutons d'actions rapides (Scrollable horizontalement sur très petits écrans) */
                                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar w-full">
                                    <Button variant="secondary" className="whitespace-nowrap h-9 text-xs" onClick={handleToggle} icon={ModeIcon} disabled={isMutating}>
                                        {workout.mode === 'Outdoor' ? 'Extérieur' : 'Home Tr.'}
                                    </Button>
                                    <Button variant="secondary" className="whitespace-nowrap h-9 text-xs" onClick={() => setIsMoving(!isMoving)} icon={CalendarDays} disabled={isMutating}>
                                        Déplacer
                                    </Button>

                                    {workout.status === 'pending' && (
                                        <Button
                                            variant="ghost"
                                            className="whitespace-nowrap h-9 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                            onClick={() => setShowRegenInput(true)}
                                            disabled={isMutating}
                                        >
                                            <RefreshCw size={14} className="mr-1.5" /> Régénérer l&apos;IA
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Modal de déplacement INLINE */}
                {isMoving && (
                    <div className="mb-6 bg-slate-900/80 border border-blue-500/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center">
                            <CalendarDays size={16} className="mr-2 text-blue-400" /> Choisir une nouvelle date
                        </h4>
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-blue-500"
                                onChange={(e) => setNewMoveDate(e.target.value)}
                            />
                            <Button variant="ghost" onClick={() => setIsMoving(false)} disabled={isMutating}>Annuler</Button>
                            <Button variant="primary" disabled={isMutating || !newMoveDate} onClick={handleMove}>Confirmer</Button>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmation Suppression INLINE */}
                {showDeleteConfirm && (
                    <div className="mb-6 bg-red-900/10 border border-red-500/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center">
                            <AlertTriangle size={16} className="mr-2" /> Supprimer cette séance ?
                        </h4>
                        <p className="text-xs text-red-300/70 mb-4">Cette action est irréversible et supprimera les données associées.</p>
                        <div className="flex gap-2 justify-end">
                            <Button variant="secondary" className="h-8 text-xs" onClick={() => setShowDeleteConfirm(false)} disabled={isMutating}>Annuler</Button>
                            <Button variant="danger" className="h-8 text-xs bg-red-600 hover:bg-red-500 text-white border-0" onClick={handleDeleteClick} disabled={isMutating} icon={Trash2}>
                                {isMutating ? "..." : "Supprimer définitivement"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Description de la séance */}
                <div className="bg-slate-900/50 rounded-xl p-4 md:p-6 mb-8 border border-slate-800">
                    <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center">
                        <Activity size={18} className="mr-2 text-blue-400" />
                        Structure de la séance
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                        {currentDescription}
                    </div>
                </div>

                {/* Zone Feedback / Formulaire */}
                {isCompleting || isEditing ? (
                    <FeedbackForm
                        workout={workout}
                        profile={profile}
                        onCancel={() => { setIsCompleting(false); setIsEditing(false); }}
                        onSave={(data) => handleStatusUpdate('completed', data)}
                    />
                ) : (
                    /* Footer Actions Principales */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800">
                        {workout.status !== 'completed' && !showDeleteConfirm && (
                            <Button
                                variant="success"
                                onClick={() => setIsCompleting(true)}
                                className="w-full sm:col-span-2 h-12 md:h-10 text-base font-semibold shadow-lg shadow-emerald-900/20"
                                disabled={isMutating}
                            >
                                <CheckCircle size={18} className="mr-2" /> Marquer comme fait
                            </Button>
                        )}

                        {workout.status === 'completed' && !showDeleteConfirm && (
                            <>
                                <Button variant="outline" onClick={() => handleStatusUpdate('pending')} disabled={isMutating}>
                                    Réinitialiser
                                </Button>
                                <Button variant="secondary" onClick={() => setIsEditing(true)} disabled={isMutating} icon={Edit}>
                                    Modifier le feedback
                                </Button>
                            </>
                        )}

                        {/* Boutons secondaires (Raté / Supprimer) */}
                        {!showDeleteConfirm && workout.status !== 'completed' && (
                            <div className="flex gap-3 sm:col-span-2 mt-2">
                                {workout.status !== 'missed' ? (
                                    <Button variant="danger" className="flex-1 bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-900/50" onClick={() => handleStatusUpdate('missed')} disabled={isMutating}>
                                        <XCircle size={16} className="mr-2" /> Raté
                                    </Button>
                                ) : (
                                    <Button variant="outline" className="flex-1" onClick={() => handleStatusUpdate('pending')} disabled={isMutating}>
                                        Réactiver
                                    </Button>
                                )}

                                <Button variant="ghost" className="px-3 text-slate-500 hover:text-red-400" onClick={() => setShowDeleteConfirm(true)} disabled={isMutating}>
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};