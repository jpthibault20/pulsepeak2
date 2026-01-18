import { Card } from "@/components/ui";
import { aiPersonality, Profile } from "@/lib/data/type";
import { MessageSquare, Lock } from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import { SectionHeader } from "./SessionHeader";

interface GoalsProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

export const Goals: React.FC<GoalsProps> = ({ formData, setFormData }) => {

    return (
        <>
            {/* --- SURCOUCHE "À VENIR" --- */}
            <Card className="p-6 bg-slate-900/50 border-slate-800 border-t-4 border-t-purple-500">
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-full shadow-lg shadow-purple-900/20">
                        <Lock size={14} className="text-purple-300" />
                        <span className="text-sm font-semibold text-purple-200 uppercase tracking-wide">
                            Prochainement disponible
                        </span>
                    </div>
                </div>
                <SectionHeader icon={MessageSquare} title="Configuration du Coach IA" color="text-purple-400" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Objectif Principal</label>
                            <input
                                value={formData.goal}
                                onChange={e => setFormData({ ...formData, goal: e.target.value })}
                                className="input-triathlon"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Style de Coaching</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Strict', 'Encourageant', 'Analytique'].map(style => (
                                    <button
                                        key={style}
                                        onClick={() => setFormData({ ...formData, aiPersonality: style as aiPersonality })}
                                        className={`text-xs py-2 px-1 rounded border transition-all ${formData.aiPersonality === style
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20'
                                            : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Points faibles / Notes pour l&apos;IA</label>
                        <textarea
                            value={formData.weaknesses}
                            onChange={e => setFormData({ ...formData, weaknesses: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none h-32 resize-none text-sm"
                            placeholder="Ex: Je nage comme une enclume, j'ai peur des descentes en vélo..."
                        />
                    </div>
                </div>
            </Card>
        </>
    );
}