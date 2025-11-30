import { Card, Button } from "@/components/ui";
import { Workout } from "@/lib/data/type";
import { Plus } from "lucide-react";
import { useState } from "react";

interface ManualWorkoutModalProps {
    date: Date;
    onClose: () => void;
    onSave: (workout: Workout) => Promise<void>;
}

export const ManualWorkoutModal: React.FC<ManualWorkoutModalProps> = ({ date, onClose, onSave }) => {
    const [title, setTitle] = useState('Sortie Libre');
    const [type, setType] = useState('Endurance');
    const [duration, setDuration] = useState(0);
    const [distance, setDistance] = useState(0); // Nouvel état pour la distance
    const [tss, setTss] = useState(0);
    const [mode, setMode] = useState<'Outdoor' | 'Indoor'>('Outdoor');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const newWorkout: Workout = {
                date: dateStr,
                title,
                type,
                duration,
                distance,
                tss,
                mode,
                status: 'completed', // Marqué comme fait
                description_outdoor: mode === 'Outdoor' ? description : 'Non spécifié',
                description_indoor: mode === 'Indoor' ? description : 'Non spécifié',
                completedData: {
                    actualDuration: duration, // On assume que le réalisé = le saisi
                    distance: distance,       // On assume que le réalisé = le saisi
                    rpe: 5,                   // Valeur par défaut neutre
                    avgPower: 0,              // Valeur par défaut (pas de saisie de puissance ici)
                    notes: description
                }
            };

            await onSave(newWorkout);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-70 flex items-center justify-center p-4">
            <Card className="max-w-md w-full animate-in zoom-in-95">
                <h2 className="text-xl font-bold text-white mb-4">Ajouter une activité manuelle</h2>
                <p className="text-slate-400 text-sm mb-6">Pour le {date.toLocaleDateString('fr-FR')}</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Titre de la séance</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                                {['Endurance', 'Tempo', 'Threshold', 'HIIT', 'VO2max', 'Recovery', 'PMA', 'Force', 'Sprint'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Mode</label>
                            <select value={mode} onChange={e => setMode(e.target.value as 'Outdoor' | 'Indoor')} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                                <option value="Outdoor">Extérieur</option>
                                <option value="Indoor">Home Trainer</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Durée (min)</label>
                            <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Distance (km)</label>
                            <input type="number" step="0.1" value={distance} onChange={e => setDistance(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">TSS Estimé</label>
                        <input type="number" value={tss} onChange={e => setTss(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Description / Notes</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white h-20 resize-none" placeholder="Détails de la sortie..." />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>Annuler</Button>
                    <Button variant="primary" className="flex-1" onClick={handleSave} disabled={isSaving} icon={Plus}>Ajouter</Button>
                </div>
            </Card>
        </div>
    );
};