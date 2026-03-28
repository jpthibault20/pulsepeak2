'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[App Error]', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="text-center max-w-sm">
                <p className="text-slate-500 text-sm font-mono mb-2">Erreur</p>
                <h1 className="text-2xl font-bold text-white mb-3">Quelque chose s&apos;est mal passé</h1>
                <p className="text-slate-400 text-sm mb-6">
                    Une erreur inattendue est survenue. Réessaie ou contacte le support si le problème persiste.
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                    >
                        Réessayer
                    </button>
                    <a
                        href="/"
                        className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                    >
                        Accueil
                    </a>
                </div>
            </div>
        </div>
    );
}
