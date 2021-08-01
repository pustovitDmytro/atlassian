import { assert } from 'chai';
import '../Test';
import weekly from '../mock/fixtures/timeTrackers/weekly.json';
import points from '../mock/fixtures/timeTrackers/weeklyPoints.json';
import { load } from '../utils';

const TimeTracker = load('TimeTracker').default;
const ActionsStrategy = TimeTracker.strategies.actions_based;
const tracker = new TimeTracker('actions');

suite('Utils: TimeTracker [actions_based strategy]');

before(async function () {});

test('ActionsStrategy: splitParts', async function () {
    const strategy = new ActionsStrategy({
        calendar : weekly.calendar,
        issues   : weekly.issues,
        points
    });

    strategy.prepare();
    assert.deepEqual(
        strategy.points,
        {
            'B-1' : [ { 'type': 'transition.fromDev', 'date': '2021-07-26T14:30:39+03:00' } ],
            'B-2' : [ { 'type': 'transition.fromDev', 'date': '2021-07-26T10:00:39+03:00' }, { 'type': 'comment.mine', 'date': '2021-07-30T14:00:44.558+0300' }, { 'type': 'commit.mine', 'date': '2021-07-29T14:00:10.207+0300' } ],
            'B-3' : [],
            'B-4' : [ { 'type': 'commit.mine', 'date': '2021-07-28T12:00:44.558+0300' }, { 'type': 'comment.mine', 'date': '2021-07-30T14:00:44.558+0300' } ],
            'B-5' : []
        }
    );
    const parts = strategy.splitParts();

    weekly.issues.forEach(i => {
        const ps = parts.filter(p => p.issue === i.id);

        assert.isNotEmpty(ps, i.id);
        // eslint-disable-next-line unicorn/no-array-reduce
        assert.equal(ps.reduce((a, b) => a + b.time, 0), i.time, JSON.stringify(i));
    });
});

test('generate actions_based log jobs', async function () {
    const { sum, tasks, shrinks } = tracker.compute({
        calendar : weekly.calendar,
        issues   : weekly.issues,
        points
    });

    assert.deepEqual(sum, {
        'estimated' : 14.65,
        'expected'  : 40
    });

    assert.deepEqual(tasks, [
        { 'day': '26 Jul 2021', 'issue': 'B-2', 'time': 8 },
        { 'day': '27 Jul 2021', 'issue': 'B-2', 'time': 1.75 },
        { 'day': '27 Jul 2021', 'issue': 'B-1', 'time': 2.75 },
        { 'day': '27 Jul 2021', 'issue': 'B-3', 'time': 0.5 },
        { 'day': '27 Jul 2021', 'issue': 'B-5', 'time': 1.25 },
        { 'day': '27 Jul 2021', 'issue': 'B-4', 'time': 1.75 },
        { 'day': '28 Jul 2021', 'issue': 'B-4', 'time': 5.5 },
        { 'day': '28 Jul 2021', 'issue': 'B-2', 'time': 2.5 },
        { 'day': '29 Jul 2021', 'issue': 'B-2', 'time': 7.25 },
        { 'day': '29 Jul 2021', 'issue': 'B-2', 'time': 0.75 },
        { 'day': '30 Jul 2021', 'issue': 'B-2', 'time': 4.25 },
        { 'day': '30 Jul 2021', 'issue': 'B-4', 'time': 3.75 }
    ]);

    assert.isNotEmpty(shrinks);
    shrinks.forEach(s => {
        assert.isAtLeast(s, 2.5);
        assert.isAtMost(s, 3.35);
    });
});

after(async function () {});
