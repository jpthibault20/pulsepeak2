'use client';

import React from 'react';
import { Zap, User, Sparkles, Trophy, AlertCircle } from 'lucide-react';
import type { Plan, Status } from '@/lib/subscription/context';

interface PlanBadgeProps {
    plan:    Plan;
    status?: Status;
    size?:   'sm' | 'md';
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({ plan, status = 'active', size = 'md' }) => {
    const isPastDue = status === 'past_due';

    const config = {
        free: {
            label: 'FREE',
            icon:  User,
            className: 'bg-slate-800 border-slate-600 text-slate-300',
        },
        pro: isPastDue ? {
            label: 'PRO · Paiement requis',
            icon:  AlertCircle,
            className: 'bg-red-500/10 border-red-500/30 text-red-400',
        } : status === 'trial' ? {
            label: 'ESSAI PRO',
            icon:  Sparkles,
            className: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        } : {
            label: 'PRO',
            icon:  Zap,
            className: 'bg-blue-600/10 border-blue-500/30 text-blue-300',
        },
        elite: {
            label: 'CHAMPION',
            icon:  Trophy,
            className: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
        },
    }[plan];

    const Icon = config.icon;
    const iconSize  = size === 'sm' ? 11 : 13;
    const textClass = size === 'sm' ? 'text-[10px]' : 'text-xs';
    const px        = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${px} ${textClass} ${config.className}`}>
            <Icon size={iconSize} />
            {config.label}
            {plan === 'pro' && status === 'trial' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
        </span>
    );
};
