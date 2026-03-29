'use client';

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
            <div className="text-center">
                <p className="text-slate-500 dark:text-slate-500 text-sm font-mono mb-2">404</p>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Page introuvable</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Cette page n&apos;existe pas ou a été déplacée.</p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                    Retour à l&apos;accueil
                </Link>
            </div>
        </div>
    );
}
