import { useMemo } from 'react';

export function useCalendarDays(selectedDate: Date) {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const weekRows = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = (firstDay.getDay() + 6) % 7; // 6 = dimanche
        const daysInMonth = lastDay.getDate();

        const rows: (Date | null)[][] = [];
        let currentWeek: (Date | null)[] = [];

        // Jours du mois précédent (grisés mais visibles)
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            currentWeek.push(new Date(year, month - 1, prevMonthLastDay - i));
        }

        // Jours du mois courant
        for (let day = 1; day <= daysInMonth; day++) {
            if (currentWeek.length === 7) {
                rows.push(currentWeek);
                currentWeek = [];
            }
            currentWeek.push(new Date(year, month, day));
        }

        // Jours du mois suivant (grisés mais visibles)
        let nextMonthDay = 1;
        while (currentWeek.length < 7) {
            currentWeek.push(new Date(year, month + 1, nextMonthDay++));
        }
        rows.push(currentWeek);

        return rows;
    }, [year, month]);

    return { year, month, weekRows };
}
