'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    User, Activity, Calendar, Zap, Target, Shield,
    Save, CheckCircle2, ChevronRight
} from 'lucide-react';
import { BasicInformation } from './BasicInformation';
import { SportsAndAppLink } from './SportsAndAppLink';
import { Availability } from './Availability';
import { CalibrationTest } from './CalibrationTest';
import { Goals } from './Goals';
import { AccountSettings } from './AccountSettings';
import { Profile } from '@/lib/data/DatabaseTypes';
import { PlanBadge } from '@/components/features/billing/PlanBadge';
import { useSubscription } from '@/lib/subscription/context';

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS = [
    { id: 'identity',  label: 'Identité',   icon: User,     color: 'text-blue-400',   accent: 'bg-blue-500' },
    { id: 'sports',    label: 'Sports',     icon: Activity, color: 'text-emerald-400', accent: 'bg-emerald-500' },
    { id: 'planning',  label: 'Planning',   icon: Calendar, color: 'text-purple-400',  accent: 'bg-purple-500' },
    { id: 'physio',    label: 'Physiologie',icon: Zap,      color: 'text-yellow-400',  accent: 'bg-yellow-500' },
    { id: 'objectifs', label: 'Objectifs',  icon: Target,   color: 'text-rose-400',    accent: 'bg-rose-500' },
    { id: 'compte',    label: 'Compte',     icon: Shield,   color: 'text-slate-400',   accent: 'bg-slate-500' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

// ─── Profile completion ────────────────────────────────────────────────────────

function getCompletionPercent(p: Profile): number {
    const checks = [
        !!p.firstName,
        !!p.lastName,
        !!p.birthDate,
        !!p.weight,
        !!p.height,
        (p.activeSports.cycling || p.activeSports.running || p.activeSports.swimming),
        !!p.cycling?.Test?.ftp || !!p.running?.Test?.vma || !!p.heartRate?.max,
        !!p.goal,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeValue<T>(value: T | null | undefined, fallback: T): T {
    return value !== null && value !== undefined ? value : fallback;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileFormProps {
    initialData: Partial<Profile>;
    onSave:   (data: Profile) => Promise<void>;
    onCancel: () => void;
    isSettings?: boolean;
    onSuccess?: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const ProfileForm: React.FC<ProfileFormProps> = ({ initialData, onSave }) => {
    const [activeSection, setActiveSection] = useState<SectionId>('identity');
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);

    const { plan, status } = useSubscription();

    const defaultData: Profile = {
        id: '', createdAt: '', updatedAt: '', lastLoginAt: null,
        firstName: '', lastName: '', email: '', weight: undefined, height: undefined, birthDate: '',
        activeSports: { swimming: false, cycling: true, running: false },
        aiPersonality: 'Analytique',
        strava: undefined,
        currentATL: 0, currentCTL: 0,
        weeklyAvailability: {
            'Lundi':    { swimming: 0, cycling: 0, running: 0, comment: '' },
            'Mardi':    { swimming: 0, cycling: 0, running: 0, comment: '' },
            'Mercredi': { swimming: 0, cycling: 0, running: 0, comment: '' },
            'Jeudi':    { swimming: 0, cycling: 0, running: 0, comment: '' },
            'Vendredi': { swimming: 0, cycling: 0, running: 0, comment: '' },
            'Samedi':   { swimming: 0, cycling: 0, running: 0, comment: '' },
            'Dimanche': { swimming: 0, cycling: 0, running: 0, comment: '' },
        },
        goal: '', weaknesses: '', experience: 'Débutant', objectiveDate: '', workouts: [],
        role: 'user',
    };

    const initialFormData = useMemo<Profile>(() => {
        if (!initialData) return defaultData;
        return {
            id: initialData.id || '',
            createdAt: initialData.createdAt || '',
            updatedAt: initialData.updatedAt || '',
            lastLoginAt: initialData.lastLoginAt || '',
            firstName: safeValue(initialData.firstName, ''),
            lastName:  safeValue(initialData.lastName, ''),
            email:     safeValue(initialData.email, ''),
            birthDate: safeValue(initialData.birthDate, ''),
            weight:    safeValue(initialData.weight, undefined),
            height:    safeValue(initialData.height, undefined),
            aiPersonality: safeValue(initialData.aiPersonality, 'Analytique'),
            experience:    safeValue(initialData.experience, 'Débutant'),
            strava: initialData.strava || undefined,
            activeSports: {
                swimming: safeValue(initialData.activeSports?.swimming, false),
                cycling:  safeValue(initialData.activeSports?.cycling, true),
                running:  safeValue(initialData.activeSports?.running, false),
            },
            currentATL: safeValue(initialData.currentATL, 0),
            currentCTL: safeValue(initialData.currentCTL, 0),
            cycling: {
                Test: {
                    ftp:    safeValue(initialData.cycling?.Test?.ftp, undefined),
                    p5min:  safeValue(initialData.cycling?.Test?.p5min, undefined),
                    p8min:  safeValue(initialData.cycling?.Test?.p8min, undefined),
                    p15min: safeValue(initialData.cycling?.Test?.p15min, undefined),
                    p20min: safeValue(initialData.cycling?.Test?.p20min, undefined),
                    zones:  initialData.cycling?.Test?.zones || undefined,
                    seasonData: initialData.cycling?.Test?.seasonData,
                }
            },
            running: {
                Test: {
                    vma: safeValue(initialData.running?.Test?.vma, undefined),
                    recentRaceTimeSec:      safeValue(initialData.running?.Test?.recentRaceTimeSec, undefined),
                    recentRaceDistanceMeters: safeValue(initialData.running?.Test?.recentRaceDistanceMeters, undefined),
                    zones: initialData.running?.Test?.zones || undefined,
                }
            },
            swimming: {
                Test: {
                    recentRaceTimeSec:      safeValue(initialData.swimming?.Test?.recentRaceTimeSec, undefined),
                    recentRaceDistanceMeters: safeValue(initialData.swimming?.Test?.recentRaceDistanceMeters, undefined),
                    poolLengthMeters: safeValue(initialData.swimming?.Test?.poolLengthMeters, undefined),
                    totalStrokes:     safeValue(initialData.swimming?.Test?.totalStrokes, undefined),
                }
            },
            heartRate: {
                max:     safeValue(initialData.heartRate?.max, null),
                resting: safeValue(initialData.heartRate?.resting, null),
                zones:   initialData.heartRate?.zones || undefined,
            },
            goal:          safeValue(initialData.goal, ''),
            objectiveDate: safeValue(initialData.objectiveDate, ''),
            weaknesses:    safeValue(initialData.weaknesses, ''),
            weeklyAvailability: (
                Object.keys(defaultData.weeklyAvailability) as Array<keyof typeof defaultData.weeklyAvailability>
            ).reduce((acc, day) => ({
                ...acc,
                [day]: {
                    swimming: safeValue(initialData.weeklyAvailability?.[day]?.swimming, 0),
                    cycling:  safeValue(initialData.weeklyAvailability?.[day]?.cycling, 0),
                    running:  safeValue(initialData.weeklyAvailability?.[day]?.running, 0),
                    comment:  safeValue(initialData.weeklyAvailability?.[day]?.comment, ''),
                }
            }), {} as Profile['weeklyAvailability']),
            workouts: initialData.workouts || [],
            role: initialData.role ?? 'user',
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    const [formData, setFormData] = useState<Profile>(initialFormData);
    const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    const completion = getCompletionPercent(formData);

    // Scroll active tab into view on mobile
    useEffect(() => {
        const el = tabsRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [activeSection]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(formData);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const initials = [formData.firstName?.[0], formData.lastName?.[0]]
        .filter(Boolean).join('').toUpperCase() || '?';

    const displayName = [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'Mon Profil';

    return (
        <div className="max-w-5xl mx-auto pb-28 md:pb-8 animate-in fade-in duration-300">

            {/* ── Hero Header ─────────────────────────────────────────────── */}
            <div className="flex items-start gap-4 mb-6 px-1">
                {/* Avatar */}
                <div className="relative shrink-0">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/30">
                        <span className="text-white font-bold text-xl md:text-2xl">{initials}</span>
                    </div>
                    {/* Completion ring */}
                    <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)]" viewBox="0 0 68 68">
                        <circle cx="34" cy="34" r="30" fill="none" stroke="#1e293b" strokeWidth="3" />
                        <circle
                            cx="34" cy="34" r="30" fill="none"
                            stroke={completion >= 80 ? '#22c55e' : completion >= 50 ? '#3b82f6' : '#f59e0b'}
                            strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 30 * completion / 100} ${2 * Math.PI * 30 * (1 - completion / 100)}`}
                            strokeLinecap="round"
                            transform="rotate(-90 34 34)"
                            className="transition-all duration-700"
                        />
                    </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl md:text-2xl font-bold text-white truncate">{displayName}</h1>
                        <PlanBadge plan={plan} status={status} size="sm" />
                    </div>
                    <p className="text-slate-500 text-sm truncate mt-0.5">{formData.email || 'Email non renseigné'}</p>
                    {/* Completion bar */}
                    <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden max-w-[140px]">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                    completion >= 80 ? 'bg-emerald-500' : completion >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${completion}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-500">{completion}% complet</span>
                    </div>
                </div>

                {/* Save button desktop */}
                <div className="hidden md:block shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || (!isDirty && !saved)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
                            ${saved
                                ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
                                : isDirty
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            }
                        `}
                    >
                        {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                        {isSaving ? 'Enregistrement...' : saved ? 'Sauvegardé !' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            {/* ── Layout ──────────────────────────────────────────────────── */}
            <div className="flex gap-6">

                {/* Sidebar navigation — desktop uniquement */}
                <nav className="hidden md:flex flex-col gap-1 w-44 shrink-0 pt-1">
                    {SECTIONS.map((s) => {
                        const Icon = s.icon;
                        const active = activeSection === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setActiveSection(s.id)}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                                    ${active
                                        ? 'bg-slate-800 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                    }
                                `}
                            >
                                <Icon size={16} className={active ? s.color : ''} />
                                <span>{s.label}</span>
                                {active && <ChevronRight size={14} className="ml-auto text-slate-600" />}
                            </button>
                        );
                    })}
                </nav>

                {/* Content */}
                <div className="flex-1 min-w-0">

                    {/* Mobile tab bar */}
                    <div
                        ref={tabsRef}
                        className="md:hidden flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-none"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {SECTIONS.map((s) => {
                            const Icon = s.icon;
                            const active = activeSection === s.id;
                            return (
                                <button
                                    key={s.id}
                                    data-active={active}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0
                                        ${active
                                            ? 'bg-slate-800 text-white border border-slate-700'
                                            : 'text-slate-500 hover:text-white bg-slate-900'
                                        }
                                    `}
                                >
                                    <Icon size={13} className={active ? s.color : ''} />
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Section content */}
                    <div className="animate-in fade-in duration-200 space-y-6">
                        {activeSection === 'identity' && (
                            <BasicInformation formData={formData} setFormData={setFormData} />
                        )}
                        {activeSection === 'sports' && (
                            <SportsAndAppLink formData={formData} setFormData={setFormData} />
                        )}
                        {activeSection === 'planning' && (
                            <Availability formData={formData} setFormData={setFormData} />
                        )}
                        {activeSection === 'physio' && (
                            <CalibrationTest formData={formData} setFormData={setFormData} />
                        )}
                        {activeSection === 'objectifs' && (
                            <Goals formData={formData} setFormData={setFormData} />
                        )}
                        {activeSection === 'compte' && (
                            <AccountSettings />
                        )}
                    </div>

                    {/* Section navigation footer */}
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => {
                                const idx = SECTIONS.findIndex(s => s.id === activeSection);
                                if (idx > 0) setActiveSection(SECTIONS[idx - 1].id);
                            }}
                            disabled={activeSection === SECTIONS[0].id}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white disabled:opacity-0 transition-all"
                        >
                            <ChevronRight size={14} className="rotate-180" />
                            {SECTIONS[Math.max(0, SECTIONS.findIndex(s => s.id === activeSection) - 1)].label}
                        </button>

                        <div className="flex gap-1">
                            {SECTIONS.map((s, i) => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                        s.id === activeSection ? 'bg-blue-400 w-4' : 'bg-slate-700 hover:bg-slate-500'
                                    }`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                const idx = SECTIONS.findIndex(s => s.id === activeSection);
                                if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id);
                            }}
                            disabled={activeSection === SECTIONS[SECTIONS.length - 1].id}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white disabled:opacity-0 transition-all"
                        >
                            {SECTIONS[Math.min(SECTIONS.length - 1, SECTIONS.findIndex(s => s.id === activeSection) + 1)].label}
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Mobile sticky save bar ────────────────────────────────── */}
            <div className={`
                md:hidden fixed bottom-[80px] left-0 right-0 z-50 transition-all duration-300
                ${isDirty ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
            `}>
                <div className="mx-4 mb-2 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/50 flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-white text-sm font-semibold">Modifications non sauvegardées</p>
                        <p className="text-slate-500 text-xs">Appuyez pour enregistrer votre profil</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shrink-0 shadow-lg shadow-blue-900/30"
                    >
                        {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                        {isSaving ? 'Enregistrement...' : saved ? 'Sauvegardé !' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    );
};
