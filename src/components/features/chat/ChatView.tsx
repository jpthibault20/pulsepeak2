'use client';

import { Bot, Send, Loader2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Profile, Schedule } from "@/lib/data/DatabaseTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
    role: 'user' | 'ai';
    text: string;
    streaming?: boolean;
}

interface ChatViewProps {
    profile?: Profile;
    schedule?: Schedule;
}
// ─── Context builder ──────────────────────────────────────────────────────────

function buildContext(profile?: Profile, schedule?: Schedule) {
    const recentWorkouts = (schedule?.workouts ?? [])
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10)
        .map(w => ({
            date: w.date,
            sportType: w.sportType,
            title: w.title,
            duration: w.plannedData?.durationMinutes ?? 0,
            tss: w.plannedData?.plannedTSS ?? 0,
            status: w.status,
        }));

    return {
        firstName: profile?.firstName ?? 'Athlète',
        lastName: profile?.lastName ?? '',
        experience: profile?.experience ?? 'Inconnu',
        currentCTL: profile?.currentCTL ?? 0,
        activeSports: profile?.activeSports ?? { cycling: false, running: false, swimming: false },
        goal: profile?.goal ?? 'Non défini',
        objectiveDate: profile?.objectiveDate ?? 'Non définie',
        recentWorkouts,
    };
}

// ─── Sport labels ──────────────────────────────────────────────────────────────

function getSportLabels(profile?: Profile): string {
    if (!profile) return '';
    const labels: string[] = [];
    if (profile.activeSports.cycling) labels.push('Vélo');
    if (profile.activeSports.running) labels.push('Course');
    if (profile.activeSports.swimming) labels.push('Natation');
    return labels.join(' · ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatView({ profile, schedule }: ChatViewProps) {
    const welcomeText = `Bonjour\u00a0${profile?.firstName ?? ''}\u00a0! Je suis votre Coach IA PulsePeak. Posez-moi vos questions sur l'entraînement, la récupération ou votre plan.`;

    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: welcomeText },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);


    // Update welcome message if profile loads after mount
    useEffect(() => {
        if (profile?.firstName) {
            setMessages(prev => {
                if (prev.length === 1 && prev[0].role === 'ai') {
                    return [{ role: 'ai', text: welcomeText }];
                }
                return prev;
            });
        }
    }, [profile?.firstName, welcomeText]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 150);
    }, []);

    const handleSend = async (text?: string) => {
        const msg = (text ?? input).trim();
        if (!msg || loading) return;

        const userMessage: Message = { role: 'user', text: msg };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        const aiPlaceholder: Message = { role: 'ai', text: '', streaming: true };
        setMessages([...newMessages, aiPlaceholder]);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    context: buildContext(profile, schedule),
                }),
            });

            if (!response.ok || !response.body) {
                const errText = await response.text().catch(() => '');
                throw new Error(errText || `Erreur ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                aiText += decoder.decode(value, { stream: true });
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'ai', text: aiText, streaming: true };
                    return updated;
                });
            }

            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'ai', text: aiText };
                return updated;
            });

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Erreur inconnue';
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'ai', text: `⚠️ ${errMsg}` };
                return updated;
            });
        } finally {
            setLoading(false);
        }
    };

    const sportLabels = getSportLabels(profile);

    return (
        <div className="flex flex-col h-[calc(100dvh-56px-80px)] md:h-[calc(100dvh-56px)] max-w-2xl mx-auto">

            {/* ── Context pill ── */}
            {profile && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800/60">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {profile.firstName} {profile.lastName}
                        </span>
                        {profile.experience && (
                            <>
                                <span className="text-slate-300 dark:text-slate-700 text-xs">·</span>
                                <span className="text-xs text-slate-500">{profile.experience}</span>
                            </>
                        )}
                        {profile.currentCTL > 0 && (
                            <>
                                <span className="text-slate-300 dark:text-slate-700 text-xs">·</span>
                                <span className="flex items-center gap-0.5 text-xs text-slate-500">
                                    <Zap size={10} className="text-yellow-500/70" />
                                    CTL {profile.currentCTL}
                                </span>
                            </>
                        )}
                        {sportLabels && (
                            <>
                                <span className="text-slate-300 dark:text-slate-700 text-xs">·</span>
                                <span className="text-xs text-slate-500">{sportLabels}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Messages ── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {/* AI avatar */}
                        {msg.role === 'ai' && (
                            <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0 mb-0.5">
                                <Bot size={14} className="text-blue-600 dark:text-blue-400" />
                            </div>
                        )}

                        {/* Bubble */}
                        <div className={`
                            max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                            ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 rounded-bl-sm border border-slate-200 dark:border-slate-700/50'
                            }
                        `}>
                            {msg.text ? msg.text : (msg.streaming && (
                                <span className="flex gap-1 items-center h-4 px-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Input ── */}
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <div className="flex gap-2 items-center">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder="Posez votre question..."
                        disabled={loading}
                        className="flex-1 h-11 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-60 transition-colors"
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={loading || !input.trim()}
                        className="w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl text-white transition-colors shrink-0"
                    >
                        {loading
                            ? <Loader2 size={16} className="animate-spin" />
                            : <Send size={16} />
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
