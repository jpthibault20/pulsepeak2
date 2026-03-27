'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Veuillez entrer votre adresse email.');
            return;
        }
        setIsLoading(true);
        setError(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=/auth/reset-password`,
        });

        if (error) {
            setError(error.message);
            setIsLoading(false);
            return;
        }

        setSent(true);
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-800/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">

                {/* Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-900/40 mb-4">
                        <Zap size={28} className="text-white" fill="currentColor" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">PulsePeak</h1>
                    <p className="text-slate-400 text-sm mt-1">Réinitialisation du mot de passe</p>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-6">

                    {!sent ? (
                        <>
                            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                            </p>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm">
                                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Adresse email
                                    </label>
                                    <div className="relative">
                                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="nom@exemple.com"
                                            autoFocus
                                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30 mt-2"
                                >
                                    {isLoading ? (
                                        <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
                                    ) : (
                                        'Envoyer le lien de réinitialisation'
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                                <CheckCircle2 size={28} className="text-emerald-400" />
                            </div>
                            <h2 className="text-white font-semibold text-lg mb-2">Email envoyé !</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Un lien de réinitialisation a été envoyé à <span className="text-slate-200 font-medium">{email}</span>.
                                Pensez à vérifier vos spams.
                            </p>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => router.push('/auth')}
                        className="mt-6 w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm transition-colors py-2"
                    >
                        <ArrowLeft size={15} />
                        Retour à la connexion
                    </button>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6">
                    PulsePeak · Triathlon Training Intelligence
                </p>
            </div>
        </div>
    );
}
