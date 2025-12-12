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

    const handleToggle = async () => {
        setIsMutating(true);
        try {
            await onToggleMode(workout.date);
        } catch (e) {
            console.error("Erreur bascule de mode:", e);
        } finally {
            setIsMutating(false);
        }
    };

    const handleMove = async () => {
        if (!newMoveDate) return;
        setIsMutating(true);
        try {
            await onMoveWorkout(workout.date, newMoveDate);
            onClose();
        } catch (e) {
            console.error("Erreur de déplacement:", e);
        } finally {
            setIsMutating(false);
        }
    };

    const handleRegenerateClick = async () => {
        setIsMutating(true);
        setIsRegenerating(true);
        try {
            // On passe l'instruction à la fonction parente
            await onRegenerate(workout.date, regenInstruction);
            setShowRegenInput(false); // On ferme l'input après succès
            setRegenInstruction('');  // On vide le champ
        } catch (e) {
            console.error("Erreur régénération:", e);
        } finally {
            setIsMutating(false);
            setIsRegenerating(false);
        }
    };

    const handleDeleteClick = async () => {
        setIsMutating(true);
        try {
            await onDelete(workout.date);
            // La fermeture est gérée par le parent ou implicite car l'objet disparait
        } catch (e) {
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
        } catch (e) {
            console.error("Erreur de mise à jour du statut:", e);
        } finally {
            setIsMutating(false);
        }
    };

    // --- RENDER ---

    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95 duration-300">
            <button
                onClick={onClose}
                className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
            >
                <ChevronLeft size={20} className="mr-1" /> Retour
            </button>

            <Card className="border-t-4 border-t-blue-500 shadow-2xl relative">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge type={workout.type} />
                            <span className="text-slate-500 text-sm flex items-center">
                                <Clock size={14} className="mr-1" /> {workout.duration} min
                            </span>
                            <span className="text-slate-500 text-sm flex items-center">
                                <Zap size={14} className="mr-1" /> TSS: {workout.tss || '-'}
                            </span>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-1">{workout.title}</h1>
                        <p className="text-slate-400 text-sm">{formatDate(workout.date)}</p>
                    </div>

                    {workout.status === 'completed' && workout.completedData && (
                        <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-2 text-right">
                            <div className="text-xs text-emerald-400 font-bold uppercase mb-1">Accompli</div>
                            <div className="text-white text-sm font-mono">{workout.completedData.avgPower}W</div>
                            <div className="text-slate-400 text-xs">RPE: {workout.completedData.rpe}/10</div>
                        </div>
                    )}
                </div>

                {/* Barre d'outils secondaire : Mode, Déplacer, Régénérer */}
                {workout.type !== 'Rest' && (
                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4 flex-wrap gap-2 min-h-[50px]">

                        {/* Si on est en mode "Input Régénération", on affiche le formulaire ici */}
                        {showRegenInput ? (
                            <div className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                                <input
                                    type="text"
                                    placeholder="Ex: Plus facile, 30min max, VO2 Max..."
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded text-sm px-3 py-1 text-white focus:border-amber-500 focus:outline-none"
                                    value={regenInstruction}
                                    onChange={(e) => setRegenInstruction(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleRegenerateClick()}
                                />
                                <Button
                                    variant="ghost"
                                    className="text-slate-400 hover:text-white"
                                    onClick={() => setShowRegenInput(false)}
                                    disabled={isMutating}
                                >
                                    <X size={16} />
                                </Button>
                                <Button
                                    variant="ghost" // ou un style spécial genre bg-amber-600
                                    className="text-amber-400 hover:text-amber-300 bg-amber-900/20 hover:bg-amber-900/40"
                                    onClick={handleRegenerateClick}
                                    disabled={isMutating}
                                >
                                    {isRegenerating ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                                </Button>
                            </div>
                        ) : (
                            /* Sinon on affiche les boutons normaux */
                            <>
                                <div className="flex gap-2">
                                    {/* ... Boutons Mode et Déplacer inchangés ... */}
                                    <Button variant="ghost" className="..." onClick={handleToggle} icon={ModeIcon} disabled={isMutating}>
                                        Mode: {workout.mode === 'Outdoor' ? 'Extérieur' : 'Home Trainer'}
                                    </Button>
                                    <Button variant="ghost" className="..." onClick={() => setIsMoving(!isMoving)} icon={CalendarDays} disabled={isMutating}>
                                        Déplacer
                                    </Button>
                                </div>

                                {workout.status === 'pending' && (
                                    <Button
                                        variant="ghost"
                                        className="text-sm h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                                        onClick={() => setShowRegenInput(true)} // On active le mode input au lieu de lancer direct
                                        disabled={isMutating}
                                    >
                                        <RefreshCw size={14} className="mr-2" />
                                        Régénérer
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Modal de déplacement */}
                {isMoving && (
                    <div className="mb-6 bg-slate-900 border border-slate-700 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-bold text-white mb-2 flex items-center">
                            <CalendarDays size={16} className="mr-2 text-blue-400" /> Déplacer la séance
                        </h4>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-sm flex-1"
                                onChange={(e) => setNewMoveDate(e.target.value)}
                            />
                            <Button
                                variant="secondary"
                                className="py-1 text-sm"
                                onClick={() => setIsMoving(false)}
                                disabled={isMutating}
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="primary"
                                className="py-1 text-sm"
                                disabled={isMutating || !newMoveDate || newMoveDate === workout.date}
                                onClick={handleMove}
                            >
                                {isMutating ? "Valider" : "Déplacer"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmation Suppression */}
                {showDeleteConfirm && (
                    <div className="mb-6 bg-red-900/20 border border-red-500/50 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center">
                            <AlertTriangle size={16} className="mr-2" /> Êtes-vous sûr de vouloir supprimer cette séance ?
                        </h4>
                        <p className="text-xs text-red-300 mb-3">Cette action est irréversible.</p>
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="secondary"
                                className="py-1 text-sm"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isMutating}
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="danger"
                                className="py-1 text-sm bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleDeleteClick}
                                disabled={isMutating}
                                icon={Trash2}
                            >
                                {isMutating ? "Suppression..." : "Confirmer la suppression"}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="bg-slate-900/50 rounded-xl p-6 mb-8 border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Activity size={20} className="mr-2 text-blue-400" />
                        Structure de la séance ({workout.mode})
                    </h3>
                    <div className="prose prose-invert max-w-none text-slate-300 whitespace-pre-line leading-relaxed font-mono text-sm">
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-700">
                        {/* Boutons Status standard */}
                        {workout.status !== 'completed' && !showDeleteConfirm && (
                            <Button
                                variant="success"
                                onClick={() => setIsCompleting(true)}
                                className="flex items-center justify-center md:col-span-2"
                                disabled={isMutating}
                            >
                                <CheckCircle size={16} className="mr-2" /> J&apos;ai fait la séance
                            </Button>
                        )}

                        {workout.status === 'completed' && !showDeleteConfirm && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => handleStatusUpdate('pending')}
                                    disabled={isMutating}
                                >
                                    Réinitialiser
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsEditing(true)}
                                    disabled={isMutating}
                                    icon={Edit}
                                >
                                    Modifier
                                </Button>
                            </>
                        )}

                        {/* Boutons Missed et Delete (Affichés si pas de confirmation en cours) */}
                        {!showDeleteConfirm && workout.status !== 'completed' && (
                            <>
                                {workout.status !== 'missed' ? (
                                    <Button
                                        variant="danger"
                                        onClick={() => handleStatusUpdate('missed')}
                                        disabled={isMutating}
                                    >
                                        <XCircle size={16} className="mr-2" /> Raté
                                    </Button>
                                ) : (
                                    // Placeholder si déjà raté pour garder l'alignement ou bouton reactiver
                                    <Button variant="outline" onClick={() => handleStatusUpdate('pending')} disabled={isMutating}>
                                        Réactiver
                                    </Button>
                                )}

                                {/* Bouton Supprimer */}
                                <Button
                                    variant="ghost"
                                    className="text-slate-400 hover:text-red-400 hover:bg-red-900/10 border border-transparent hover:border-red-900/30"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={isMutating}
                                    icon={Trash2}
                                >
                                    Supprimer
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};