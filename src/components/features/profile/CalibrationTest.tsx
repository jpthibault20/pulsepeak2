import { Card } from "@/components/ui/Card";
import { SectionHeader } from "./SessionHeader";
import { Activity, Calculator, Heart, Timer, TrendingUp, Wind, Zap } from "lucide-react";
import { TabButton } from "./TabButton";
import { Dispatch, SetStateAction, useState } from "react";
import { CyclingTest, Zones } from "@/lib/data/type";
import { Button } from "@/components/ui/Button";
import { saveAthleteProfile } from "@/app/actions/schedule";
import { calculateFtp, validatePowerTests, getTestPrecision } from "@/lib/ftp-calculator";
import { Profile } from "@/lib/data/DatabaseTypes";

interface CalibrationTestProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatPace = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ─── Zone display component ────────────────────────────────────────────────

interface ZoneBarProps {
    label: string;
    name: string;
    value: string;
    color: string;       // tailwind border + text color
    accent: string;      // tailwind bg for the label badge
}

const ZoneBar: React.FC<ZoneBarProps> = ({ label, name, value, color, accent }) => (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 group hover:border-slate-300 dark:hover:border-slate-600 transition-colors`}>
        <span className={`shrink-0 w-9 h-9 rounded-lg ${accent} flex items-center justify-center text-xs font-black tracking-tight`}>
            {label}
        </span>
        <div className="flex-1 min-w-0">
            <span className={`text-xs font-semibold ${color}`}>{name}</span>
        </div>
        <span className="text-sm font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {value}
        </span>
    </div>
);

// ─── Input field component ─────────────────────────────────────────────────

interface FieldProps {
    label: string;
    value: string | number;
    onChange: (val: string) => void;
    placeholder?: string;
    type?: string;
    step?: string;
    unit?: string;
    highlight?: boolean;
    icon?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, placeholder, type = "number", step, unit, highlight, icon }) => (
    <div>
        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
        <div className="relative">
            {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
            <input
                type={type}
                step={step}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className={`
                    w-full h-10 bg-white dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-white text-center text-sm font-medium
                    focus:outline-none focus:ring-2 transition-all
                    ${icon ? 'pl-10' : 'px-3'}
                    ${highlight
                        ? 'border-blue-300 dark:border-blue-500/40 focus:ring-blue-500/30 focus:border-blue-500'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-slate-400/30 focus:border-slate-400'
                    }
                `}
            />
            {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">{unit}</span>}
        </div>
    </div>
);

// ─── Main Component ────────────────────────────────────────────────────────

export const CalibrationTest: React.FC<CalibrationTestProps> = ({ formData, setFormData }) => {

    const [activeZoneTab, setActiveZoneTab] = useState<'power' | 'hr' | 'pace'>('power');
    const [runInputMode, setRunInputMode] = useState<'vma' | 'race'>('vma');

    // ── Cycling handlers ────────────────────────────────────────────────────

    const handleTestChange = (
        key: keyof Pick<CyclingTest, 'ftp' | 'p5min' | 'p8min' | 'p15min' | 'p20min'>,
        value: string
    ) => {
        setFormData(prev => {
            const currentCycling = { ...prev.cycling };
            const currentTest = currentCycling.Test ?? {
                seasonData: {
                    calculatedAt: new Date().toISOString(),
                    wPrime: 0, criticalPower: 0,
                    method: 'Single Test Estimation', sourceTests: []
                }
            };

            const numericValue = value === '' ? undefined : parseInt(value) || 0;
            const updatedTest = { ...currentTest, [key]: numericValue };

            if (key === 'ftp') {
                updatedTest.seasonData = { ...updatedTest.seasonData, criticalPower: numericValue || 0 };
            } else if (key === 'p20min' && numericValue) {
                updatedTest.seasonData = {
                    ...updatedTest.seasonData,
                    criticalPower: Math.round(numericValue * 0.95),
                    method: 'Single Test Estimation',
                    sourceTests: [...new Set([...(updatedTest?.seasonData?.sourceTests || []), '20min'])]
                };
            }

            return { ...prev, cycling: { ...currentCycling, Test: updatedTest } };
        });
    };

    const handlecalculateFtp = () => {
        if (!formData.cycling?.Test) return;
        if (!validatePowerTests(formData.cycling?.Test)) return;
        const { ftp, zones, seasonData } = calculateFtp(formData.cycling.Test);

        const updatedProfile: Profile = {
            ...formData,
            cycling: { ...formData.cycling, Test: { ...formData.cycling.Test, ftp, zones, seasonData } }
        };
        setFormData(updatedProfile);
        saveAthleteProfile(updatedProfile);
    };

    // ── Running handlers ────────────────────────────────────────────────────

    const handleVMAChange = (value: string) => {
        const val = parseFloat(value) || 0;
        setFormData(prev => ({
            ...prev,
            running: { ...prev.running, Test: { ...prev?.running?.Test, vma: val } }
        }));
    };

    const handleDistChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            running: { ...prev.running, Test: { ...prev?.running?.Test, recentRaceDistanceMeters: value } }
        }));
    };

    const handleTpsChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            running: { ...prev.running, Test: { ...prev?.running?.Test, recentRaceTimeSec: value } }
        }));
    };

    const calculateRunningZones = (vmaInput: number) => {
        if (!vmaInput || isNaN(vmaInput)) {
            setFormData(prev => ({ ...prev, running: { ...prev.running, vma: null, zones: undefined } }));
            return;
        }

        const percentages = { z1: [60, 70], z2: [70, 75], z3: [75, 85], z4: [85, 95], z5: [95, 110] };
        const getPace = (pct: number) => {
            const speedKmh = vmaInput * (pct / 100);
            return Math.round(3600 / speedKmh);
        };

        const newZones: Zones = {
            z1: { min: getPace(percentages.z1[0]), max: getPace(percentages.z1[1]) },
            z2: { min: getPace(percentages.z2[0]), max: getPace(percentages.z2[1]) },
            z3: { min: getPace(percentages.z3[0]), max: getPace(percentages.z3[1]) },
            z4: { min: getPace(percentages.z4[0]), max: getPace(percentages.z4[1]) },
            z5: { min: getPace(percentages.z5[0]), max: getPace(percentages.z5[1]) },
        };

        const updatedProfile: Profile = {
            ...formData,
            running: { ...formData.running, Test: { ...formData?.running?.Test, vma: vmaInput, zones: newZones } }
        };
        setFormData(updatedProfile);
        saveAthleteProfile(updatedProfile);
    };

    const handleCalculateRunning = () => {
        if (runInputMode === 'vma') {
            const vma = formData.running?.Test?.vma;
            if (vma) calculateRunningZones(Math.round(vma * 10) / 10);
        } else {
            const dist = formData.running?.Test?.recentRaceDistanceMeters;
            const time = formData.running?.Test?.recentRaceTimeSec;
            if (dist && time) {
                const [m, s] = time.split(':').map(Number);
                const totalSec = (m * 60) + (s || 0);
                if (totalSec > 0) {
                    const vmaCalc = (parseFloat(dist) * 1000 / totalSec) * 3.6;
                    calculateRunningZones(Math.round(vmaCalc * 10) / 10);
                }
            }
        }
    };

    // ── HR handlers ─────────────────────────────────────────────────────────

    const handleFcMaxChange = (value: string) => {
        const val = parseInt(value) || 0;
        setFormData(prev => ({ ...prev, heartRate: { ...prev.heartRate, max: val } }));
    };

    const CalculateHrZones = () => {
        const maxHr = formData.heartRate?.max || 0;
        if (maxHr < 100) return;

        const newHrZones = {
            z1: { min: 0, max: Math.round(maxHr * 0.60) },
            z2: { min: Math.round(maxHr * 0.61), max: Math.round(maxHr * 0.75) },
            z3: { min: Math.round(maxHr * 0.76), max: Math.round(maxHr * 0.82) },
            z4: { min: Math.round(maxHr * 0.83), max: Math.round(maxHr * 0.89) },
            z5: { min: Math.round(maxHr * 0.90), max: maxHr },
        };

        const updatedProfile: Profile = { ...formData, heartRate: { max: maxHr, zones: newHrZones } };
        setFormData(updatedProfile);
        saveAthleteProfile(updatedProfile);
    };

    // ── Zone config ─────────────────────────────────────────────────────────

    const POWER_ZONES = [
        { label: 'Z1', name: 'Récupération', accent: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300', color: 'text-slate-500 dark:text-slate-400' },
        { label: 'Z2', name: 'Endurance', accent: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400', color: 'text-green-600 dark:text-green-400' },
        { label: 'Z3', name: 'Tempo', accent: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400', color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Z4', name: 'Seuil', accent: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', color: 'text-yellow-600 dark:text-yellow-400' },
        { label: 'Z5', name: 'PMA', accent: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400', color: 'text-orange-600 dark:text-orange-400' },
        { label: 'Z6', name: 'Anaérobie', accent: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400', color: 'text-red-600 dark:text-red-400' },
        { label: 'Z7', name: 'Neuromusc.', accent: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400', color: 'text-purple-600 dark:text-purple-400' },
    ];

    const HR_ZONES = [
        { label: 'Z1', name: 'Récupération', accent: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300', color: 'text-slate-500 dark:text-slate-400' },
        { label: 'Z2', name: 'Endurance', accent: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400', color: 'text-green-600 dark:text-green-400' },
        { label: 'Z3', name: 'Tempo', accent: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400', color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Z4', name: 'Seuil', accent: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', color: 'text-yellow-600 dark:text-yellow-400' },
        { label: 'Z5', name: 'Max', accent: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400', color: 'text-red-600 dark:text-red-400' },
    ];

    const PACE_ZONES = [
        { label: 'Z1', name: 'Endu. fond.', accent: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', color: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Z2', name: 'Endu. active', accent: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', color: 'text-cyan-600 dark:text-cyan-400' },
        { label: 'Z3', name: 'Tempo', accent: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400', color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Z4', name: 'Seuil', accent: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400', color: 'text-orange-600 dark:text-orange-400' },
        { label: 'Z5', name: 'VMA', accent: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400', color: 'text-red-600 dark:text-red-400' },
    ];

    // ── Render helpers ──────────────────────────────────────────────────────

    const powerZoneValues = formData.cycling?.Test?.zones;
    const hrZoneValues = formData.heartRate?.zones;
    const paceZoneValues = formData.running?.Test?.zones;

    const getPowerZoneValue = (idx: number) => {
        if (!powerZoneValues) return '';
        const keys = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'] as const;
        const z = powerZoneValues[keys[idx]];
        if (!z) return '';
        if (idx === 0) return `< ${z.max} W`;
        if (idx === 6) return `> ${z.min} W`;
        return `${z.min}–${z.max} W`;
    };

    const getHrZoneValue = (idx: number) => {
        if (!hrZoneValues) return '';
        const keys = ['z1', 'z2', 'z3', 'z4', 'z5'] as const;
        const z = hrZoneValues[keys[idx]];
        if (!z) return '';
        if (idx === 0) return `< ${z.max} bpm`;
        return `${z.min}–${z.max} bpm`;
    };

    const getPaceZoneValue = (idx: number) => {
        if (!paceZoneValues) return '';
        const keys = ['z1', 'z2', 'z3', 'z4', 'z5'] as const;
        const z = paceZoneValues[keys[idx]];
        if (!z) return '';
        return `${formatPace(z.min)} – ${formatPace(z.max)} /km`;
    };

    // ════════════════════════════════════════════════════════════════════════

    return (
        <Card className="p-0 bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 pb-0">
                <SectionHeader icon={Zap} title="Physiologie & Zones" color="text-yellow-600 dark:text-yellow-400" />
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-1">
                <TabButton active={activeZoneTab === 'power'} onClick={() => setActiveZoneTab('power')} label="Puissance" icon={Zap} />
                <TabButton active={activeZoneTab === 'hr'} onClick={() => setActiveZoneTab('hr')} label="Cardio" icon={Heart} />
                <TabButton active={activeZoneTab === 'pace'} onClick={() => setActiveZoneTab('pace')} label="Allure" icon={Timer} />
            </div>

            <div className="p-5 min-h-[280px]">

                {/* ═══ POWER ═══ */}
                {activeZoneTab === 'power' && (() => {
                    const precision = formData.cycling?.Test ? getTestPrecision(formData.cycling.Test) : { count: 0, level: 'low' as const };
                    const precisionLabel = { low: 'Estimation', medium: 'Correct', high: 'Précis' }[precision.level];
                    const precisionColor = { low: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15', medium: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/15', high: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15' }[precision.level];

                    return (
                        <div className="space-y-5 animate-in fade-in slide-in-from-left-4">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Zap size={15} className="text-yellow-500" /> Tests de puissance
                                    </h4>
                                    {formData.cycling?.Test?.ftp != null && formData.cycling.Test.ftp > 0 && (
                                        <span className="text-xs font-bold bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-2.5 py-1 rounded-full">
                                            FTP {formData.cycling.Test.ftp} W
                                        </span>
                                    )}
                                </div>

                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
                                    Remplissez les tests dont vous disposez. Plus vous en renseignez, plus le calcul est précis.
                                </p>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                    {([
                                        { label: '5 min (PMA)', key: 'p5min' as const },
                                        { label: '8 min', key: 'p8min' as const },
                                        { label: '15 min', key: 'p15min' as const },
                                        { label: '20 min (FTP)', key: 'p20min' as const, highlight: true }
                                    ]).map(test => (
                                        <Field
                                            key={test.key}
                                            label={test.label}
                                            value={formData.cycling?.Test?.[test.key] || ''}
                                            onChange={val => handleTestChange(test.key, val)}
                                            placeholder="---"
                                            unit="W"
                                            highlight={test.highlight}
                                        />
                                    ))}
                                </div>

                                {/* FTP directe + indicateur précision */}
                                <div className="flex items-end gap-3">
                                    <div className="w-40">
                                        <Field
                                            label="ou FTP connue"
                                            value={formData.cycling?.Test?.ftp || ''}
                                            onChange={val => handleTestChange('ftp', val)}
                                            placeholder="ex: 250"
                                            unit="W"
                                        />
                                    </div>
                                    {precision.count > 0 && (
                                        <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg mb-0.5 ${precisionColor}`}>
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className={`w-1.5 h-3 rounded-sm ${i <= (precision.level === 'high' ? 3 : precision.level === 'medium' ? 2 : 1)
                                                            ? 'bg-current opacity-100' : 'bg-current opacity-20'
                                                        }`} />
                                                ))}
                                            </div>
                                            {precisionLabel} ({precision.count} test{precision.count > 1 ? 's' : ''})
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button variant="secondary" onClick={handlecalculateFtp} className="w-full h-10 text-sm" icon={Calculator}>
                                Calculer FTP & Zones
                            </Button>

                            {/* Results */}
                            {formData.cycling?.Test?.ftp && powerZoneValues && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                                        <span className="text-sm text-slate-500">FTP <span className="text-lg font-bold text-slate-900 dark:text-white">{formData.cycling.Test.ftp} W</span></span>
                                        {formData.weight && (
                                            <span className="text-sm text-slate-500">Ratio <span className="font-bold text-emerald-600 dark:text-emerald-400">{(formData.cycling.Test.ftp / formData.weight).toFixed(2)} W/kg</span></span>
                                        )}
                                        {(formData.cycling?.Test?.seasonData?.wPrime || 0) > 0 && (
                                            <span className="text-sm text-slate-500 flex items-center gap-1">
                                                <TrendingUp size={12} className="text-orange-500" />
                                                W&apos; <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{formData.cycling.Test.seasonData!.wPrime} J</span>
                                            </span>
                                        )}
                                    </div>

                                    {formData.cycling?.Test?.seasonData?.method && (
                                        <p className="text-[10px] text-slate-400 italic">
                                            {formData.cycling.Test.seasonData.method === 'Critical Power Regression'
                                                ? `Régression puissance critique (${formData.cycling.Test.seasonData.sourceTests?.join(' + ')})`
                                                : `Estimation depuis ${formData.cycling.Test.seasonData.sourceTests?.join(', ') || 'FTP'}`
                                            }
                                        </p>
                                    )}

                                    <div className="space-y-1.5">
                                        {POWER_ZONES.map((zone, idx) => (
                                            <ZoneBar key={zone.label} {...zone} value={getPowerZoneValue(idx)} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ═══ HEART RATE ═══ */}
                {activeZoneTab === 'hr' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                                <Heart size={15} className="text-red-500" /> Fréquence cardiaque
                            </h4>

                            <div className="max-w-xs">
                                <Field
                                    label="FC Max (bpm)"
                                    value={formData.heartRate?.max || ''}
                                    onChange={handleFcMaxChange}
                                    placeholder="ex: 185"
                                    icon={<Activity size={16} />}
                                    unit="bpm"
                                />
                                <p className="text-[10px] text-slate-400 mt-1.5 italic">
                                    Utilisé pour calculer vos zones d&apos;intensité cardiaque.
                                </p>
                            </div>
                        </div>

                        <Button variant="secondary" onClick={CalculateHrZones} className="w-full h-10 text-sm" icon={Calculator}>
                            Calculer Zones FC
                        </Button>

                        {/* Results */}
                        {hrZoneValues && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-sm text-slate-500">FC Max <span className="text-lg font-bold text-slate-900 dark:text-white">{formData.heartRate?.max} bpm</span></span>

                                <div className="space-y-1.5">
                                    {HR_ZONES.map((zone, idx) => (
                                        <ZoneBar key={zone.label} {...zone} value={getHrZoneValue(idx)} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ PACE / RUNNING ═══ */}
                {activeZoneTab === 'pace' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Wind size={15} className="text-cyan-500" /> Profil allure
                                </h4>
                                {formData.running?.Test?.vma && (
                                    <span className="text-xs font-bold bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 px-2.5 py-1 rounded-full">
                                        VMA {formData.running.Test.vma} km/h
                                    </span>
                                )}
                            </div>

                            {/* Input mode toggle */}
                            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-4">
                                <button
                                    onClick={() => setRunInputMode('vma')}
                                    className={`flex-1 text-xs font-medium py-2 rounded-md transition-all ${runInputMode === 'vma'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    VMA directe
                                </button>
                                <button
                                    onClick={() => setRunInputMode('race')}
                                    className={`flex-1 text-xs font-medium py-2 rounded-md transition-all ${runInputMode === 'race'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    Depuis une course
                                </button>
                            </div>

                            {/* VMA direct */}
                            {runInputMode === 'vma' && (
                                <div className="max-w-xs">
                                    <Field
                                        label="VMA (km/h)"
                                        value={formData.running?.Test?.vma || ''}
                                        onChange={handleVMAChange}
                                        placeholder="ex: 16.5"
                                        step="0.1"
                                        unit="km/h"
                                    />
                                </div>
                            )}

                            {/* Race performance */}
                            {runInputMode === 'race' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <Field
                                        label="Distance (km)"
                                        value={formData.running?.Test?.recentRaceDistanceMeters || ''}
                                        onChange={handleDistChange}
                                        placeholder="ex: 10"
                                        type="text"
                                        unit="km"
                                    />
                                    <Field
                                        label="Temps (mm:ss)"
                                        value={formData.running?.Test?.recentRaceTimeSec || ''}
                                        onChange={handleTpsChange}
                                        placeholder="ex: 45:00"
                                        type="text"
                                    />
                                </div>
                            )}
                        </div>

                        <Button variant="secondary" onClick={handleCalculateRunning} className="w-full h-10 text-sm" icon={Calculator}>
                            {runInputMode === 'vma' ? 'Calculer Zones' : 'Calculer VMA & Zones'}
                        </Button>

                        {/* Results */}
                        {paceZoneValues && formData.running?.Test?.vma && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                                    <span className="text-sm text-slate-500">VMA <span className="text-lg font-bold text-slate-900 dark:text-white">{formData.running.Test.vma} km/h</span></span>
                                    <span className="text-sm text-slate-500">Allure VMA <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400">{formatPace(3600 / formData.running.Test.vma)}/km</span></span>
                                </div>

                                <div className="space-y-1.5">
                                    {PACE_ZONES.map((zone, idx) => (
                                        <ZoneBar key={zone.label} {...zone} value={getPaceZoneValue(idx)} />
                                    ))}
                                </div>

                                <p className="text-[10px] text-slate-400 text-center italic">
                                    Allures en min/km &middot; Basé sur % VMA linéaire
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
