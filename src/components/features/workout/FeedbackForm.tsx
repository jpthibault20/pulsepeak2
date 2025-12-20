import { Workout, Profile } from "@/lib/data/type";
import { CheckCircle, Activity, Timer, TrendingUp, StickyNote } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button"; // Assure-toi que le chemin est bon

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
        <div className="bg-slate-800/90 backdrop-blur-sm p-4 sm:p-5 rounded-xl border border-emerald-500/30 mt-4 animate-in fade-in slide-in-from-top-2 shadow-xl">
            <h4 className="text-emerald-400 font-bold mb-4 flex items-center text-base sm:text-lg">
                <CheckCircle size={20} className="mr-2" /> Rapport de séance
            </h4>

            {/* DESIGN: grid-cols-1 sur mobile pour des inputs larges, grid-cols-2 sur sm (tablette/desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

                {/* RPE */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <Activity size={12} className="text-slate-500" /> RPE (Difficulté 1-10)
                    </label>
                    <input
                        type="number" min="1" max="10"
                        value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))}
                        // DESIGN: h-11 pour le tactile
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-mono text-lg"
                    />
                </div>

                {/* Puissance */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <TrendingUp size={12} className="text-slate-500" /> Puissance Moy. (Watts)
                    </label>
                    <input
                        type="number"
                        value={avgPower} onChange={(e) => setAvgPower(parseInt(e.target.value))}
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-mono text-lg"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Durée */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <Timer size={12} className="text-slate-500" /> Durée Réelle (min)
                    </label>
                    <input
                        type="number"
                        value={actualDuration} onChange={(e) => setActualDuration(parseInt(e.target.value))}
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-mono text-lg"
                    />
                </div>

                {/* Distance */}
                <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        Distance (km)
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        value={distance} onChange={(e) => setDistance(parseFloat(e.target.value))}
                        className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all font-mono text-lg"
                    />
                </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                    <StickyNote size={12} className="text-slate-500" /> Sensations / Notes
                </label>
                <textarea
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaires sur la forme, la météo, la douleur..."
                    // DESIGN: h-24 sur mobile pour écrire confortablement
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm h-24 resize-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="flex-1 h-11 sm:h-10 text-sm border border-slate-700 hover:bg-slate-800"
                    disabled={isSaving}
                >
                    Annuler
                </Button>
                <Button
                    variant="success" // Assure-toi que ta variante 'success' existe dans ton UI kit, sinon utilise 'primary' + classe bg-emerald
                    className="flex-1 h-11 sm:h-10 text-sm font-semibold shadow-lg shadow-emerald-900/20 bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? "Enregistrement..." : "Valider la séance"}
                </Button>
            </div>
        </div>
    );
};