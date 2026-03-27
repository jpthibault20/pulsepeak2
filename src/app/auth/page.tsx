'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createInitialProfile } from '@/app/actions/auth';
import Image from 'next/image';


type Tab = 'login' | 'register';

interface FormInput {
    label: string;
    type: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    isPassword?: boolean;
}

function InputField({ label, type, placeholder, value, onChange, isPassword }: FormInput) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
            <div className="relative">
                <input
                    type={isPassword ? (show ? 'text' : 'password') : type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={isPassword ? 'current-password' : undefined}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors pr-10"
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShow(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function AuthPage() {
    const router = useRouter();
    const supabase = createClient();

    const [tab, setTab] = useState<Tab>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Login fields
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Lire l'erreur depuis les query params (ex: après un callback raté)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('error')) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError('Une erreur est survenue. Veuillez réessayer.');
        }
    }, []);

    const resetMessages = () => {
        setError(null);
        setSuccess(null);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        if (!loginEmail || !loginPassword) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword,
        });
        if (error) {
            setError(error.message === 'Invalid login credentials'
                ? 'Email ou mot de passe incorrect.'
                : error.message);
            setIsLoading(false);
            return;
        }
        router.push('/');
        router.refresh();
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        if (!firstName || !lastName || !registerEmail || !registerPassword || !confirmPassword) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        if (registerPassword.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }
        if (registerPassword !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        setIsLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email: registerEmail,
            password: registerPassword,
            options: {
                data: { first_name: firstName, last_name: lastName },
            },
        });
        if (error) {
            setError(error.message);
            setIsLoading(false);
            return;
        }
        // Créer le profil en DB dès que l'userId est disponible.
        // Si confirmation email désactivée : session déjà active, profil créé immédiatement.
        // Si confirmation email requise : profil créé ici en avance, callback n'a rien à faire.
        if (data.user) {
            await createInitialProfile(data.user.id, firstName, lastName, registerEmail);
        }
        // Si session immédiate (pas de confirmation email), rediriger directement.
        if (data.session) {
            router.push('/');
            router.refresh();
            return;
        }
        setSuccess('Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse.');
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">

            {/* Fond décoratif */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-800/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">

                {/* Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-900/40 mb-4">
                        <Image
                            src="/logoWhite.png"
                            alt="Logo"
                            width={40}
                            height={40}
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-white tracking-tight">PulsePeak</h1>
                    <p className="text-slate-400 text-sm mt-1">Votre coach triathlon intelligent</p>
                </div>

                {/* Card */}
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">

                    {/* Onglets */}
                    <div className="flex border-b border-slate-800">
                        {(['login', 'register'] as Tab[]).map(t => (
                            <button
                                key={t}
                                onClick={() => { setTab(t); resetMessages(); }}
                                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === t
                                    ? 'text-white border-b-2 border-blue-500 bg-blue-600/5'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                {t === 'login' ? 'Connexion' : 'Créer un compte'}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">

                        {/* Message d'erreur */}
                        {error && (
                            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm">
                                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        {/* Message de succès */}
                        {success && (
                            <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-5 text-emerald-400 text-sm">
                                <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                                {success}
                            </div>
                        )}

                        {/* ── Formulaire Connexion ── */}
                        {tab === 'login' && (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <InputField
                                    label="Adresse email"
                                    type="email"
                                    placeholder="nom@exemple.com"
                                    value={loginEmail}
                                    onChange={setLoginEmail}
                                />
                                <InputField
                                    label="Mot de passe"
                                    type="password"
                                    placeholder="••••••••"
                                    value={loginPassword}
                                    onChange={setLoginPassword}
                                    isPassword
                                />

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                        onClick={() => {/* TODO: mot de passe oublié */ }}
                                    >
                                        Mot de passe oublié ?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30 mt-2"
                                >
                                    {isLoading ? (
                                        <><Loader2 size={16} className="animate-spin" /> Connexion...</>
                                    ) : (
                                        <><Activity size={16} /> Se connecter</>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* ── Formulaire Inscription ── */}
                        {tab === 'register' && (
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <InputField
                                        label="Prénom"
                                        type="text"
                                        placeholder="Jean"
                                        value={firstName}
                                        onChange={setFirstName}
                                    />
                                    <InputField
                                        label="Nom"
                                        type="text"
                                        placeholder="Dupont"
                                        value={lastName}
                                        onChange={setLastName}
                                    />
                                </div>
                                <InputField
                                    label="Adresse email"
                                    type="email"
                                    placeholder="nom@exemple.com"
                                    value={registerEmail}
                                    onChange={setRegisterEmail}
                                />
                                <InputField
                                    label="Mot de passe"
                                    type="password"
                                    placeholder="6 caractères minimum"
                                    value={registerPassword}
                                    onChange={setRegisterPassword}
                                    isPassword
                                />
                                <InputField
                                    label="Confirmer le mot de passe"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={setConfirmPassword}
                                    isPassword
                                />

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30 mt-2"
                                >
                                    {isLoading ? (
                                        <><Loader2 size={16} className="animate-spin" /> Création du compte...</>
                                    ) : (
                                        <><ArrowRight size={16} /> Créer mon compte</>
                                    )}
                                </button>

                                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                                    En créant un compte, vous acceptez nos conditions d&apos;utilisation.
                                </p>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-6">
                    PulsePeak · Triathlon Training Intelligence
                </p>
            </div>
        </div>
    );
}
