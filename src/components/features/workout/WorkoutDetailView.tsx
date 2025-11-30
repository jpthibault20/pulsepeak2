'use client';

import React, { useState } from 'react';
import {
    Activity, Clock, Zap, Home, Mountain,
    ChevronLeft, CheckCircle, XCircle,
    CalendarDays,

    Edit
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
}

export const WorkoutDetailView: React.FC<WorkoutDetailViewProps> = ({
    workout,
    profile,
    onClose,
    onUpdate,
    onToggleMode,
    onMoveWorkout,
}) => {
    const [isCompleting, setIsCompleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false); // Nouvel état
    const [isMoving, setIsMoving] = useState(false);
    const [newMoveDate, setNewMoveDate] = useState('');
    const [isMutating, setIsMutating] = useState(false);

    const currentDescription = workout.mode === 'Outdoor'
        ? workout.description_outdoor
        : workout.description_indoor;

    const ModeIcon = workout.mode === 'Outdoor' ? Mountain : Home;

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

    const handleStatusUpdate = async (status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => {
        setIsMutating(true);
        try {
            await onUpdate(workout.date, status, feedback);
            setIsCompleting(false);
            setIsEditing(false); // Sortir du mode édition après sauvegarde
        } catch (e) {
            console.error("Erreur de mise à jour du statut:", e);
        } finally {
            setIsMutating(false);
        }
    };


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

                {/* Toggle Mode Home Trainer / Extérieur */}
                {workout.type !== 'Rest' && (
                    <div className="flex justify-end mb-4 border-b border-slate-700 pb-4 flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            className={`text-sm p-2 h-auto ${workout.mode === 'Indoor' ? 'border border-sky-500/30 bg-sky-900/20 text-sky-400' : 'text-slate-400'}`}
                            onClick={handleToggle}
                            icon={ModeIcon}
                            disabled={isMutating}
                        >
                            Mode: {workout.mode === 'Outdoor' ? 'Extérieur' : 'Home Trainer'}
                        </Button>
                        <Button variant="ghost" className="text-sm h-8" onClick={() => setIsMoving(!isMoving)} icon={CalendarDays} disabled={isMutating}>
                            Déplacer
                        </Button>
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

                <div className="bg-slate-900/50 rounded-xl p-6 mb-8 border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Activity size={20} className="mr-2 text-blue-400" />
                        Structure de la séance ({workout.mode})
                    </h3>
                    <div className="prose prose-invert max-w-none text-slate-300 whitespace-pre-line leading-relaxed font-mono text-sm">
                        {currentDescription}
                    </div>
                </div>

                {isCompleting || isEditing ? (
                    <FeedbackForm
                        workout={workout}
                        profile={profile}
                        onCancel={() => { setIsCompleting(false); setIsEditing(false); }}
                        onSave={(data) => handleStatusUpdate('completed', data)}
                    />
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-700">
                        {workout.status !== 'completed' && (
                            <Button
                                variant="success"
                                onClick={() => setIsCompleting(true)}
                                className="flex items-center justify-center"
                                disabled={isMutating}
                            >
                                <CheckCircle size={16} className="mr-2" /> J&apos;ai fait la séance
                            </Button>
                        )}

                        {workout.status === 'completed' && (
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

                        {/* Bouton Déplacer */}
                        {workout.status !== 'completed' && (
                            <Button
                                variant="secondary"
                                onClick={() => setIsMoving(!isMoving)}
                                className="flex items-center justify-center"
                                icon={CalendarDays}
                                disabled={isMutating}
                            >
                                Déplacer
                            </Button>
                        )}

                        {workout.status !== 'missed' && workout.status !== 'completed' && (
                            <Button
                                variant="danger"
                                onClick={() => handleStatusUpdate('missed')}
                                disabled={isMutating}
                            >
                                <XCircle size={16} className="mr-2" /> Raté
                            </Button>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};