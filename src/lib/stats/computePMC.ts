import type { Workout } from '@/lib/data/DatabaseTypes';
import type { Zones } from '@/lib/data/type';

export interface PMCPoint {
    date: string;    // YYYY-MM-DD
    ctl: number;     // Chronic Training Load (fitness)
    atl: number;     // Acute Training Load (fatigue)
    tsb: number;     // Training Stress Balance (freshness)
    tss: number;     // Daily TSS
}

export interface WeeklyTSSPoint {
    weekLabel: string;   // "S1", "S2", etc. or "Mar 17"
    planned: number;
    actual: number;
    weekStart: string;   // YYYY-MM-DD
}

/** Extract TSS from a completed workout */
function getWorkoutTSS(w: Workout): number {
    if (w.status !== 'completed' || !w.completedData) return 0;
    const cd = w.completedData;
    if (cd.metrics?.cycling?.tss != null && cd.metrics.cycling.tss > 0) return cd.metrics.cycling.tss;
    if (cd.calculatedTSS != null && cd.calculatedTSS > 0) return cd.calculatedTSS;
    const plannedTSS = w.plannedData.plannedTSS ?? 0;
    const plannedDur = w.plannedData.durationMinutes ?? 0;
    const actualDur = cd.actualDurationMinutes ?? 0;
    if (plannedDur > 0 && plannedTSS > 0) return (actualDur / plannedDur) * plannedTSS;
    return plannedTSS;
}

/** Compute PMC data for the last `days` days */
export function computePMC(
    workouts: Workout[],
    initialCTL: number,
    initialATL: number,
    days = 90
): PMCPoint[] {
    const K_CTL = 1 - Math.exp(-1 / 42);
    const K_ATL = 1 - Math.exp(-1 / 7);

    // Build a daily TSS map: "YYYY-MM-DD" -> total TSS
    const dailyTSS = new Map<string, number>();
    for (const w of workouts) {
        if (w.status === 'completed' && w.completedData) {
            const tss = getWorkoutTSS(w);
            if (tss > 0) {
                dailyTSS.set(w.date, (dailyTSS.get(w.date) ?? 0) + tss);
            }
        }
    }

    // We need to warm up the EWMA before the display window.
    // Warm up over 180 days before the display window starts.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const displayStart = new Date(today);
    displayStart.setDate(displayStart.getDate() - days + 1);
    const warmupStart = new Date(displayStart);
    warmupStart.setDate(warmupStart.getDate() - 180);

    let ctl = initialCTL;
    let atl = initialATL;

    // Warm up period (before display window)
    const warmupCursor = new Date(warmupStart);
    while (warmupCursor < displayStart) {
        const dateStr = warmupCursor.toISOString().split('T')[0];
        const tss = dailyTSS.get(dateStr) ?? 0;
        ctl = ctl + K_CTL * (tss - ctl);
        atl = atl + K_ATL * (tss - atl);
        warmupCursor.setDate(warmupCursor.getDate() + 1);
    }

    // Build display window
    const result: PMCPoint[] = [];
    const cursor = new Date(displayStart);
    while (cursor <= today) {
        const dateStr = cursor.toISOString().split('T')[0];
        const tss = dailyTSS.get(dateStr) ?? 0;
        ctl = ctl + K_CTL * (tss - ctl);
        atl = atl + K_ATL * (tss - atl);
        result.push({
            date: dateStr,
            ctl: Math.round(ctl * 10) / 10,
            atl: Math.round(atl * 10) / 10,
            tsb: Math.round((ctl - atl) * 10) / 10,
            tss: Math.round(tss),
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
}

/** Compute weekly planned vs actual TSS for the last `weeks` weeks */
export function computeWeeklyTSS(workouts: Workout[], weeks = 12): WeeklyTSSPoint[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: WeeklyTSSPoint[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        let planned = 0;
        let actual = 0;

        for (const w of workouts) {
            if (w.date >= weekStartStr && w.date <= weekEndStr) {
                planned += w.plannedData.plannedTSS ?? 0;
                if (w.status === 'completed') actual += getWorkoutTSS(w);
            }
        }

        const label = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        result.push({
            weekLabel: label,
            planned: Math.round(planned),
            actual: Math.round(actual),
            weekStart: weekStartStr,
        });
    }

    return result;
}

/** Get TSB status label and colors */
export function getTSBStatus(tsb: number): { label: string; color: string; bgColor: string } {
    if (tsb > 10)   return { label: 'Frais & Performant',   color: '#22c55e', bgColor: '#052e1640' };
    if (tsb > 0)    return { label: 'Équilibré',            color: '#86efac', bgColor: '#14532d40' };
    if (tsb > -10)  return { label: 'Légèrement Fatigué',   color: '#fb923c', bgColor: '#43140740' };
    if (tsb > -20)  return { label: 'Chargé',               color: '#f97316', bgColor: '#7c2d1240' };
    return              { label: 'Surmenage — Récupère !',  color: '#ef4444', bgColor: '#450a0a40' };
}

/**
 * Aggregate zone distribution across completed workouts.
 * Strategy 1: use zoneDistribution (% per workout) weighted by duration.
 * Strategy 2 (fallback): classify avgBPM into profile HR zones, weight by duration.
 */
export function aggregateZones(workouts: Workout[], profileZones?: Zones): number[] {
    const acc = [0, 0, 0, 0, 0];
    let totalMinutes = 0;
    let hasExact = false;

    // Strategy 1 — exact zone distribution from workout data
    for (const w of workouts) {
        if (w.status !== 'completed' || !w.completedData) continue;
        const dist = w.completedData.heartRate?.zoneDistribution;
        if (!dist?.length) continue;
        hasExact = true;
        const dur = w.completedData.actualDurationMinutes || 0;
        for (let i = 0; i < Math.min(5, dist.length); i++) {
            acc[i] += (dist[i] / 100) * dur;
        }
        totalMinutes += dur;
    }

    if (hasExact && totalMinutes > 0) {
        return acc.map(z => Math.round((z / totalMinutes) * 100));
    }

    // Strategy 2 — estimate from avgBPM + profile HR zones
    if (!profileZones) return [0, 0, 0, 0, 0];

    const ranges = [
        profileZones.z1, profileZones.z2, profileZones.z3,
        profileZones.z4, profileZones.z5,
    ];

    const est = [0, 0, 0, 0, 0];
    let totalEst = 0;

    for (const w of workouts) {
        if (w.status !== 'completed' || !w.completedData) continue;
        const avgBPM = w.completedData.heartRate?.avgBPM;
        const dur = w.completedData.actualDurationMinutes || 0;
        if (!avgBPM || dur <= 0) continue;

        // Find matching zone (default to last zone if above all ranges)
        let zoneIdx = ranges.length - 1;
        for (let i = 0; i < ranges.length; i++) {
            const r = ranges[i];
            if (r && avgBPM >= r.min && avgBPM <= r.max) { zoneIdx = i; break; }
            if (r && avgBPM < r.min && i === 0) { zoneIdx = 0; break; }
        }
        est[zoneIdx] += dur;
        totalEst += dur;
    }

    if (totalEst === 0) return [0, 0, 0, 0, 0];
    return est.map(z => Math.round((z / totalEst) * 100));
}
