import { Card } from "@/components/ui/Card";
import { SectionHeader } from "./SessionHeader";
import { Activity, Heart, Timer, Zap } from "lucide-react";
import { TabButton } from "./TabButton";
import { Dispatch, SetStateAction, useState } from "react";
import { Profile } from "@/lib/data/type";
import { Button } from "@/components/ui/Button";

interface CalibrationTestProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

export const CalibrationTest : React.FC<CalibrationTestProps> = ({ formData, setFormData }) => {
    const [activeZoneTab, setActiveZoneTab] = useState<'power' | 'hr' | 'pace'>('power');
    
    return (
        <>
            <Card className="p-0 bg-slate-900/50 border-slate-800 overflow-hidden">
                <div className="p-6 pb-0">
                    <SectionHeader icon={Zap} title="Physiologie & Zones" color="text-yellow-400" />
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-700 px-6 gap-2">
                    <TabButton
                        active={activeZoneTab === 'power'}
                        onClick={() => setActiveZoneTab('power')}
                        label="Puissance (Watt)"
                        icon={Zap}
                    />
                    <TabButton
                        active={activeZoneTab === 'hr'}
                        onClick={() => setActiveZoneTab('hr')}
                        label="Cardio (FC)"
                        icon={Heart}
                    />
                    <TabButton
                        active={activeZoneTab === 'pace'}
                        onClick={() => setActiveZoneTab('pace')}
                        label="Allure (Pace)"
                        icon={Timer}
                    />
                </div>

                <div className="p-6 bg-slate-900/80 min-h-[250px]">
                    {activeZoneTab === 'power' && (
                        <div className="animate-in fade-in slide-in-from-left-4">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-slate-400">Basé sur votre FTP vélo.</p>
                                <div className="text-orange-400 font-mono text-xl font-bold">{formData.ftp} W <span className="text-xs text-slate-500 font-normal">FTP</span></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                {/* Inputs simplifiés pour l'exemple */}
                                <div>
                                    <label className="text-xs text-slate-500">Test 5 min (Watts)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formData.powerTests?.p5min ?? ''}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            powerTests: {
                                                p8min: 0,
                                                p15min: 0,
                                                p20min: 0,
                                                ...prev.powerTests, // ✅ Garde les valeurs existantes
                                                p5min: parseInt(e.target.value, 10) || 0, // ✅ Override p5min
                                            }
                                        }))}
                                        className="input-triathlon mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Test 20 min (Watts)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formData.powerTests?.p20min ?? ''}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            powerTests: {
                                                p8min: 0,
                                                p15min: 0,
                                                p5min: 0,
                                                ...prev.powerTests, // ✅ Garde les valeurs existantes
                                                p20min: parseInt(e.target.value, 10) || 0,
                                            }
                                        }))}
                                        className="input-triathlon mt-1"
                                    />                                </div>
                            </div>
                            <Button variant="secondary" className="w-full" icon={Activity}>Recalculer mes zones de puissance</Button>
                        </div>
                    )}

                    {activeZoneTab === 'hr' && (
                        <div className="animate-in fade-in slide-in-from-left-4 space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                                <Heart className="text-red-500" />
                                <div>
                                    <h4 className="text-red-200 font-medium">Seuil Anaérobie (LTHR)</h4>
                                    <p className="text-xs text-red-400/70">Essentiel pour calibrer l&apos;effort sur les 3 sports.</p>
                                </div>
                                <input
                                    type="number"
                                    value={formData.lthr}
                                    onChange={e => setFormData({ ...formData, lthr: parseInt(e.target.value) })}
                                    className="ml-auto w-20 h-10 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold text-lg"
                                />
                                <span className="text-slate-500 text-sm">bpm</span>
                            </div>
                            <div className="grid grid-cols-5 gap-1 mt-4">
                                {[50, 60, 70, 80, 90].map((pct, i) => (
                                    <div key={i} className="h-2 rounded bg-slate-700 overflow-hidden">
                                        <div className={`h-full bg-red-500`} style={{ width: `${i * 20 + 20}%`, opacity: (i + 1) * 0.2 }} />
                                    </div>
                                ))}
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-2">Zone 2 estimée : {Math.round(formData.lthr * 0.65)} - {Math.round(formData.lthr * 0.80)} bpm</p>
                        </div>
                    )}

                    {activeZoneTab === 'pace' && (
                        <div className="animate-in fade-in slide-in-from-left-4 text-center py-8">
                            <Timer size={40} className="mx-auto text-emerald-500 mb-3 opacity-50" />
                            <p className="text-slate-300">Entrez votre temps de référence récent</p>
                            <div className="flex justify-center gap-4 mt-4 max-w-sm mx-auto">
                                <select className="bg-slate-800 border-slate-700 text-white rounded px-3 py-2 outline-none">
                                    <option>5 km</option>
                                    <option>10 km</option>
                                    <option>Semi</option>
                                </select>
                                <input type="text" placeholder="00:45:00" className="bg-slate-800 border-slate-700 text-white rounded px-3 py-2 outline-none w-32 text-center" />
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </>
    );
}