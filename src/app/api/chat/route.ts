export const runtime = 'nodejs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STREAM_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
    role: 'user' | 'ai';
    text: string;
}

interface ActiveSports {
    cycling:  boolean;
    running:  boolean;
    swimming: boolean;
}

interface ChatContext {
    firstName:      string;
    lastName:       string;
    experience:     string;
    currentCTL:     number;
    activeSports:   ActiveSports;
    goal:           string;
    objectiveDate:  string;
    recentWorkouts: {
        date:      string;
        sportType: string;
        title:     string;
        duration:  number;
        tss:       number;
        status:    string;
    }[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: ChatContext): string {
    const sports = (Object.entries(ctx.activeSports) as [string, boolean][])
        .filter(([, v]) => v)
        .map(([k]) => ({ cycling: 'Cyclisme', running: 'Course à pied', swimming: 'Natation' }[k] ?? k))
        .join(', ');

    const workoutsBlock = ctx.recentWorkouts.length > 0
        ? ctx.recentWorkouts
            .slice(-10)
            .map(w => `  • ${w.date} | ${w.sportType} | ${w.title} | ${w.duration}min | TSS ${w.tss} | ${w.status}`)
            .join('\n')
        : '  Aucune séance récente.';

    return `Tu es Coach IA PulsePeak, un coach de triathlon expert, bienveillant et concis.
Tu aides l'athlète à progresser, comprendre son entraînement, récupérer intelligemment et rester motivé.

━━━ PROFIL ━━━
Prénom      : ${ctx.firstName} ${ctx.lastName}
Niveau      : ${ctx.experience}
Sports      : ${sports || 'Non définis'}
CTL actuelle: ${ctx.currentCTL}
Objectif    : ${ctx.goal}
Date cible  : ${ctx.objectiveDate}

━━━ SÉANCES RÉCENTES ━━━
${workoutsBlock}

━━━ RÈGLES ━━━
- Toujours en français, ton encourageant et professionnel
- Réponses courtes et actionnables (3-5 phrases sauf si demande détaillée)
- Réfère-toi aux données du profil quand pertinent
- Ne jamais inventer des données non fournies`;
}

// ─── Messages formatter (format Gemini contents[]) ───────────────────────────

function toGeminiContents(messages: ChatMessage[]) {
    // Gemini : rôles "user" et "model", alternance stricte, commence par "user"
    const filtered = messages
        .filter(m => m.text.trim().length > 0)
        .map(m => ({
            role:  m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }],
        }));

    // Commence par le 1er message "user"
    const firstUserIdx = filtered.findIndex(m => m.role === 'user');
    if (firstUserIdx < 0) return [];
    const trimmed = filtered.slice(firstUserIdx);

    // Dédoublonne les rôles consécutifs identiques
    const deduped: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of trimmed) {
        if (deduped.length === 0 || deduped[deduped.length - 1].role !== msg.role) {
            deduped.push(msg);
        }
    }

    return deduped;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { messages, context }: { messages: ChatMessage[]; context: ChatContext } =
            await req.json();

        if (!GEMINI_API_KEY) {
            return new Response('GEMINI_API_KEY non configurée.', { status: 500 });
        }

        const contents = toGeminiContents(messages);
        if (contents.length === 0) {
            return new Response('Aucun message valide.', { status: 400 });
        }

        const payload = {
            system_instruction: { parts: [{ text: buildSystemPrompt(context) }] },
            contents,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        };

        // Appel Gemini streaming — l'erreur éventuelle est levée ICI (avant de retourner la Response)
        const geminiRes = await fetch(`${STREAM_URL}&key=${GEMINI_API_KEY}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });

        if (!geminiRes.ok || !geminiRes.body) {
            const err = await geminiRes.text();
            return new Response(`Erreur Gemini ${geminiRes.status}: ${err}`, { status: 502 });
        }

        // Parse le SSE Gemini et re-stream uniquement le texte vers le client
        const readable = new ReadableStream({
            async start(controller) {
                const encoder  = new TextEncoder();
                const reader   = geminiRes.body!.getReader();
                const decoder  = new TextDecoder();
                let   buffer   = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() ?? '';   // garde la ligne incomplète

                        for (const line of lines) {
                            if (!line.startsWith('data: ')) continue;
                            const jsonStr = line.slice(6).trim();
                            if (!jsonStr || jsonStr === '[DONE]') continue;

                            try {
                                const chunk = JSON.parse(jsonStr);
                                const text: string =
                                    chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                                if (text) {
                                    controller.enqueue(encoder.encode(text));
                                }
                            } catch {
                                // ligne SSE mal formée, on ignore
                            }
                        }
                    }
                } catch {
                    controller.enqueue(encoder.encode('⚠️ Erreur pendant la génération.'));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(readable, {
            status:  200,
            headers: {
                'Content-Type':      'text/plain; charset=utf-8',
                'Cache-Control':     'no-cache',
                'X-Accel-Buffering': 'no',
            },
        });

    } catch (err) {
        console.error('[/api/chat]', err);
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        return new Response(msg, { status: 500 });
    }
}
