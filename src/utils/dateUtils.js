import dayjs from '../date';

const WEEKEND_INDEXES = new Set([ 0, 6 ]); // eslint-disable-line no-magic-numbers

export function workingDays({ include = [], exclude = [], to, from }) {
    const start = dayjs.min([ dayjs(from), ...include ]);
    const end = dayjs.max([ dayjs(to), ...include ]);
    const totalDays = dayjs(end).diff(dayjs(start), 'day') + 1;
    const days = [];

    for (let i = 0; i < totalDays; i++) {
        const day = dayjs.utc(from).add(i, 'days').startOf('day');

        let insert = !WEEKEND_INDEXES.has(day.day());

        if (exclude.length > 0 && exclude.some(d => d.isSame(day, 'day'))) {
            insert = false;
        }

        if (day > dayjs(to) || day < dayjs(from)) {
            insert = false;
        }

        if (include.length > 0 && include.some(d => d.isSame(day, 'day'))) {
            insert = true;
        }

        if (insert) days.push(day);
    }

    return days;
}
