import { assert } from 'chai';
import dayjs from 'dayjs';
import '../Test';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { load } from '../utils';

dayjs.extend(customParseFormat);

const { workingDays } = load('utils');

suite('Utils: workingDays');

before(async function () {});

test('include end date into range', async function () {
    const res = workingDays({
        from : dayjs('01.01.2021', 'DD.MM.YYYY', true),
        to   : dayjs('15.01.2021', 'DD.MM.YYYY', true)
    });

    assert.deepEqual(res.map(d => d.format('DD MMM (ddd)')), [
        '01 Jan (Fri)',

        '04 Jan (Mon)',
        '05 Jan (Tue)',
        '06 Jan (Wed)',
        '07 Jan (Thu)',
        '08 Jan (Fri)',

        '11 Jan (Mon)',
        '12 Jan (Tue)',
        '13 Jan (Wed)',
        '14 Jan (Thu)',
        '15 Jan (Fri)'
    ]);
});

test('custom include/exclude dates', async function () {
    const res = workingDays({
        from    : dayjs('01.01.2021', 'DD.MM.YYYY', true),
        to      : dayjs('15.01.2021', 'DD.MM.YYYY', true),
        include : [ dayjs('09.01.2021', 'DD.MM.YYYY', true) ],
        exclude : [ dayjs('07.01.2021', 'DD.MM.YYYY', true) ]
    });

    assert.deepEqual(res.map(d => d.format('DD MMM (ddd)')), [
        '01 Jan (Fri)',

        '04 Jan (Mon)',
        '05 Jan (Tue)',
        '06 Jan (Wed)',
        '08 Jan (Fri)',
        '09 Jan (Sat)',

        '11 Jan (Mon)',
        '12 Jan (Tue)',
        '13 Jan (Wed)',
        '14 Jan (Thu)',
        '15 Jan (Fri)'
    ]);
});


test('allow include be out of range', async function () {
    const res = workingDays({
        from    : dayjs('01.01.2021', 'DD.MM.YYYY', true),
        to      : dayjs('15.01.2021', 'DD.MM.YYYY', true),
        include : [ dayjs('20.01.2021', 'DD.MM.YYYY', true) ]
    });

    assert.deepEqual(res.map(d => d.format('DD MMM (ddd)')), [
        '01 Jan (Fri)',

        '04 Jan (Mon)',
        '05 Jan (Tue)',
        '06 Jan (Wed)',
        '07 Jan (Thu)',
        '08 Jan (Fri)',

        '11 Jan (Mon)',
        '12 Jan (Tue)',
        '13 Jan (Wed)',
        '14 Jan (Thu)',
        '15 Jan (Fri)',

        '20 Jan (Wed)'
    ]);
});


after(async function () {});
