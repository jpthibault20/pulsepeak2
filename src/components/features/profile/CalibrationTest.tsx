import { Card } from "@/components/ui/Card";
import { SectionHeader } from "./SessionHeader";
import { Activity, Calculator, Heart, Timer, TrendingUp, Wind, Zap } from "lucide-react";
import { TabButton } from "./TabButton";
import { Dispatch, SetStateAction, useState } from "react";
import { PowerZones, Profile, RunningZones } from "@/lib/data/type";
import { Button } from "@/components/ui/Button";
import { saveAthleteProfile } from "@/app/actions/schedule";

interface CalibrationTestProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

export const CalibrationTest: React.FC<CalibrationTestProps> = ({ formData, setFormData }) => {
    const [activeZoneTab, setActiveZoneTab] = useState<'power' | 'hr' | 'pace'>('power');

    const handleTestChange = (key: 'p5min' | 'p8min' | 'p15min' | 'p20min', value: string) => {
        setFormData(prev => {
            const current = prev.powerTests ?? { p5min: 0, p8min: 0, p15min: 0, p20min: 0 };
            const updated = { ...current, [key]: parseInt(value) || 0 };
            return { ...prev, powerTests: updated };
        });
    };

    const calculateZones = () => {
        const p5 = formData.powerTests?.p5min || 0;
        const p8 = formData.powerTests?.p8min || 0;
        const p15 = formData.powerTests?.p15min || 0;
        const p20 = formData.powerTests?.p20min || 0;

        let estimatedFtp = 0;
        let wPrime = 0;
        let sourceUsed = '';
        let methodUsed = '';
        const testsUsed: string[] = [];

        const dataPoints: { t: number, w: number, p: number }[] = [];
        if (p5 > 0) { dataPoints.push({ t: 5 * 60, w: p5 * 5 * 60, p: p5 }); testsUsed.push('5min'); }
        if (p8 > 0) { dataPoints.push({ t: 8 * 60, w: p8 * 8 * 60, p: p8 }); testsUsed.push('8min'); }
        if (p15 > 0) { dataPoints.push({ t: 15 * 60, w: p15 * 15 * 60, p: p15 }); testsUsed.push('15min'); }
        if (p20 > 0) { dataPoints.push({ t: 20 * 60, w: p20 * 20 * 60, p: p20 }); testsUsed.push('20min'); }

        if (dataPoints.length >= 2) {
            let sumT = 0, sumW = 0, sumTW = 0, sumT2 = 0;
            const n = dataPoints.length;
            dataPoints.forEach(pt => {
                sumT += pt.t;
                sumW += pt.w;
                sumTW += pt.t * pt.w;
                sumT2 += pt.t * pt.t;
            });
            const slope = (n * sumTW - sumT * sumW) / (n * sumT2 - sumT * sumT);
            const intercept = (sumW - slope * sumT) / n;
            estimatedFtp = Math.round(slope);
            wPrime = Math.round(intercept);
            sourceUsed = `Modèle Puissance Critique (${testsUsed.join('+')})`;
            methodUsed = 'Critical Power Regression';
        } else {
            if (p20 > 0) { estimatedFtp = Math.round(p20 * 0.95); sourceUsed = '95% du CP20'; }
            else if (p15 > 0) { estimatedFtp = Math.round(p15 * 0.93); sourceUsed = '93% du CP15'; }
            else if (p8 > 0) { estimatedFtp = Math.round(p8 * 0.90); sourceUsed = '90% du CP8'; }
            else if (p5 > 0) { estimatedFtp = Math.round(p5 * 0.82); sourceUsed = '82% du CP5 (Estimatif)'; }
            else { alert("Veuillez entrer au moins une valeur de test."); return; }
            methodUsed = 'Single Test Estimation';
        }

        const newZones: PowerZones = {
            z1: { min: 0, max: Math.round(estimatedFtp * 0.55) },
            z2: { min: Math.round(estimatedFtp * 0.56), max: Math.round(estimatedFtp * 0.75) },
            z3: { min: Math.round(estimatedFtp * 0.76), max: Math.round(estimatedFtp * 0.90) },
            z4: { min: Math.round(estimatedFtp * 0.91), max: Math.round(estimatedFtp * 1.05) },
            z5: { min: Math.round(estimatedFtp * 1.06), max: Math.round(estimatedFtp * 1.20) },
            z6: { min: Math.round(estimatedFtp * 1.21), max: p5 > 0 ? p5 : Math.round(estimatedFtp * 1.50) },
            z7: { min: (p5 > 0 ? p5 : Math.round(estimatedFtp * 1.50)) + 1, max: 2000 }
        };

        const updatedProfile: Profile = {
            ...formData,
            ftp: estimatedFtp,
            zones: newZones,
            seasonData: {
                calculatedAt: new Date().toISOString(),
                wPrime: wPrime,
                criticalPower: estimatedFtp,
                method: methodUsed,
                sourceTests: testsUsed
            }
        };

        setFormData(updatedProfile);

        saveAthleteProfile(updatedProfile);
    };

    const calculateHrZones = () => {
        // On récupère la FC Max saisie
        const maxHr = formData.heartRate?.max || 0;

        if (maxHr < 100) return; // Sécurité pour éviter les calculs sur des valeurs absurdes

        // Modèle standard (Coggan modifié pour FC Max):
        // Z1: < 60% (Récup active)
        // Z2: 60-75% (Endurance)
        // Z3: 75-82% (Tempo)
        // Z4: 82-89% (Seuil Lactique)
        // Z5: > 89% (VO2 Max)

        const newHrZones = {
            z1: { min: 0, max: Math.round(maxHr * 0.60) },
            z2: { min: Math.round(maxHr * 0.61), max: Math.round(maxHr * 0.75) },
            z3: { min: Math.round(maxHr * 0.76), max: Math.round(maxHr * 0.82) },
            z4: { min: Math.round(maxHr * 0.83), max: Math.round(maxHr * 0.89) },
            z5: { min: Math.round(maxHr * 0.90), max: maxHr },
        };


                const updatedProfile: Profile = {
            ...formData,
            heartRate: {
                max: maxHr,
                zones: newHrZones
            }
        };

        setFormData(updatedProfile);

        saveAthleteProfile(updatedProfile);
    };

    // Helper pour mettre à jour la FC Max
    const handleFcMaxChange = (value: string) => {
        const val = parseInt(value) || 0;
        setFormData(prev => ({
            ...prev,
            heartRate: {
                ...prev.heartRate,
                max: val
            }
        }));
    };

    const handleVMAChange = (value: string) => {
        const val = parseInt(value) || 0;
        setFormData(prev => ({
            ...prev,
            running: {
                ...prev.running,
                vma: val
            }
        }));
    };

    const handleDistChange = (value: string) => {
        if (!value) return;
        setFormData(prev => ({
            ...prev,
            recentRaceTime: {
                ...prev.recentRaceTime,
                distance: value
            }
        }));
    };

    const handleTpsChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            recentRaceTime: {
                ...prev.recentRaceTime,
                time: value
            }
        }));
    };

    // Convertit des secondes (ex: 330) en chaine "5:30"
    const formatPace = (seconds: number): string => {
        if (!seconds || !isFinite(seconds)) return "--:--";
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60); // ou Math.floor si tu préfères
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const updateRunningZones = (vmaInput: number) => {
        if (!vmaInput || isNaN(vmaInput)) {
            // Si input vide, on garde la structure mais on vide la VMA pour éviter crash
            setFormData(prev => ({
                ...prev,
                running: { ...prev.running, vma: null, zones: undefined }
            }));
            return;
        }

        // 1. Définition des pourcentages (tu peux ajuster selon ta méthode préférée : Karvonen ou linéaire)
        // Ici méthode linéaire classique
        const percentages = {
            z1: [60, 70],   // 60% à 70% VMA
            z2: [70, 75],
            z3: [75, 85],
            z4: [85, 95],
            z5: [95, 110]
        };

        // 2. Fonction helper pour convertir VMA + % -> Allure (sec/km)
        // Attention : Plus le % est haut, plus le temps (sec/km) est BAS.
        const getPace = (pct: number) => {
            const speedKmh = vmaInput * (pct / 100);
            return Math.round(3600 / speedKmh);
        };

        // 3. Construction des zones
        const newZones: RunningZones = {
            z1: { min: getPace(percentages.z1[0]), max: getPace(percentages.z1[1]) },
            z2: { min: getPace(percentages.z2[0]), max: getPace(percentages.z2[1]) },
            z3: { min: getPace(percentages.z3[0]), max: getPace(percentages.z3[1]) },
            z4: { min: getPace(percentages.z4[0]), max: getPace(percentages.z4[1]) },
            z5: { min: getPace(percentages.z5[0]), max: getPace(percentages.z5[1]) },
        };

                const updatedProfile: Profile = {
            ...formData,
            running: {
                // On s'assure que running existe
                vma: vmaInput,
                zones: newZones
            }
        };

        setFormData(updatedProfile);

        saveAthleteProfile(updatedProfile);
    };

    const RUNNING_COLORS = {
        z1: 'border-emerald-500 text-emerald-400', // Vert doux
        z2: 'border-cyan-500 text-cyan-400',       // Cyan (Base)
        z3: 'border-blue-500 text-blue-400',       // Bleu
        z4: 'border-orange-500 text-orange-400',   // Orange
        z5: 'border-red-500 text-red-400',         // Rouge
    };

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
                    {/* Power Zones */}
                    {activeZoneTab === 'power' && (
                        <div className="animate-in fade-in slide-in-from-left-4">
                            <div className="bg-slate-900/50 p-3 md:p-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Zap size={16} className="text-yellow-500" /> Tests de Puissance (Watts Moyens)
                                    </h4>
                                    {formData.ftp > 0 && <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">FTP: {formData.ftp}W</span>}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                                    {[
                                        { label: '5 min (PMA)', key: 'p5min' as const },
                                        { label: '8 min', key: 'p8min' as const },
                                        { label: '15 min', key: 'p15min' as const },
                                        { label: '20 min (FTP)', key: 'p20min' as const, highlight: true }
                                    ].map((test) => (
                                        <div key={test.key}>
                                            <label className="block text-xs text-slate-400 mb-1 text-center">{test.label}</label>
                                            <input
                                                type="number"
                                                value={formData.powerTests?.[test.key] || ''}
                                                onChange={e => handleTestChange(test.key, e.target.value)}
                                                className={`
                            w-full h-10 md:h-9 bg-slate-800 border border-slate-600 rounded p-2 text-white text-center focus:border-blue-500 outline-none
                            ${test.highlight ? 'border-l-2 border-l-blue-500 font-semibold' : ''}
                        `}
                                                placeholder="---"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <Button variant="secondary" onClick={calculateZones} className="w-full py-3 md:py-2 text-sm mb-4 h-auto" icon={Calculator}>
                                    Calculer FTP & Zones
                                </Button>

                                {/* Affichage des zones calculées */}
                                {formData.zones && (
                                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-700">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                            <span className="text-sm text-slate-300">Nouvelle FTP: <span className="font-bold text-white text-lg">{formData.ftp} W</span></span>
                                            <span className="text-sm text-slate-300">Ratio: <span className="font-bold text-emerald-400">{formData.weight ? (formData.ftp / formData.weight).toFixed(2) : '-'} W/kg</span></span>
                                        </div>

                                        {formData.seasonData?.wPrime && formData.seasonData.wPrime > 0 && (
                                            <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded mb-2 text-xs text-slate-400 border border-slate-600/30">
                                                <TrendingUp size={12} className="text-orange-400" />
                                                <span>W&apos; (Anaérobie): <span className="text-orange-300 font-mono">{formData.seasonData.wPrime} J</span></span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center">
                                            {[
                                                { label: 'Z1', name: 'Récup', val: formData.zones.z1, color: 'border-gray-400 text-gray-300' },
                                                { label: 'Z2', name: 'Endur.', val: formData.zones.z2, color: 'border-green-500 text-green-400' },
                                                { label: 'Z3', name: 'Tempo', val: formData.zones.z3, color: 'border-blue-500 text-blue-400' },
                                                { label: 'Z4', name: 'Seuil', val: formData.zones.z4, color: 'border-yellow-500 text-yellow-400' },
                                                { label: 'Z5', name: 'PMA', val: formData.zones.z5, color: 'border-orange-500 text-orange-400' },
                                                { label: 'Z6', name: 'Anaé.', val: formData.zones.z6, color: 'border-red-500 text-red-400' },
                                                { label: 'Z7', name: 'Neuro', val: formData.zones.z7, color: 'border-purple-500 text-purple-400' },
                                            ].map((zone, idx) => (
                                                <div key={zone.label} className={`
                    bg-slate-800/40 p-2 rounded border-t-2 flex flex-col justify-center min-h-[60px]
                    ${zone.color.split(' ')[0]}
                    ${/* La dernière case prend toute la largeur sur mobile impair pour éviter le trou */ idx === 6 ? 'col-span-2 sm:col-span-1' : ''}
                  `}>
                                                    <div className="flex justify-between items-center md:block">
                                                        <div className={`font-bold text-xs ${zone.color.split(' ')[1]}`}>{zone.label}</div>
                                                        <div className="text-[10px] text-slate-500 uppercase md:mb-1">{zone.name}</div>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-white mt-1 md:mt-0">
                                                        {zone.label === 'Z1' ? `<${zone.val.max}` : zone.label === 'Z7' ? `>${zone.val.min}` : `${zone.val.min}-${zone.val.max}`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* HR Zones */}
                    {/* --- ZONES CARDIAQUES (HEART RATE) --- */}
                    {activeZoneTab === 'hr' && (
                        <div className="animate-in fade-in slide-in-from-right-4">
                            <div className="bg-slate-900/50 p-3 md:p-4 rounded-lg">

                                {/* Header */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Heart size={16} className="text-red-500" /> Paramètres Cardiaques
                                    </h4>
                                </div>

                                {/* Input FC Max */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">
                                            FC Max (Battements/min)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={formData.heartRate?.max || ''}
                                                onChange={e => handleFcMaxChange(e.target.value)}
                                                className="w-full h-10 md:h-11 bg-slate-800 border border-slate-600 rounded p-2 pl-10 text-white font-bold text-lg focus:border-red-500 outline-none"
                                                placeholder="ex: 185"
                                            />
                                            <Activity className="absolute left-3 top-3 text-slate-500" size={18} />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 italic">
                                            Utilisé pour calculer vos zones d&apos;intensité cardiaque.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    variant="secondary"
                                    onClick={calculateHrZones}
                                    className="w-full py-3 md:py-2 text-sm mb-4 h-auto hover:bg-red-500/20 hover:text-red-200 hover:border-red-500/50 transition-colors"
                                    icon={Calculator}
                                >
                                    Calculer Zones FC
                                </Button>

                                {/* Affichage des zones calculées */}
                                {formData.heartRate?.zones && (
                                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-700">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-300">FC Max configurée: <span className="font-bold text-white text-lg">{formData.heartRate.max} bpm</span></span>
                                        </div>

                                        {/* Grid 5 colonnes pour les 5 zones FC */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-center">
                                            {[
                                                { label: 'Z1', name: 'Récup', val: formData.heartRate.zones.z1, color: 'border-gray-400 text-gray-300' },
                                                { label: 'Z2', name: 'Endur.', val: formData.heartRate.zones.z2, color: 'border-green-500 text-green-400' },
                                                { label: 'Z3', name: 'Tempo', val: formData.heartRate.zones.z3, color: 'border-blue-500 text-blue-400' },
                                                { label: 'Z4', name: 'Seuil', val: formData.heartRate.zones.z4, color: 'border-yellow-500 text-yellow-400' },
                                                { label: 'Z5', name: 'Max', val: formData.heartRate.zones.z5, color: 'border-red-500 text-red-400' },
                                            ].map((zone, idx) => (
                                                <div key={zone.label} className={`
                                                    bg-slate-800/40 p-2 rounded border-t-2 flex flex-col justify-center min-h-[60px]
                                                    ${zone.color.split(' ')[0]}
                                                    ${/* Gestion responsive pour la dernière case si nombre impair */ idx === 4 ? 'col-span-2 sm:col-span-1 md:col-span-1' : ''}
                                                `}>
                                                    <div className="flex justify-between items-center md:block">
                                                        <div className={`font-bold text-xs ${zone.color.split(' ')[1]}`}>{zone.label}</div>
                                                        <div className="text-[10px] text-slate-500 uppercase md:mb-1">{zone.name}</div>
                                                    </div>
                                                    <div className="text-[11px] font-mono text-white mt-1 md:mt-0 font-bold">
                                                        {zone.label === 'Z1' ? `< ${zone.val.max}` : `${zone.val.min} - ${zone.val.max}`} <span className="text-[9px] text-slate-500 font-normal">bpm</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* Pace Zones */}
                    {/* --- SECTION RUNNING / VMA --- */}
                    {/* --- 6. Course à Pied (Allure / VMA) --- */}
                    {activeZoneTab === 'pace' && (
                        <div className="animate-in fade-in slide-in-from-right-4">
                            <div className="bg-slate-900/50 p-3 md:p-4">

                                {/* Header identique à Power */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Wind size={16} className="text-cyan-400" /> {/* Icône Vent/Vitesse */}
                                        Profil Allure (VMA)
                                    </h4>
                                    {formData.running?.vma && (
                                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">
                                            VMA: <span className="text-white font-bold">{formData.running.vma} km/h</span>
                                        </span>
                                    )}
                                </div>

                                {/* Inputs Grid : Design "Dense" comme Power */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4">

                                    {/* 1. VMA Directe */}
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1 text-center">VMA Directe (km/h)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ex: 16.5"
                                            value={formData.running?.vma || ''}
                                            onChange={e => handleVMAChange(e.target.value)}
                                            // onChange={(e) => updateRunningZones(parseFloat(e.target.value))}
                                            className="w-full h-10 md:h-9 bg-slate-800 border border-slate-600 rounded p-2 text-white text-center focus:border-cyan-500 outline-none "
                                        />
                                    </div>

                                    {/* 2. Données de Test (Séparateur visuel implicite via le grid) */}
                                    <div className="sm:col-span-2 bg-slate-800/30 rounded border border-slate-700/50 p-2 flex gap-3 items-end">
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-slate-400 mb-1 text-center">Test Distance (km)</label>
                                            <input
                                                type="text"
                                                value={formData.recentRaceTime?.distance || ''}
                                                onChange={e => handleDistChange(e.target.value)}
                                                placeholder="10"
                                                className="w-full h-8 bg-slate-900 border border-slate-700 rounded px-2 text-white text-xs text-center focus:border-cyan-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-slate-400 mb-1 text-center">Temps (mm:ss)</label>
                                            <input
                                                type="text"
                                                value={formData.recentRaceTime?.time || ''}
                                                onChange={e => handleTpsChange(e.target.value)}
                                                placeholder="06:00"
                                                className="w-full h-8 bg-slate-900 border border-slate-700 rounded px-2 text-white text-xs text-center focus:border-cyan-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bouton de calcul : Identique Power mais couleur Cyan */}
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        const dist = formData.recentRaceTime?.distance;
                                        const time = formData.recentRaceTime?.time;
                                        const runTestVMA = formData.running?.vma;

                                        // Logique de parsage rapide
                                        if (runTestVMA) {
                                            updateRunningZones(Math.round(runTestVMA * 10) / 10);
                                        }
                                        else if (dist && time) {
                                            const [m, s] = time.split(':').map(Number);
                                            const totalSec = (m * 60) + (s || 0);
                                            if (totalSec > 0) {
                                                const vmaCalc = (parseFloat(dist) * 1000 / totalSec) * 3.6;
                                                updateRunningZones(Math.round(vmaCalc * 10) / 10);
                                            }
                                        }

                                    }}
                                    className="w-full py-3 md:py-2 text-sm mb-4 h-auto hover:bg-slate-800 border-slate-700"
                                    icon={Calculator}
                                >
                                    Calculer VMA depuis Perf
                                </Button>

                                {/* --- ZONES RESULTS --- */}
                                {formData.running?.zones && (
                                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-700">

                                        {/* Metrics Summary Row */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
                                            <span className="text-sm text-slate-300">
                                                VMA: <span className="font-bold text-white text-lg">{formData.running.vma} km/h</span>
                                            </span>
                                            <span className="text-sm text-slate-300">
                                                Allure VMA: <span className="font-bold text-cyan-400 font-mono">
                                                    {formatPace(3600 / (formData.running.vma || 1))}/km
                                                </span>
                                            </span>
                                        </div>

                                        {/* ZONES GRID : Copie conforme du style Power */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-center">
                                            {[
                                                { label: 'Z1', name: 'Endu. Fond.', val: formData.running.zones.z1, style: RUNNING_COLORS.z1 },
                                                { label: 'Z2', name: 'Endu. Act.', val: formData.running.zones.z2, style: RUNNING_COLORS.z2 },
                                                { label: 'Z3', name: 'Tempo', val: formData.running.zones.z3, style: RUNNING_COLORS.z3 },
                                                { label: 'Z4', name: 'Seuil', val: formData.running.zones.z4, style: RUNNING_COLORS.z4 },
                                                { label: 'Z5', name: 'VMA', val: formData.running.zones.z5, style: RUNNING_COLORS.z5 },
                                            ].map((zone, idx) => (
                                                <div key={zone.label} className={`
                                bg-slate-800/40 p-2 rounded border-t-2 flex flex-col justify-center min-h-[60px]
                                ${zone.style.split(' ')[0]} {/* Border color */}
                                ${/* Gestion responsive pour la dernière case impaire */ idx === 4 ? 'col-span-2 sm:col-span-1 md:col-span-1' : ''}
                            `}>
                                                    <div className="flex justify-between items-center md:block">
                                                        <div className={`font-bold text-xs ${zone.style.split(' ')[1]}`}>{zone.label}</div>
                                                        <div className="text-[10px] text-slate-500 uppercase md:mb-1">{zone.name}</div>
                                                    </div>

                                                    {/* Affichage Allure : Du plus lent (chiffre haut) au plus rapide (chiffre bas) */}
                                                    <div className="text-[11px] font-mono text-white mt-1 md:mt-0 font-bold">
                                                        {formatPace(zone.val.min)} - {formatPace(zone.val.max)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="text-[10px] text-slate-600 text-center italic mt-1">
                                            Allures en min/km • Basé sur % VMA Linéaire
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </Card>
        </>
    );
}