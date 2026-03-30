import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/data/crud';
import { PricingContent } from './PricingContent';
import type { Plan } from '@/lib/subscription/context';

export default async function PricingPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth');
    }

    const profile = await getProfile();
    const currentPlan = (profile?.plan ?? 'free') as Plan;

    return <PricingContent currentPlan={currentPlan} />;
}
