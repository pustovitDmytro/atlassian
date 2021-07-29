import dayjs from '../date';

const WEEKEND_INDEXES = new Set([ 0, 6 ]); // eslint-disable-line no-magic-numbers

export function workingDays({ include = [], exclude = [], to, from } = {}) {
    const totalDays = dayjs(to).diff(dayjs(from), 'day') + 1;
    const days = [];

    for (let i = 0; i < totalDays; i++) {
        const day = dayjs(from)
            .add(i, 'days')
            .startOf('day');

        let insert = !WEEKEND_INDEXES.has(day.day());


        if (exclude.length > 0 && exclude.some(d => d.isSame(day, 'day'))) {
            insert = false;
        }

        if (to && (day > dayjs(to))) {
            insert = false;
        }

        if (from && (day < dayjs(from))) {
            insert = false;
        }

        if (include.length > 0 && include.some(d => d.isSame(day, 'day'))) {
            insert = true;
        }

        if (insert) days.push(day);
    }

    return days;
}
