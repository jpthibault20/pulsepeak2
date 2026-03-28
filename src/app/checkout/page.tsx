import React, { Suspense } from 'react';
import { CheckoutContent } from './CheckoutContent';

export const metadata = { title: 'Finaliser l\'abonnement · PulsePeak' };

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
