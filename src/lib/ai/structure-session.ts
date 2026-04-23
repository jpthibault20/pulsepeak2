import { Profile } from "../data/DatabaseTypes";
import { SportType, StructureBlock, StructureSimpleBlock, StructureRepeatBlock, SwimStrokeType } from "../data/type";
import { callGeminiAPI } from "./coach-api";

const SWIM_STROKES: readonly SwimStrokeType[] = ['crawl', 'dos', 'brasse', 'papillon', '4_nages', 'mixte'];

function fmtPace(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function buildZonesContext(profile: Profile, sportType: SportType): string {
    const parts: string[] = [];

    if (sportType === 'cycling' && profile.cycling?.Test?.zones) {
        const z = profile.cycling.Test.zones;
        parts.push(`ZONES PUISSANCE (W):
- Z1 Récup: <${z.z1.max}
- Z2 Endurance: ${z.z2.min}-${z.z2.max}
- Z3 Tempo: ${z.z3.min}-${z.z3.max}
- Z4 Seuil: ${z.z4.min}-${z.z4.max}
- Z5 VO2max: ${z.z5.min}-${z.z5.max}${z.z6 ? `\n- Z6 Anaérobie: ${z.z6.min}-${z.z6.max}` : ''}${z.z7 ? `\n- Z7 Neuromusculaire: >${z.z7.min}` : ''}`);
    }

    if (sportType === 'running' && profile.running?.Test?.zones) {
        const z = profile.running.Test.zones;
        parts.push(`ZONES ALLURE (min/km):
- Z1 Récup: ${fmtPace(z.z1.min)}-${fmtPace(z.z1.max)}
- Z2 Endurance: ${fmtPace(z.z2.min)}-${fmtPace(z.z2.max)}
- Z3 Tempo: ${fmtPace(z.z3.min)}-${fmtPace(z.z3.max)}
- Z4 Seuil: ${fmtPace(z.z4.min)}-${fmtPace(z.z4.max)}
- Z5 VO2max: ${fmtPace(z.z5.min)}-${fmtPace(z.z5.max)}`);
    }

    if (profile.heartRate?.zones) {
        const z = profile.heartRate.zones;
        parts.push(`ZONES FC (bpm):
- Z1: <${z.z1.max}
- Z2: ${z.z2.min}-${z.z2.max}
- Z3: ${z.z3.min}-${z.z3.max}
- Z4: ${z.z4.min}-${z.z4.max}
- Z5: ${z.z5.min}-${z.z5.max}`);
    } else if (profile.heartRate?.max) {
        parts.push(`FC Max: ${profile.heartRate.max} bpm`);
    }

    return parts.length > 0 ? parts.join('\n\n') : "Aucune zone définie pour l'athlète — utilise des valeurs cohérentes avec le niveau.";
}

// Schéma unique top-level : tous les champs actif + récup + natation + renfo en optionnel.
// L'IA remplit ce qui est pertinent selon le type (simple vs Repeat) et le sport.
const structureResponseSchema = {
    type: "ARRAY",
    items: {
        type: "OBJECT",
        properties: {
            type: { type: "STRING", enum: ["Warmup", "Active", "Rest", "Cooldown", "Repeat"] },

            // Uniquement pour type="Repeat"
            repeat: { type: "NUMBER", nullable: true },

            // Phase ACTIVE (ou bloc simple : c'est la durée/cible du bloc lui-même)
            durationActifSecondes: { type: "NUMBER", nullable: true },
            targetPowerWatts: { type: "NUMBER", nullable: true },
            targetPaceMinPerKm: { type: "STRING", nullable: true },
            targetPaceMinPer100m: { type: "STRING", nullable: true },
            targetHeartRateBPM: { type: "NUMBER", nullable: true },
            targetRPE: { type: "NUMBER", nullable: true },

            // Natation (applicable au bloc simple ET à la phase active d'un Repeat)
            distanceMeters: { type: "NUMBER", nullable: true },
            strokeType: { type: "STRING", nullable: true, enum: ["crawl", "dos", "brasse", "papillon", "4_nages", "mixte"] },
            equipment: { type: "ARRAY", nullable: true, items: { type: "STRING" } },

            // Phase RÉCUPÉRATION (uniquement pour type="Repeat")
            durationRecupSecondes: { type: "NUMBER", nullable: true },
            targetRecupPowerWatts: { type: "NUMBER", nullable: true },
            targetRecupPaceMinPerKm: { type: "STRING", nullable: true },
            targetRecupPaceMinPer100m: { type: "STRING", nullable: true },
            targetRecupHeartRateBPM: { type: "NUMBER", nullable: true },
            targetRecupRPE: { type: "NUMBER", nullable: true },

            // Uniquement sur blocs simples (hors natation)
            distanceKm: { type: "NUMBER", nullable: true },
            plannedTSS: { type: "NUMBER", nullable: true },
            reps: { type: "NUMBER", nullable: true },
            sets: { type: "NUMBER", nullable: true },
            loadKg: { type: "NUMBER", nullable: true },

            description: { type: "STRING" },
        },
        required: ["type", "description"],
    },
};

type RawBlock = {
    type?: string;
    repeat?: number | null;

    durationActifSecondes?: number | null;
    targetPowerWatts?: number | null;
    targetPaceMinPerKm?: string | null;
    targetPaceMinPer100m?: string | null;
    targetHeartRateBPM?: number | null;
    targetRPE?: number | null;

    distanceMeters?: number | null;
    strokeType?: string | null;
    equipment?: string[] | null;

    durationRecupSecondes?: number | null;
    targetRecupPowerWatts?: number | null;
    targetRecupPaceMinPerKm?: string | null;
    targetRecupPaceMinPer100m?: string | null;
    targetRecupHeartRateBPM?: number | null;
    targetRecupRPE?: number | null;

    distanceKm?: number | null;
    plannedTSS?: number | null;
    reps?: number | null;
    sets?: number | null;
    loadKg?: number | null;

    description?: string;
};

function safeStrokeType(s: string | null | undefined): SwimStrokeType | null {
    if (!s) return null;
    return (SWIM_STROKES as readonly string[]).includes(s) ? (s as SwimStrokeType) : null;
}

function safeEquipment(arr: string[] | null | undefined): string[] | null {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const cleaned = arr.map(s => String(s).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : null;
}

function normalizeRepeat(b: RawBlock): StructureRepeatBlock {
    return {
        type: 'Repeat',
        repeat: Math.max(1, Math.round(b.repeat ?? 1)),

        durationActifSecondes: b.durationActifSecondes ?? null,
        targetPowerWatts: b.targetPowerWatts ?? null,
        targetPaceMinPerKm: b.targetPaceMinPerKm ?? null,
        targetPaceMinPer100m: b.targetPaceMinPer100m ?? null,
        targetHeartRateBPM: b.targetHeartRateBPM ?? null,
        targetRPE: b.targetRPE ?? null,

        distanceMeters: b.distanceMeters ?? null,
        strokeType: safeStrokeType(b.strokeType),
        equipment: safeEquipment(b.equipment),

        durationRecupSecondes: b.durationRecupSecondes ?? null,
        targetRecupPowerWatts: b.targetRecupPowerWatts ?? null,
        targetRecupPaceMinPerKm: b.targetRecupPaceMinPerKm ?? null,
        targetRecupPaceMinPer100m: b.targetRecupPaceMinPer100m ?? null,
        targetRecupHeartRateBPM: b.targetRecupHeartRateBPM ?? null,
        targetRecupRPE: b.targetRecupRPE ?? null,

        description: b.description ?? '',
    };
}

function normalizeSimple(b: RawBlock): StructureSimpleBlock {
    const t = b.type;
    const safeType: StructureSimpleBlock['type'] =
        t === 'Warmup' || t === 'Active' || t === 'Rest' || t === 'Cooldown' ? t : 'Active';
    return {
        type: safeType,
        durationActifSecondes: b.durationActifSecondes ?? null,
        targetPowerWatts: b.targetPowerWatts ?? null,
        targetPaceMinPerKm: b.targetPaceMinPerKm ?? null,
        targetPaceMinPer100m: b.targetPaceMinPer100m ?? null,
        targetHeartRateBPM: b.targetHeartRateBPM ?? null,
        targetRPE: b.targetRPE ?? null,
        distanceKm: b.distanceKm ?? null,
        plannedTSS: b.plannedTSS ?? null,
        distanceMeters: b.distanceMeters ?? null,
        strokeType: safeStrokeType(b.strokeType),
        equipment: safeEquipment(b.equipment),
        reps: b.reps ?? null,
        sets: b.sets ?? null,
        loadKg: b.loadKg ?? null,
        description: b.description ?? '',
    };
}

function normalizeBlock(b: RawBlock): StructureBlock {
    return b.type === 'Repeat' ? normalizeRepeat(b) : normalizeSimple(b);
}

/**
 * Prend une description texte de séance et la convertit en tableau de blocs structurés.
 * Retourne [] si l'appel échoue — ne lève jamais, ne doit jamais casser le flux parent.
 */
export async function structureSessionDescription(params: {
    description: string;
    sportType: SportType;
    durationMinutes: number;
    profile: Profile;
}): Promise<{ structure: StructureBlock[]; tokensUsed: number }> {
    const { description, sportType, durationMinutes, profile } = params;

    const tStart = Date.now();

    if (!description || description.trim().length === 0) {
        console.warn(`[structureSessionDescription] ⚠️ description vide pour ${sportType} ${durationMinutes}min — skip`);
        return { structure: [], tokensUsed: 0 };
    }

    console.log(
        `[structureSessionDescription] ▶️ INPUT ${sportType} ${durationMinutes}min (desc=${description.length}ch)\n${description}`
    );

    const zonesContext = buildZonesContext(profile, sportType);

    const systemPrompt = `Tu convertis une description textuelle de séance d'entraînement en tableau JSON structuré de blocs.

LANGUE : français UNIQUEMENT. Le champ "description" de chaque bloc doit être rédigé en français. Termes techniques autorisés (FTP, TSS, RPE, VO2max, Z1-Z7, ainsi que le vocabulaire natation : Rattrapage, Manchot, Sculls, etc.).

TYPES DE BLOCS :
- "Warmup" (échauffement), "Active" (travail continu), "Rest" (récupération isolée), "Cooldown" (retour au calme) : blocs simples à intensité constante.
- "Repeat" : encapsule UNE phase active + UNE phase de récupération, exécutées N fois (voir règle RÉPÉTITIONS).

CHAMPS :
- "durationActifSecondes" : durée (en secondes) du bloc (pour un Repeat : durée de la phase active UNE répétition). OBLIGATOIRE pour cycling / running / other (endurance ou renfo temporisé) — ne renvoie JAMAIS null pour ces sports. Convertis systématiquement : "3 min" → 180, "30 sec" → 30, "1h" → 3600. Peut être null UNIQUEMENT pour la natation quand le volume est exprimé en mètres (voir section NATATION) ou pour du renfo basé uniquement sur reps/sets.
- targetPowerWatts / targetPaceMinPerKm / targetPaceMinPer100m / targetHeartRateBPM / targetRPE : cibles de la phase active (ou du bloc simple).
- Champs "Recup*" (durationRecupSecondes, targetRecupPowerWatts, etc.) : UNIQUEMENT pour type="Repeat". Définissent la phase de récupération ENTRE deux répétitions.
- "durationRecupSecondes" : OBLIGATOIRE pour tout bloc Repeat cycling / running dès qu'une récupération est mentionnée (ex: "récup 2 min", "2 min entre", "r=90\""). null UNIQUEMENT si la description ne mentionne vraiment aucune pause entre répétitions, ou pour la natation où la pause est au bord (exprimée en secondes comme "15'' R").
- distanceMeters / strokeType / equipment : SPÉCIFIQUES NATATION (voir section dédiée).

RÉPÉTITIONS — PRÉFÉRER "Repeat" DÈS QUE POSSIBLE :
- Règle d'or : utilise TOUJOURS un bloc "Repeat" plutôt qu'une suite de blocs "Active" + "Rest" dès qu'un motif identique (même durée/distance + même cible active + même récup) se répète ≥ 2 fois. Même si la description d'origine n'emploie pas la notation "NxY", tu DOIS détecter le motif et le compresser en Repeat.
- Dès qu'un motif "N x (Active X, Récup Y)" apparaît (explicitement "5x3 min" OU implicitement "3 min Z4, 2 min récup, 3 min Z4, 2 min récup, 3 min Z4"), utilise UN seul bloc "Repeat" avec :
  · repeat = N
  · durationActifSecondes + targetXxx = phase active
  · durationRecupSecondes + targetRecupXxx = phase récupération
- Détection implicite : si tu vois 2+ blocs consécutifs avec la même durée active + même cible + même récup, fusionne-les en UN Repeat. Ne génère pas "Active, Rest, Active, Rest, Active, Rest" — génère un Repeat repeat=3.
- Même raisonnement pour les sprints en échauffement : "3 sprints de 15s en Z5 avec X récup" → bloc Repeat repeat=3 (imbriqué dans l'échauffement si besoin : émets un Warmup simple pour la partie continue, puis un Repeat pour les sprints, puis éventuellement un Cooldown si la description enchaîne).
- Exemples :
  · "2x15min Z3 avec 5min récup Z2" → UN bloc Repeat : repeat=2, durationActifSecondes=900, targetPowerWatts=<milieu Z3>, durationRecupSecondes=300, targetRecupPowerWatts=<milieu Z2>.
  · "5x3 min Z4 (228-263 W), récup 2 min Z1 (<138 W)" → UN bloc Repeat : repeat=5, durationActifSecondes=180, targetPowerWatts=245, durationRecupSecondes=120, targetRecupPowerWatts=130. Les durées NE DOIVENT PAS être null.
  · "3x(1min Z5, 1min Z2)" → UN bloc Repeat : repeat=3, durationActifSecondes=60, targetPowerWatts=<milieu Z5>, durationRecupSecondes=60, targetRecupPowerWatts=<milieu Z2>.
  · "4x30s sprint / 1min récup" → UN bloc Repeat : repeat=4, durationActifSecondes=30, targetRPE=9, durationRecupSecondes=60, targetRecupRPE=3.
  · "3 sprints de 15 sec en Z5 (265-300 W)" (sans récup précisée) → UN bloc Repeat : repeat=3, durationActifSecondes=15, targetPowerWatts=282, durationRecupSecondes=null (ou durée de récup réaliste estimée si contexte l'impose).
  · NATATION "8x50m crawl 15'' R" → UN bloc Repeat : repeat=8, distanceMeters=50, strokeType="crawl", durationRecupSecondes=15.
- Pour une série VRAIMENT NON identique (ex: pyramide 1-2-3-2-1 min, ou 3 phases distinctes par rep) : N'utilise PAS Repeat. Liste chaque bloc individuellement avec type "Active" / "Rest". Mais avant d'y renoncer, vérifie qu'il n'y a vraiment aucun sous-motif répétable.
- Si pas de récupération définie entre les reps (ex: effort continu sans pause), laisse les champs Recup* à null mais utilise quand même Repeat.

CIBLES PAR SPORT — remplis UNIQUEMENT les champs pertinents, laisse les autres à null :
- cycling : targetPowerWatts (et targetRecupPowerWatts) en priorité, fallback targetHeartRateBPM, dernier recours targetRPE
- running : targetPaceMinPerKm (et targetRecupPaceMinPerKm) en priorité (format "M:SS"), fallback targetHeartRateBPM, dernier recours targetRPE
- swimming : voir section NATATION ci-dessous
- other (renforcement) : targetRPE + reps + sets + loadKg

NATATION — RÈGLES SPÉCIFIQUES (CRUCIAL) :
- distanceMeters : OBLIGATOIRE dès qu'une distance est mentionnée. Distance PAR RÉPÉTITION en mètres (ex: 50 pour "8x50m", 400 pour un échauffement de 400m). Si la description mentionne une distance pour ce bloc, ce champ ne doit JAMAIS être null.
- strokeType : OBLIGATOIRE pour tout bloc natation — "crawl" | "dos" | "brasse" | "papillon" | "4_nages" | "mixte". Si la nage est nommée → utilise-la. Si un éducatif de crawl est nommé (Rattrapage, 6 temps, etc.) → "crawl". Si un éducatif de dos est nommé → "dos". Pour les échauffements variés ("mixte", "crawl + dos + brasse") → "mixte". Par défaut si aucun indice → "crawl".
- equipment : tableau de strings du matériel utilisé (ex: ["planche"], ["pull-buoy"], ["palmes"], ["plaquettes", "pull-buoy"]). null si pas de matériel mentionné. Vocabulaire : planche, pull-buoy, palmes, plaquettes, tuba frontal, élastique.
- targetPaceMinPer100m : allure /100m au format "M:SS" (ex: "1:40"). Remplir si précisée dans le texte.
- durationActifSecondes : OPTIONNEL en natation. Laisse null si la distance suffit. Rempli seulement si la description donne un temps précis (ex: "1h de nage continue").
- durationRecupSecondes : récup au bord en secondes (ex: "10'' R" → 10, "15'' R" → 15, "20'' R" → 20).
- ÉDUCATIFS : si la description nomme un éducatif (Rattrapage, 6 temps, Manchot, Catch-up, Zip-up, Sculls, Profil, Superman, Poings fermés, Jambes avec planche, etc.), mets ce nom EXACT dans "description".
- INTERDIT de laisser strokeType et distanceMeters à null tous les deux sur un bloc natation — c'est le minimum vital pour le nageur.

EXEMPLES NATATION :
- "Échauffement 400m mixte (200m crawl, 100m dos, 100m brasse)" → 1 bloc Warmup : distanceMeters=400, strokeType="mixte", description="Échauffement varié".
- "8x50m crawl à allure seuil (1'40''/100m), 15'' R" → 1 bloc Repeat : repeat=8, distanceMeters=50, strokeType="crawl", targetPaceMinPer100m="1:40", durationRecupSecondes=15, description="Série seuil crawl".
- "4x100m Rattrapage avec palmes, 20'' R" → 1 bloc Repeat : repeat=4, distanceMeters=100, strokeType="crawl", equipment=["palmes"], durationRecupSecondes=20, description="Rattrapage".
- "6x50m jambes avec planche crawl, 15'' R" → 1 bloc Repeat : repeat=6, distanceMeters=50, strokeType="crawl", equipment=["planche"], durationRecupSecondes=15, description="Jambes avec planche".
- "200m retour au calme dos" → 1 bloc Cooldown : distanceMeters=200, strokeType="dos", description="Retour au calme".

CONVERSION DES ZONES :
- "Z2", "Z4", etc. → valeur numérique en prenant le MILIEU de la plage fournie dans les zones athlète.
- Si la description donne déjà une valeur précise (ex: "250W", "1'40''/100m"), utilise-la directement.
- Si aucune zone n'est définie, estime des valeurs cohérentes avec le niveau ou utilise targetRPE (1-10).

CHAMPS NON APPLICABLES :
- reps/sets/loadKg : null pour tout sport d'endurance.
- distanceKm : null sauf pour vélo/course quand la description mentionne explicitement des km pour ce bloc (en natation utilise distanceMeters, pas distanceKm).
- distanceMeters/strokeType/equipment : null hors natation.
- plannedTSS : null sauf si la description le mentionne explicitement pour ce bloc.

"description" du bloc : texte court (3-10 mots) décrivant son rôle ou le nom de l'éducatif (ex: "Échauffement progressif", "Rattrapage crawl", "Série seuil 2x15min"). Pour la natation : PRÉFÈRE le nom d'éducatif précis s'il est nommé dans la description source.

FORMAT DE RÉPONSE : tableau JSON strict validé par le schéma fourni. Aucune phrase autour.`;

    const userPrompt = `SPORT : ${sportType}
DURÉE TOTALE : ${durationMinutes} min

${zonesContext}

DESCRIPTION À STRUCTURER :
${description}`;

    console.log(`[structureSessionDescription] prompt input = sys:${systemPrompt.length}ch + user:${userPrompt.length}ch`);

    try {
        const tBeforeApi = Date.now();
        const { data, tokensUsed } = await callGeminiAPI({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: structureResponseSchema,
            },
        }, `struct/${sportType}`);
        const tApi = Date.now() - tBeforeApi;

        if (!Array.isArray(data)) {
            console.warn(`[structureSessionDescription] ⚠️ réponse IA non-tableau en ${tApi}ms, fallback []`);
            return { structure: [], tokensUsed };
        }

        const tTotal = Date.now() - tStart;
        console.log(
            `[structureSessionDescription] ✅ ${sportType} ${durationMinutes}min → ${data.length} blocs (${tokensUsed} tokens) | api=${tApi}ms, total=${tTotal}ms`
        );
        console.log(
            `[structureSessionDescription] JSON:\n${JSON.stringify(data, null, 2)}`
        );

        const structure: StructureBlock[] = (data as RawBlock[]).map(normalizeBlock);

        if (sportType !== 'swimming') {
            const missingDurations = structure
                .map((b, i) => ({ b, i }))
                .filter(({ b }) =>
                    (b.type === 'Repeat' && (b.durationActifSecondes == null || b.durationActifSecondes <= 0)) ||
                    (b.type !== 'Repeat' && (b.durationActifSecondes == null || b.durationActifSecondes <= 0))
                );
            if (missingDurations.length > 0) {
                console.warn(
                    `[structureSessionDescription] ⚠️ ${sportType} : ${missingDurations.length} bloc(s) sans durationActifSecondes — UI affichera "—". Indexes: ${missingDurations.map(x => x.i).join(',')}`
                );
            }
        }

        return { structure, tokensUsed };
    } catch (err) {
        const tTotal = Date.now() - tStart;
        console.error(`[structureSessionDescription] ❌ échec structuration après ${tTotal}ms, fallback []:`, err);
        return { structure: [], tokensUsed: 0 };
    }
}
