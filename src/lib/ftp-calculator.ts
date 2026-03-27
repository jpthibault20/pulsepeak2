import type {
  PowerTests,
  Zones,
  SeasonData,
  CyclingTest, // ✅ Import du nouveau type
} from '@/lib/data/type';

const TEST_CONFIG: Record<TestName, { duration: number; key: keyof PowerTests }> = {
  '5min': { duration: 300, key: 'p5min' },
  '8min': { duration: 480, key: 'p8min' },
  '15min': { duration: 900, key: 'p15min' },
  '20min': { duration: 1200, key: 'p20min' },
};

type TestName = '5min' | '8min' | '15min' | '20min';
interface FtpCalculationResult {
  ftp: number;
  zones: Zones;
  seasonData: SeasonData;
}
interface DataPoint {
  t: number;  // Temps en secondes
  w: number;  // Travail total (watts × secondes)
  p: number;  // Puissance moyenne (watts)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FTP_RATIOS = {
  p5min: 0.82,   // FTP = 82% de CP5
  p8min: 0.90,   // FTP = 90% de CP8
  p15min: 0.93,  // FTP = 93% de CP15
  p20min: 0.95,  // FTP = 95% de CP20
} as const;

/**
 * Coefficients des zones d'entraînement (selon Coggan)
 */
const ZONE_COEFFICIENTS = {
  z1: [0, 0.55],
  z2: [0.56, 0.75],
  z3: [0.76, 0.90],
  z4: [0.91, 1.05],
  z5: [1.06, 1.20],
  z6: [1.21, 1.50],  // Max à p5min ou 150% FTP
  z7: [1.51, 10.0],  // Au-delà de Z6
} as const;

/**
 * Convertit les tests en points de données pour la régression
 */
function buildDataPoints(tests: CyclingTest): { points: DataPoint[]; names: TestName[] } {
  const points: DataPoint[] = [];
  const names: TestName[] = [];

  (Object.entries(TEST_CONFIG) as [TestName, typeof TEST_CONFIG[TestName]][])
    .forEach(([name, config]) => {
      // Vérification plus robuste du type et de la valeur
      const testValue = tests[config.key];
      if (typeof testValue === 'number' && testValue > 0) {
        points.push({
          t: config.duration,
          w: testValue * config.duration,
          p: testValue,
        });
        names.push(name);
      }
    });

  // Tri des points par durée (du plus court au plus long)
  const resultPoints = [...points].sort((a, b) => a.t - b.t);
  const resultNames = names.sort((a, b) => TEST_CONFIG[a].duration - TEST_CONFIG[b].duration);

  return { points: resultPoints, names: resultNames };
}

/**
 * Calcule la régression linéaire (Modèle Puissance Critique)
 * Formule : W' = CP × t + W'
 * Retourne : { cp: number, wPrime: number }
 */
function calculateCriticalPower(points: DataPoint[]): {
  cp: number;
  wPrime: number;
} {
  const n = points.length;
  let sumT = 0, sumW = 0, sumTW = 0, sumT2 = 0;

  points.forEach(({ t, w }) => {
    sumT += t;
    sumW += w;
    sumTW += t * w;
    sumT2 += t * t;
  });

  // Pente = CP (Critical Power)
  const slope = (n * sumTW - sumT * sumW) / (n * sumT2 - sumT * sumT);
  
  // Ordonnée à l'origine = W' (capacité anaérobie)
  const intercept = (sumW - slope * sumT) / n;

  return {
    cp: Math.round(slope),
    wPrime: Math.round(intercept),
  };
}

/**
 * Calcule la FTP depuis un seul test (fallback)
 */
function calculateSingleTestFtp(tests: CyclingTest): {
  ftp: number;
  source: string;
  testUsed: TestName; // ✅ Type strict
} {
  if (tests.p20min != null && tests.p20min > 0) {
    return { 
      ftp: Math.round(tests.p20min * 0.95), 
      source: '95% du CP20',
      testUsed: '20min',
    };
  }
  if (tests.p15min != null && tests.p15min > 0) {
    return { 
      ftp: Math.round(tests.p15min * 0.93), 
      source: '93% du CP15',
      testUsed: '15min',
    };
  }
  if (tests.p8min != null && tests.p8min > 0) {
    return { 
      ftp: Math.round(tests.p8min * 0.90), 
      source: '90% du CP8',
      testUsed: '8min',
    };
  }
  if (tests.p5min != null && tests.p5min > 0) {
    return { 
      ftp: Math.round(tests.p5min * 0.82), 
      source: '82% du CP5 (Estimatif)',
      testUsed: '5min',
    };
  }

  throw new Error('Aucun test de puissance valide fourni');
}

/**
 * Génère les zones d'entraînement à partir de la FTP
 */
function generatePowerZones(ftp: number, maxP5?: number): Zones {
  const z6Max = maxP5 && maxP5 > 0 ? maxP5 : Math.round(ftp * ZONE_COEFFICIENTS.z6[1]);
  
  return {
    z1: { 
      min: 0, 
      max: Math.round(ftp * ZONE_COEFFICIENTS.z1[1]) 
    },
    z2: { 
      min: Math.round(ftp * ZONE_COEFFICIENTS.z2[0]), 
      max: Math.round(ftp * ZONE_COEFFICIENTS.z2[1]) 
    },
    z3: { 
      min: Math.round(ftp * ZONE_COEFFICIENTS.z3[0]), 
      max: Math.round(ftp * ZONE_COEFFICIENTS.z3[1]) 
    },
    z4: { 
      min: Math.round(ftp * ZONE_COEFFICIENTS.z4[0]), 
      max: Math.round(ftp * ZONE_COEFFICIENTS.z4[1]) 
    },
    z5: { 
      min: Math.round(ftp * ZONE_COEFFICIENTS.z5[0]), 
      max: Math.round(ftp * ZONE_COEFFICIENTS.z5[1]) 
    },
    z6: { 
      min: Math.round(ftp * ZONE_COEFFICIENTS.z6[0]), 
      max: z6Max 
    },
    z7: { 
      min: z6Max + 1, 
      max: 2000 
    },
  };
}

/**
 * FONCTION PRINCIPALE : Calcule la FTP et les zones
 * 
 * @param tests - Résultats des tests de puissance
 * @returns Résultat complet avec FTP, zones et données de saison
 * @throws Error si aucun test valide n'est fourni
 * 
 * @example
 * const result = calculateFtp({ p5min: 350, p20min: 280 });
 * console.log(result.ftp); // 266 (si régression)
 */
export function calculateFtp(tests: CyclingTest): FtpCalculationResult {
  const { points: dataPoints, names: testsUsed } = buildDataPoints(tests);

  if (dataPoints.length === 0) {
    throw new Error('Aucun test de puissance valide fourni');
  }

  let ftp: number;
  let wPrime = 0;
  let method: SeasonData['method'];
  let source: string;

  // Modèle Puissance Critique (≥2 tests)
  if (dataPoints.length >= 2) {
    const { cp, wPrime: w } = calculateCriticalPower(dataPoints);
    ftp = cp;
    wPrime = w;
    method = 'Critical Power Regression';
    source = `Modèle Puissance Critique (${testsUsed.join('+')})`;
  } 
  // Fallback : estimation depuis un seul test
  else {
    const { ftp: singleFtp, source: singleSource, testUsed } = calculateSingleTestFtp(tests);
    ftp = singleFtp;
    method = 'Single Test Estimation';
    source = singleSource;
    testsUsed[0] = testUsed; // ✅ Déjà typé TestName
  }

  const zones = generatePowerZones(ftp, tests.p5min != null ? tests.p5min : undefined);

  const seasonData: SeasonData = {
    calculatedAt: new Date().toISOString(),
    wPrime,
    criticalPower: ftp,
    method,
    sourceTests: testsUsed, // ✅ Type TestName[] garanti
  };

  console.log(`✅ Zones calculées via ${source}. FTP: ${ftp}W, W': ${wPrime}J`);

  return { ftp, zones, seasonData };
}

/**
 * Valide les données de tests (utilitaire)
 */
export function validatePowerTests(tests: CyclingTest): boolean {
  return Object.values(tests).some(val => val > 0);
}
