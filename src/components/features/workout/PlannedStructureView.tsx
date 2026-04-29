'use client';

import React, { useState } from 'react';
import {
    Zap, Heart, Gauge, Waves, Dumbbell, Activity, Target, Clock,
    Sparkles, FlaskConical, ChevronDown, ChevronUp,
} from 'lucide-react';
import type {
    StructureBlock,
    StructureSimpleBlock,
    StructureRepeatBlock,
    SwimStrokeType,
} from '@/lib/data/type';

// =============================================================================
// Visual config per block type
// =============================================================================
// Différenciation sobre : barre d'accent gauche + label UPPERCASE, sans fonds
// colorés ni icônes de type.

type BlockVisual = {
    label: string;
    accent: string;
};

const SIMPLE_BLOCK_VISUAL: Record<StructureSimpleBlock['type'], BlockVisual> = {
    Warmup: { label: 'Échauffement', accent: 'bg-slate-500 dark:bg-slate-400' },
    Active: { label: 'Effort', accent: 'bg-red-700 dark:bg-red-500' },
    Rest: { label: 'Récupération', accent: 'bg-slate-400 dark:bg-slate-500' },
    Cooldown: { label: 'Retour au calme', accent: 'bg-slate-600 dark:bg-slate-400' },
};

const REPEAT_VISUAL: BlockVisual = {
    label: 'Série',
    accent: 'bg-amber-700 dark:bg-amber-500',
};

// =============================================================================
// Formatting helpers
// =============================================================================

function formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
}

function formatTotalMinutes(totalSeconds: number): string {
    if (totalSeconds <= 0) return '0 min';
    const m = Math.round(totalSeconds / 60);
    const h = Math.floor(m / 60);
    const rm = m % 60;
    if (h === 0) return `${m} min`;
    return rm === 0 ? `${h} h` : `${h} h ${String(rm).padStart(2, '0')}`;
}

function formatMeters(m: number): string {
    return `${m} m`;
}

function computeTotalSeconds(structure: StructureBlock[]): number {
    return structure.reduce((total, b) => {
        if (b.type === 'Repeat') {
            const actif = b.durationActifSecondes ?? 0;
            const recup = b.durationRecupSecondes ?? 0;
            return total + b.repeat * (actif + recup);
        }
        return total + (b.durationActifSecondes ?? 0);
    }, 0);
}

function computeTotalMeters(structure: StructureBlock[]): number {
    return structure.reduce((total, b) => {
        if (b.type === 'Repeat') {
            return total + b.repeat * (b.distanceMeters ?? 0);
        }
        return total + (b.distanceMeters ?? 0);
    }, 0);
}

const STROKE_LABEL: Record<SwimStrokeType, string> = {
    crawl: 'Crawl',
    dos: 'Dos',
    brasse: 'Brasse',
    papillon: 'Papillon',
    '4_nages': '4 nages',
    mixte: 'Mixte',
};

// Métrique primaire affichée en haut à droite de chaque bloc.
// Natation (distance présente) → distance prime. Sinon → durée.
function primaryMetric(opts: {
    durationActifSecondes?: number | null;
    distanceMeters?: number | null;
    repeat?: number | null;
}): string {
    const { durationActifSecondes, distanceMeters, repeat } = opts;
    if (distanceMeters != null && distanceMeters > 0) {
        if (repeat && repeat > 1) return `${repeat}×${distanceMeters} m`;
        return formatMeters(distanceMeters);
    }
    return formatDuration(durationActifSecondes);
}

// =============================================================================
// Target pills — style neutre uniforme, seule la micro-icône distingue
// =============================================================================

type TargetPill = {
    icon?: React.ElementType;   // optionnel pour les pills texte pur (nage, matériel)
    label: string;
};

type TargetSource = {
    targetPowerWatts?: number | null;
    targetPaceMinPerKm?: string | null;
    targetPaceMinPer100m?: string | null;
    targetHeartRateBPM?: number | null;
    targetRPE?: number | null;
    reps?: number | null;
    sets?: number | null;
    loadKg?: number | null;
    strokeType?: SwimStrokeType | null;
    equipment?: string[] | null;
};

function buildTargetPills(src: TargetSource): TargetPill[] {
    const pills: TargetPill[] = [];

    // Nage (natation) en premier — label contextualise tout ce qui suit
    if (src.strokeType) {
        pills.push({ label: STROKE_LABEL[src.strokeType] });
    }
    // Matériel (natation)
    if (src.equipment && src.equipment.length > 0) {
        for (const eq of src.equipment) {
            pills.push({ label: eq });
        }
    }

    if (src.targetPowerWatts != null) {
        pills.push({ icon: Zap, label: `${src.targetPowerWatts} W` });
    }
    if (src.targetPaceMinPerKm) {
        pills.push({ icon: Gauge, label: `${src.targetPaceMinPerKm} /km` });
    }
    if (src.targetPaceMinPer100m) {
        pills.push({ icon: Waves, label: `${src.targetPaceMinPer100m} /100m` });
    }
    if (src.targetHeartRateBPM != null) {
        pills.push({ icon: Heart, label: `${src.targetHeartRateBPM} bpm` });
    }
    if (src.targetRPE != null) {
        pills.push({ icon: Activity, label: `RPE ${src.targetRPE}` });
    }
    if (src.reps != null && src.sets != null) {
        let label = `${src.sets}×${src.reps}`;
        if (src.loadKg != null) label += ` @ ${src.loadKg} kg`;
        pills.push({ icon: Dumbbell, label });
    }

    return pills;
}

const PILL_BASE = `
    inline-flex items-center gap-1
    px-2 py-0.5 rounded-md
    text-xs font-medium tabular-nums
    bg-slate-100 dark:bg-slate-800/80
    text-slate-700 dark:text-slate-200
    border border-slate-200/70 dark:border-slate-700/60
`;

const TargetPillsRow: React.FC<{ pills: TargetPill[] }> = ({ pills }) => {
    if (pills.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {pills.map((p, i) => {
                const Icon = p.icon;
                return (
                    <span key={i} className={PILL_BASE}>
                        {Icon && <Icon size={11} className="text-slate-400 dark:text-slate-500 stroke-[2.25px]" />}
                        {p.label}
                    </span>
                );
            })}
        </div>
    );
};

// =============================================================================
// Block renderers
// =============================================================================

const BlockShell: React.FC<{
    accent: string;
    children: React.ReactNode;
}> = ({ accent, children }) => (
    <div
        className="
            relative overflow-hidden
            rounded-lg
            bg-white dark:bg-slate-900/40
            border border-slate-200/80 dark:border-slate-800
        "
    >
        <div className={`absolute top-0 left-0 bottom-0 w-[3px] ${accent}`} aria-hidden />
        <div className="pl-4 pr-3 py-2.5">{children}</div>
    </div>
);

const SimpleBlockCard: React.FC<{
    block: StructureSimpleBlock;
    index: number;
}> = ({ block, index }) => {
    const visual = SIMPLE_BLOCK_VISUAL[block.type];
    const pills = buildTargetPills(block);
    const metric = primaryMetric({
        durationActifSecondes: block.durationActifSecondes,
        distanceMeters: block.distanceMeters,
    });

    return (
        <BlockShell accent={visual.accent}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                        {visual.label}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">
                        #{index + 1}
                    </span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    {metric}
                </span>
            </div>

            {block.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug mb-2">
                    {block.description}
                </p>
            )}

            <TargetPillsRow pills={pills} />
        </BlockShell>
    );
};

const RepeatSubRow: React.FC<{
    label: string;
    dotColor: string;
    primary: string;     // durée ou distance de la phase
    pills: TargetPill[];
}> = ({ label, dotColor, primary, pills }) => (
    <div className="flex items-center gap-3 py-1.5 border-t border-slate-200/60 dark:border-slate-800/60 first:border-t-0">
        <span className="shrink-0 flex items-center gap-1.5 w-[70px]">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                {label}
            </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-slate-900 dark:text-white tabular-nums w-16">
            {primary}
        </span>
        <div className="flex-1 min-w-0">
            <TargetPillsRow pills={pills} />
        </div>
    </div>
);

const RepeatBlockCard: React.FC<{
    block: StructureRepeatBlock;
    index: number;
}> = ({ block, index }) => {
    const visual = REPEAT_VISUAL;

    const activePills = buildTargetPills({
        targetPowerWatts: block.targetPowerWatts,
        targetPaceMinPerKm: block.targetPaceMinPerKm,
        targetPaceMinPer100m: block.targetPaceMinPer100m,
        targetHeartRateBPM: block.targetHeartRateBPM,
        targetRPE: block.targetRPE,
        strokeType: block.strokeType,
        equipment: block.equipment,
    });

    const recupPills = buildTargetPills({
        targetPowerWatts: block.targetRecupPowerWatts,
        targetPaceMinPerKm: block.targetRecupPaceMinPerKm,
        targetPaceMinPer100m: block.targetRecupPaceMinPer100m,
        targetHeartRateBPM: block.targetRecupHeartRateBPM,
        targetRPE: block.targetRecupRPE,
    });

    const hasRecup = (block.durationRecupSecondes ?? 0) > 0 || recupPills.length > 0;

    const activePrimary = primaryMetric({
        durationActifSecondes: block.durationActifSecondes,
        distanceMeters: block.distanceMeters,
    });
    const recupPrimary = formatDuration(block.durationRecupSecondes);

    // Métrique globale du bloc : pour natation, "N×Dm" ; sinon durée totale.
    const headerMetric = primaryMetric({
        durationActifSecondes: (block.durationActifSecondes ?? 0) + (block.durationRecupSecondes ?? 0),
        distanceMeters: block.distanceMeters,
        repeat: block.repeat,
    });
    const totalSeconds = block.repeat * ((block.durationActifSecondes ?? 0) + (block.durationRecupSecondes ?? 0));

    return (
        <BlockShell accent={visual.accent}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                        {visual.label}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">
                        #{index + 1}
                    </span>
                    <span className="
                        inline-flex items-center px-1.5 py-px rounded
                        text-[10px] font-bold tabular-nums
                        bg-amber-100 dark:bg-amber-500/15
                        text-amber-800 dark:text-amber-300
                        border border-amber-200/70 dark:border-amber-500/25
                    ">
                        ×{block.repeat}
                    </span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    {headerMetric}
                </span>
            </div>

            {block.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug mb-2">
                    {block.description}
                </p>
            )}

            <div className="rounded-md bg-slate-50/60 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 px-2.5">
                <RepeatSubRow
                    label="Actif"
                    dotColor="bg-red-600"
                    primary={activePrimary}
                    pills={activePills}
                />
                {hasRecup && (
                    <RepeatSubRow
                        label="Récup"
                        dotColor="bg-slate-400"
                        primary={recupPrimary}
                        pills={recupPills}
                    />
                )}
            </div>

            {/* Si natation (distance présente) ET durée totale calculable → petit rappel durée estimée */}
            {block.distanceMeters != null && totalSeconds > 0 && (
                <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 text-right tabular-nums">
                    ≈ {formatDuration(totalSeconds)} total
                </div>
            )}
        </BlockShell>
    );
};

// =============================================================================
// Main component
// =============================================================================

export const PlannedStructureView: React.FC<{
    description?: string | null;
    structure?: StructureBlock[] | null;
}> = ({ description, structure }) => {
    const hasStructure = Array.isArray(structure) && structure.length > 0;
    const trimmedDescription = description?.trim() || null;
    const [isStructureOpen, setIsStructureOpen] = useState(false);

    if (!hasStructure && !trimmedDescription) return null;

    const totalSeconds = hasStructure ? computeTotalSeconds(structure!) : 0;
    const totalMeters = hasStructure ? computeTotalMeters(structure!) : 0;

    return (
        <div className="mb-5 p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target size={15} className="text-slate-400" />
                    Programme
                </h3>
                {hasStructure && (totalMeters > 0 || totalSeconds > 0) && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                        {totalMeters > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <Waves size={12} />
                                {totalMeters} m
                            </span>
                        )}
                        {totalMeters > 0 && totalSeconds > 0 && (
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                        )}
                        {totalSeconds > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <Clock size={12} />
                                {formatTotalMinutes(totalSeconds)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* 1. Description texte (toujours en premier si dispo) */}
            {trimmedDescription && (
                <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {trimmedDescription}
                </div>
            )}

            {/* 2. Structure assemblée (volet dépliable, badge BETA) */}
            {hasStructure && (
                <div className={trimmedDescription ? 'mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-700/40' : ''}>
                    <button
                        type="button"
                        onClick={() => setIsStructureOpen(v => !v)}
                        className="flex items-center justify-between gap-2 w-full text-left hover:opacity-80 transition-opacity"
                        aria-expanded={isStructureOpen}
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles size={13} className="text-indigo-400" />
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                Structure assemblée
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-500/25">
                                <FlaskConical size={9} />
                                Beta
                            </span>
                        </div>
                        {isStructureOpen
                            ? <ChevronUp size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                            : <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        }
                    </button>
                    {isStructureOpen && (
                        <div className="mt-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                            {structure!.map((block, i) =>
                                block.type === 'Repeat' ? (
                                    <RepeatBlockCard key={i} block={block} index={i} />
                                ) : (
                                    <SimpleBlockCard key={i} block={block} index={i} />
                                )
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
