import { Workout, Profile } from "@/lib/data/type";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

export const FeedbackForm: React.FC<{
    workout: Workout;
    profile: Profile;
    onSave: (feedback: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => Promise<void>;
    onCancel: () => void;
}> = ({ workout, profile, onSave, onCancel }) => {
    // Modification ici pour utiliser les valeurs existantes si on est en mode édition
    const [rpe, setRpe] = useState(workout.completedData?.rpe || 6);
    const [avgPower, setAvgPower] = useState(workout.completedData?.avgPower || (profile.ftp ? Math.round(profile.ftp * 0.7) : 150));
    const [notes, setNotes] = useState(workout.completedData?.notes || '');
    const [actualDuration, setActualDuration] = useState(workout.completedData?.actualDuration || workout.duration);
    const [distance, setDistance] = useState(workout.completedData?.distance || 0);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ rpe, avgPower, actualDuration, distance, notes });
        } catch (e) {
            console.error("Erreur d'enregistrement du feedback:", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 mt-4 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-emerald-400 font-bold mb-4 flex items-center">
                <CheckCircle size={18} className="mr-2" /> Rapport de séance
            </h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">RPE (1-10)</label>
                    <input
                        type="number" min="1" max="10"
                        value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Puissance Moyenne (W)</label>
                    <input
                        type="number"
                        value={avgPower} onChange={(e) => setAvgPower(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Durée Réelle (min)</label>
                    <input
                        type="number"
                        value={actualDuration} onChange={(e) => setActualDuration(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Distance (km)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={distance} onChange={(e) => setDistance(parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-1">Sensations / Notes</label>
                <textarea
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaires..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm h-20 resize-none"
                />
            </div>
            <div className="flex gap-2">
                <Button variant="ghost" onClick={onCancel} className="flex-1 h-10 py-0 text-sm" disabled={isSaving}>Annuler</Button>
                <Button
                    variant="success"
                    className="flex-1 h-10 py-0 text-sm"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
            </div>
        </div>
    );
};