import type { Workout, Profile } from '@/lib/data/DatabaseTypes';
import type { DeviationMetrics, DeviationSignal, DeviationSeverity, CompletedLap } from '@/lib/data/type';
import { getWorkoutTSS } from './computeTSS';

// ─── Seuils ────────────────────────────────────────────────
const THRESHOLDS = {
  duration: { alert: 15, critical: 25 },     // % d'écart
  tss:      { alert: 20, critical: 30 },
  power:    { alert: 8,  critical: 15 },
  hr:       { alert: 5,  critical: 10 },      // bpm (absolu)
  fadeRate:  { alert: 8,  critical: 15 },      // % de fade
  decoupling:{ alert: 5, critical: 8 },        // %
};

// ─── Helpers ───────────────────────────────────────────────
function pctDelta(actual: number, planned: number): number {
  if (planned === 0) return 0;
  return ((actual - planned) / planned) * 100;
}

/**
 * Calcule le fade rate entre le 1er et le dernier intervalle "Active".
 * Utilise la puissance moyenne des laps.
 */
function computeFadeRate(laps: CompletedLap[]): number | null {
  const powerLaps = laps.filter(l => l.avgPower != null && l.avgPower > 0);
  if (powerLaps.length < 3) return null;

  // On prend le 1er et le dernier lap avec puissance significative
  const firstPower = powerLaps[0].avgPower!;
  const lastPower = powerLaps[powerLaps.length - 1].avgPower!;

  if (firstPower === 0) return null;
  return ((firstPower - lastPower) / firstPower) * 100;
}

/**
 * Découplage aérobie : compare le ratio Puissance/FC
 * entre la 1ère moitié et la 2ème moitié de la séance.
 * > 5% = fatigue aérobie significative.
 */
function computeAerobicDecoupling(laps: CompletedLap[]): number | null {
  const validLaps = laps.filter(l =>
    l.avgPower != null && l.avgPower > 0 &&
    l.avgHeartRate != null && l.avgHeartRate > 0
  );
  if (validLaps.length < 4) return null;

  const mid = Math.floor(validLaps.length / 2);
  const firstHalf = validLaps.slice(0, mid);
  const secondHalf = validLaps.slice(mid);

  const ratio = (laps: CompletedLap[]) => {
    const totalDuration = laps.reduce((s, l) => s + l.durationSeconds, 0);
    if (totalDuration === 0) return 0;
    const avgPower = laps.reduce((s, l) => s + l.avgPower! * l.durationSeconds, 0) / totalDuration;
    const avgHR = laps.reduce((s, l) => s + l.avgHeartRate! * l.durationSeconds, 0) / totalDuration;
    return avgHR > 0 ? avgPower / avgHR : 0;
  };

  const r1 = ratio(firstHalf);
  const r2 = ratio(secondHalf);
  if (r1 === 0) return null;

  return ((r1 - r2) / r1) * 100;
}

/**
 * Coût cardiaque = bpm moyen / watt moyen
 * Plus c'est bas, plus l'athlète est efficient.
 */
function computeCardiacCost(avgHR: number | null | undefined, avgPower: number | null | undefined): number | null {
  if (!avgHR || !avgPower || avgPower === 0) return null;
  return Math.round((avgHR / avgPower) * 1000) / 1000;
}

// ─── Context helpers ───────────────────────────────────────

/** RPE bas + métriques basses = séance volontairement facile, pas de la fatigue */
function isIntentionallyEasy(rpe: number | null | undefined, workoutType: string): boolean {
  // RPE <= 4 → l'athlète n'a pas souffert, c'était un choix
  if (rpe != null && rpe <= 4) return true;
  // Séance de récup / endurance facile : seuils bien plus lâches
  const easyTypes = ['recovery', 'rest', 'récupération', 'endurance'];
  if (easyTypes.some(t => workoutType.toLowerCase().includes(t)) && (rpe == null || rpe <= 5)) return true;
  return false;
}

/** Séances "clé" (intervalles, seuil, VO2) vs séances "filler" (endurance, récup) */
function isKeyWorkout(workoutType: string): boolean {
  const keyTypes = ['intervals', 'threshold', 'tempo', 'vo2', 'seuil', 'intervalles', 'fartlek', 'race', 'test'];
  return keyTypes.some(t => workoutType.toLowerCase().includes(t));
}

// ─── Main ──────────────────────────────────────────────────
export function computeDeviationMetrics(
  workout: Workout,
  profile: Profile
): DeviationMetrics | null {
  const cd = workout.completedData;
  const planned = workout.plannedData;

  // Pas de données planifiées ou pas complétée → pas de déviation
  if (!cd || !planned) return null;
  // Besoin d'au moins une cible chiffrée
  if (!planned.durationMinutes && !planned.plannedTSS && !planned.targetPowerWatts) return null;

  const rpe = cd.perceivedEffort;
  const wType = workout.workoutType ?? '';
  const intentionallyEasy = isIntentionallyEasy(rpe, wType);
  const isKey = isKeyWorkout(wType);

  // Seuils adaptatifs : séances faciles/endurance → seuils plus lâches
  const thresholdMultiplier = isKey ? 1 : 1.5; // +50% de tolérance sur les séances non-clé

  const signals: { name: string; delta: number; direction: 'under' | 'over'; severity: DeviationSeverity }[] = [];
  const details: string[] = [];

  // ── 1. Durée ──────────────────────────────────────────
  let durationDelta: number | null = null;
  if (planned.durationMinutes && cd.actualDurationMinutes) {
    durationDelta = Math.round(pctDelta(cd.actualDurationMinutes, planned.durationMinutes));
    const absDelta = Math.abs(durationDelta);
    const alertThreshold = THRESHOLDS.duration.alert * thresholdMultiplier;
    const criticalThreshold = THRESHOLDS.duration.critical * thresholdMultiplier;
    if (absDelta >= alertThreshold) {
      const sev: DeviationSeverity = absDelta >= criticalThreshold ? 'critical' : 'alert';
      signals.push({ name: 'duration', delta: durationDelta, direction: durationDelta < 0 ? 'under' : 'over', severity: sev });
      details.push(`Durée ${durationDelta > 0 ? '+' : ''}${durationDelta}% vs planifié (${cd.actualDurationMinutes}min vs ${planned.durationMinutes}min)`);
    }
  }

  // ── 2. TSS ────────────────────────────────────────────
  let tssDelta: number | null = null;
  const tssValue = getWorkoutTSS(workout, profile);
  const actualTSS = tssValue > 0 ? tssValue : null;
  if (planned.plannedTSS && actualTSS) {
    tssDelta = Math.round(pctDelta(actualTSS, planned.plannedTSS));
    const absDelta = Math.abs(tssDelta);
    const alertThreshold = THRESHOLDS.tss.alert * thresholdMultiplier;
    const criticalThreshold = THRESHOLDS.tss.critical * thresholdMultiplier;
    if (absDelta >= alertThreshold) {
      const sev: DeviationSeverity = absDelta >= criticalThreshold ? 'critical' : 'alert';
      signals.push({ name: 'tss', delta: tssDelta, direction: tssDelta < 0 ? 'under' : 'over', severity: sev });
      details.push(`TSS ${tssDelta > 0 ? '+' : ''}${tssDelta}% (${Math.round(actualTSS)} vs ${planned.plannedTSS} prévu)`);
    }
  }

  // ── 3. Puissance (NP ou avg vs cible) ─────────────────
  let powerDelta: number | null = null;
  const actualPower = cd.metrics?.cycling?.normalizedPowerWatts ?? cd.metrics?.cycling?.avgPowerWatts ?? null;
  const targetPower = planned.targetPowerWatts;
  if (targetPower && actualPower) {
    powerDelta = Math.round(pctDelta(actualPower, targetPower));
    const absDelta = Math.abs(powerDelta);
    const alertThreshold = THRESHOLDS.power.alert * thresholdMultiplier;
    const criticalThreshold = THRESHOLDS.power.critical * thresholdMultiplier;
    if (absDelta >= alertThreshold) {
      const sev: DeviationSeverity = absDelta >= criticalThreshold ? 'critical' : 'alert';
      signals.push({ name: 'power', delta: powerDelta, direction: powerDelta < 0 ? 'under' : 'over', severity: sev });
      details.push(`Puissance ${powerDelta > 0 ? '+' : ''}${powerDelta}% (${actualPower}W vs ${targetPower}W cible)`);
    }
  }

  // ── 4. FC vs attendue ─────────────────────────────────
  let hrDelta: number | null = null;
  const actualHR = cd.heartRate?.avgBPM;
  const targetHR = planned.targetHeartRateBPM;
  if (targetHR && actualHR) {
    hrDelta = actualHR - targetHR; // en bpm absolu
    const absHRDelta = Math.abs(hrDelta);
    if (absHRDelta >= THRESHOLDS.hr.alert) {
      const sev: DeviationSeverity = absHRDelta >= THRESHOLDS.hr.critical ? 'critical' : 'alert';
      const direction = hrDelta > 0 ? 'over' as const : 'under' as const;
      signals.push({ name: 'hr', delta: hrDelta, direction, severity: sev });
      details.push(`FC ${hrDelta > 0 ? '+' : ''}${hrDelta} bpm vs cible (${actualHR} vs ${targetHR} bpm)`);
    }
  }

  // ── 5. Métriques avancées (laps) ──────────────────────
  const laps = cd.laps ?? [];
  const fadeRate = computeFadeRate(laps);
  const aerobicDecoupling = computeAerobicDecoupling(laps);
  const cardiacCost = computeCardiacCost(actualHR, actualPower);

  if (fadeRate !== null && fadeRate >= THRESHOLDS.fadeRate.alert) {
    const sev: DeviationSeverity = fadeRate >= THRESHOLDS.fadeRate.critical ? 'critical' : 'alert';
    signals.push({ name: 'fadeRate', delta: fadeRate, direction: 'under', severity: sev });
    details.push(`Fade rate de ${fadeRate.toFixed(1)}% entre le 1er et dernier intervalle`);
  }

  if (aerobicDecoupling !== null && aerobicDecoupling >= THRESHOLDS.decoupling.alert) {
    const sev: DeviationSeverity = aerobicDecoupling >= THRESHOLDS.decoupling.critical ? 'critical' : 'alert';
    signals.push({ name: 'decoupling', delta: aerobicDecoupling, direction: 'under', severity: sev });
    details.push(`Découplage aérobie de ${aerobicDecoupling.toFixed(1)}% — ta FC dérive en 2e moitié`);
  }

  // ── RPE check : le signal le plus important ───────────
  // RPE bas + métriques sous les cibles = choix volontaire (sortie chill, avec un ami, etc.)
  // RPE élevé + métriques sous les cibles = vraie fatigue
  const rpeConfirmsFatigue = rpe != null && rpe >= 6;  // l'athlète a trouvé ça dur
  const rpeContradictsAlert = rpe != null && rpe <= 4;  // l'athlète était à l'aise

  // ── Déterminer le signal global ───────────────────────
  const convergingSignals = signals.length;

  // Construire le retour "normal" pour les métriques avancées
  const normalReturn = (): DeviationMetrics => ({
    signal: 'normal',
    severity: 'info',
    score: 0,
    convergingSignals,
    durationDelta,
    tssDelta,
    powerDelta,
    hrDelta,
    fadeRate: fadeRate !== null ? Math.round(fadeRate * 10) / 10 : null,
    aerobicDecoupling: aerobicDecoupling !== null ? Math.round(aerobicDecoupling * 10) / 10 : null,
    cardiacCost,
    headline: '',
    details,
    adaptationReason: '',
  });

  // Pas assez de signaux → normal
  if (convergingSignals < 2) return normalReturn();

  // ── Filtre RPE : sortie volontairement facile ─────────
  // Si l'athlète était à l'aise (RPE bas) ET les métriques sont sous les cibles,
  // c'est un choix, pas de la fatigue. On ne déclenche pas d'alerte.
  const underSignals = signals.filter(s => s.direction === 'under').length;
  const overSignals = signals.filter(s => s.direction === 'over').length;

  if (intentionallyEasy && underSignals > overSignals) {
    // Sortie chill → pas d'alerte fatigue
    // On mentionne juste dans les détails
    details.push('RPE bas — séance volontairement en-dessous des cibles');
    return normalReturn();
  }

  // Si RPE bas contredit les signaux de fatigue (sauf si FC haute confirme un problème physiologique)
  const hasHRSignal = signals.some(s => s.name === 'hr' && s.direction === 'over');
  if (rpeContradictsAlert && underSignals > overSignals && !hasHRSignal) {
    details.push('RPE bas — les écarts semblent volontaires, pas liés à de la fatigue');
    return normalReturn();
  }

  // Cas spécial : FC haute + puissance basse = fatigue certaine (même si RPE bas)
  const hrHighPowerLow = signals.some(s => s.name === 'hr' && s.direction === 'over')
    && signals.some(s => s.name === 'power' && s.direction === 'under');

  let signal: DeviationSignal;
  let score: number;

  if (hrHighPowerLow) {
    signal = 'fatigue';
    score = -Math.min(80, convergingSignals * 25);
  } else if (underSignals > overSignals) {
    // Sous-performance + RPE confirme → fatigue
    if (rpeConfirmsFatigue || hasHRSignal) {
      signal = 'fatigue';
      const avgUnderDelta = signals
        .filter(s => s.direction === 'under')
        .reduce((sum, s) => sum + Math.abs(s.delta), 0) / Math.max(underSignals, 1);
      score = -Math.min(100, Math.round(avgUnderDelta * 2));
    } else {
      // Sous-performance sans RPE élevé et sans signal FC → probablement un choix
      // On retourne normal avec les détails
      details.push('Métriques sous les cibles mais pas de signe physiologique de fatigue — séance probablement allégée volontairement');
      return normalReturn();
    }
  } else {
    signal = 'superform';
    const avgOverDelta = signals
      .filter(s => s.direction === 'over')
      .reduce((sum, s) => sum + Math.abs(s.delta), 0) / Math.max(overSignals, 1);
    score = Math.min(100, Math.round(avgOverDelta * 2));
  }

  // Sévérité globale
  const hasCritical = signals.some(s => s.severity === 'critical');
  const severity: DeviationSeverity = hasCritical ? 'critical' : convergingSignals >= 3 ? 'critical' : 'alert';

  // ── Messages ──────────────────────────────────────────
  let headline: string;
  let adaptationReason: string;

  if (signal === 'fatigue') {
    headline = severity === 'critical'
      ? `Fatigue importante — ${convergingSignals} signaux convergents`
      : `Fatigue détectée — ${convergingSignals} signaux convergents`;

    if (hrHighPowerLow) {
      adaptationReason = 'Ta FC était élevée pour une puissance en baisse — signe de fatigue centrale. On adapte la suite pour consolider la récupération.';
    } else if (rpeConfirmsFatigue) {
      adaptationReason = `Tu as trouvé ça dur (RPE ${rpe}/10) et tes métriques le confirment. Ton corps a besoin d'un ajustement pour les prochains jours.`;
    } else {
      adaptationReason = 'Plusieurs signaux physiologiques convergent vers de la fatigue. On adapte la suite.';
    }
  } else {
    headline = severity === 'critical'
      ? `Forme exceptionnelle — ${convergingSignals} signaux positifs`
      : `Bonne forme détectée — ${convergingSignals} signaux positifs`;
    adaptationReason = 'Ta forme actuelle permet d\'en faire plus. On peut ajuster l\'intensité des prochaines séances qualité pour capitaliser.';
  }

  return {
    signal,
    severity,
    score,
    convergingSignals,
    durationDelta,
    tssDelta,
    powerDelta,
    hrDelta,
    fadeRate: fadeRate !== null ? Math.round(fadeRate * 10) / 10 : null,
    aerobicDecoupling: aerobicDecoupling !== null ? Math.round(aerobicDecoupling * 10) / 10 : null,
    cardiacCost,
    headline,
    details,
    adaptationReason,
  };
}
