'use server';

import { getObjectives, saveObjective, deleteObjective } from '@/lib/data/crud';
import { Objective } from '@/lib/data/DatabaseTypes';
import { ReturnCode } from '@/lib/data/type';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export async function getObjectivesAction(): Promise<Objective[]> {
    try {
        return await getObjectives();
    } catch (err) {
        console.error('[getObjectivesAction]', err);
        return [];
    }
}

export async function saveObjectiveAction(
    obj: Partial<Objective> & { name: string; date: string; sport: Objective['sport']; priority: Objective['priority'] }
): Promise<{ state: ReturnCode; objective?: Objective }> {
    try {
        const now = new Date().toISOString();
        const complete: Objective = {
            id:             obj.id ?? randomUUID(),
            userId:         obj.userId ?? '',
            createdAt:      obj.createdAt ?? now,
            updatedAt:      now,
            name:           obj.name,
            date:           obj.date,
            sport:          obj.sport,
            distanceKm:     obj.distanceKm,
            elevationGainM: obj.elevationGainM,
            priority:       obj.priority,
            status:         obj.status ?? 'upcoming',
            comment:        obj.comment,
        };
        await saveObjective(complete);
        revalidatePath('/');
        return { state: ReturnCode.RC_OK, objective: complete };
    } catch (err) {
        console.error('[saveObjectiveAction]', err);
        return { state: ReturnCode.RC_Error };
    }
}

export async function deleteObjectiveAction(id: string): Promise<{ state: ReturnCode }> {
    try {
        await deleteObjective(id);
        revalidatePath('/');
        return { state: ReturnCode.RC_OK };
    } catch (err) {
        console.error('[deleteObjectiveAction]', err);
        return { state: ReturnCode.RC_Error };
    }
}
