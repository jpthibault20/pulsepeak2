import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Activity, Bike, Check, Footprints, Link2, Waves } from "lucide-react";
import { SectionHeader } from "./SessionHeader";
import React, { Dispatch, SetStateAction } from "react";
import { Profile, SportType } from "@/lib/data/type";

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
                                    {formData.activeSports[sport.key as keyof typeof formData.activeSports] && <Check size={16} className={sport.color} />}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-4 bg-slate-900/50 border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#FC4C02] opacity-10 rounded-bl-full pointer-events-none" />
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-[#FC4C02] rounded flex items-center justify-center text-white font-bold">S</div>
                            <div className="text-sm font-semibold text-white">Compte Strava</div>
                        </div>
                        {formData.strava?.athleteId ? (
                            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-950/30 p-2 rounded border border-green-900">
                                <Check size={14} /> Connecté
                            </div>
                        ) : (
                            <Button className="w-full bg-[#FC4C02] hover:bg-[#E34402] text-white h-9 text-sm" icon={Link2}>
                                Lier mon compte
                            </Button>
                        )}
                    </Card>
                </div>
    );
}