import { assert } from 'chai';
import '../Test';
import weekly from '../mock/fixtures/timeTrackers/weekly.json';
import { load } from '../utils';

const TimeTracker = load('TimeTracker').default;
const tracker = new TimeTracker('id');

suite('Utils: TimeTracker [id_based strategy]');

before(async function () {});

test('empty input data', async function () {
    assert.deepEqual(
        tracker.compute({ calendar: {}, issues: [] }),
        {
            sum     : { expected: 0, estimated: 0 },
            tasks   : [],
            shrinks : []
        }
    );
});

test('generate id_based log jobs', async function () {
    const { sum, tasks, shrinks } = tracker.compute(weekly);

    assert.deepEqual(sum, {
        'estimated' : 14.65,
        'expected'  : 40
    });
    assert.deepEqual(tasks, [
        { 'day': '26 Jul 2021', 'time': 2.75, 'issue': 'B-1' },
        { 'day': '26 Jul 2021', 'time': 5.25, 'issue': 'B-2' },
        { 'day': '27 Jul 2021', 'time': 8, 'issue': 'B-2' },
        { 'day': '28 Jul 2021', 'time': 8, 'issue': 'B-2' },
        { 'day': '29 Jul 2021', 'time': 3.25, 'issue': 'B-2' },
        { 'day': '29 Jul 2021', 'time': 0.5, 'issue': 'B-3' },
        { 'day': '29 Jul 2021', 'time': 4.25, 'issue': 'B-4' },
        { 'day': '30 Jul 2021', 'time': 6.75, 'issue': 'B-4' },
        { 'day': '30 Jul 2021', 'time': 1.25, 'issue': 'B-5' }
    ]);

    assert.isNotEmpty(shrinks);
    shrinks.forEach(s => {
        assert.isAtLeast(s, 2.5);
        assert.isAtMost(s, 3.35);
    });
});

after(async function () {});
