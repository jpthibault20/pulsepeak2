import { Card } from "@/components/ui/Card";
import { Activity, Bike, Check, Footprints, Link2, Waves } from "lucide-react";
import { SectionHeader } from "./SessionHeader";
import React, { Dispatch, SetStateAction } from "react";
import { SportType } from "@/lib/data/type";
import { Profile } from "@/lib/data/DatabaseTypes";

interface SportsAndLinkAppProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

export const SportsAndAppLink: React.FC<SportsAndLinkAppProps> = ({ formData, setFormData }) => {

    const toggleSport = (sport: keyof typeof formData.activeSports) => {
        setFormData(prev => ({
            ...prev,
            activeSports: { ...prev.activeSports, [sport]: !prev.activeSports[sport] }
        }));
    };

    return (
        <div className="space-y-6">
            <Card className="p-6 bg-slate-900/50 border-slate-800">
                <SectionHeader icon={Activity} title="Disciplines" />
                <div className="space-y-3">
                    {[
                        { key: 'swimming', label: 'Natation', icon: Waves, color: 'text-cyan-400', bg: 'bg-cyan-950/30 border-cyan-800' },
                        { key: 'cycling', label: 'Cyclisme', icon: Bike, color: 'text-orange-400', bg: 'bg-orange-950/30 border-orange-800' },
                        { key: 'running', label: 'Running', icon: Footprints, color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800' },
                    ].map((sport) => (
                        <div
                            key={sport.key}
                            onClick={() => toggleSport(sport.key as SportType)}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${formData.activeSports[sport.key as keyof typeof formData.activeSports]
                                ? `${sport.bg} border-opacity-50`
                                : 'bg-slate-900 border-slate-800 opacity-60 grayscale'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <sport.icon className={sport.color} size={20} />
                                <span className="text-slate-200 font-medium">{sport.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

<Card className="p-3 bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
<div className="absolute top-0 right-0 w-11 h-11 bg-[#FC4C02] opacity-10 rounded-bl-full pointer-events-none" />
    {/* EN-TÊTE : Icone + Titre */}
    <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#FC4C02] rounded flex items-center justify-center text-white shrink-0">
            <svg role="img" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <title>Strava</title>
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
        </div>
        <span className="text-sm font-medium text-slate-200">Compte Strava</span>
    </div>

    {/* BAS : Action (Pleine largeur pour alignement propre) */}
    {formData.strava?.athleteId ? (
         <div className="w-full px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-default">
            <Check size={12} strokeWidth={3} />
            Connecté
        </div>
    ) : (
        <a
            href="/api/strava/login"
            className="w-full px-3 py-1.5 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all
            bg-[#FC4C02]/10 border border-[#FC4C02] 
            hover:bg-[#FC4C02] hover:text-white"
        >
            <Link2 size={12} />
            Connecter
        </a>
    )}
</Card>


        </div>
    );
}