/* eslint-disable unicorn/no-array-reduce */
import dayjs from './date';

function valuesSum(dict) {
    return Object.values(dict).reduce((a, b) => a + b, 0);
}

const MIN_LOGGED_TIME = 0.25;
const ROUND_LOGGED_TIME = 0.25;
const CALENDAR_FORMAT = 'D MMM YYYY';

function round(value, step) {
    const inv = 1 / step;

    return Math.round(value * inv) / inv;
}

const avgWeight = 0.5;

function holeMetric(d) {
    return d.accum.time + avgWeight * d.d3.time + avgWeight * d.d5.time;
}

function holeSort(a, b) {
    return holeMetric(a) - holeMetric(b);
}

class BaseStrategy {
    constructor({ calendar, issues }) {
        this.calendar = calendar;
        this.issues = issues;
    }

    prepare() {
        this._times = {};
        for (const issue of this.issues.filter(iss => iss.time)) {
            this._times[issue.id] = issue.time;
        }

        this.sum = {
            expected  : valuesSum(this.calendar),
            estimated : valuesSum(this._times)
        };

        this.shrinks = [];
    }

    fillTime(parts) {
        const next = [ Object.keys(this.calendar)[0], 0 ];
        const tasks = [];

        for (const part of parts) {
            const est = this.getPartTime(part);
            const norm = Math.max(
                round(this.sum.expected * est / this.sum.estimated, ROUND_LOGGED_TIME),
                MIN_LOGGED_TIME
            );

            this.shrinks.push(norm / est);

            let leftToAdd = norm;

            for (const [ index, [ day, amount ] ] of Object.entries(this.calendar).entries()) {
                if (day !== next[0]) continue;
                const currentDayLeft = amount - next[1];

                if (currentDayLeft > leftToAdd) {
                    tasks.push({ day, time: leftToAdd, issue: part.issue });
                    next[1] = next[1] + leftToAdd;
                    leftToAdd = 0;
                } else {
                    tasks.push({ day, time: currentDayLeft, issue: part.issue });
                    if (index === Object.entries(this.calendar).length - 1) continue;
                    leftToAdd -= currentDayLeft;
                    next[1] = 0;
                    next[0] = Object.entries(this.calendar)[index + 1][0];
                }
            }
        }

        return tasks;
    }

    run() {
        this.prepare();
        const parts = this.splitParts();

        const tasks = this.fillTime(parts);

        return this.prettifyJobs(tasks);
    }

    prettifyJobs(jobs) {
        return jobs
            .filter(t => t.time > 0);
    }
}

class ActionsStrategy extends BaseStrategy {
    static ACTION_WEIGHTS = {
        'comment.mine'       : 0.5,
        'commit.mine'        : 1,
        'transition.fromDev' : 1
    }

    constructor({ points, ...rest }) {
        super(rest);
        this._points = points;
    }

    get weights() {
        const ws = this.constructor.ACTION_WEIGHTS;
        const sum = valuesSum(ws);
        const weight = {};

        for (const key of Object.keys(ws)) {
            weight[key] = ws[key] / sum;
        }

        return weight;
    }

    prepare() {
        super.prepare();
        this._preparePoints();
    }

    _preparePoints() {
        this.points = {};

        for (const isuueId of Object.keys(this._times)) {
            this.points[isuueId] = (this._points[isuueId] || [])
                .filter(({ type }) => this.weights[type]);
        }
    }

    _calcDensity(parts) {
        const callendarDensity = [];

        function avg(ind, lag) {
            const accum = [];

            for (let i = +ind - lag; i <= +ind + lag; i++) {
                const item = callendarDensity[i];

                if (item) accum.push(item.accum);
            }

            return accum.reduce((prev, curr) => ({
                time  : (prev.time || 0) + curr.time / accum.length,
                parts : (prev.parts || 0) + curr.parts / accum.length
            }), {});
        }

        for (const [ date, expected ] of Object.entries(this.calendar)) {
            const ps = parts.filter(p => {
                const d = p.point?.date;

                return d && dayjs(date).isSame(d, 'day');
            });
            const psSum = ps.reduce((a, b) => a + b.time, 0);

            callendarDensity.push({
                date,
                expected,
                accum : {
                    time  : psSum,
                    parts : ps.length
                }
            });
        }

        // eslint-disable-next-line guard-for-in
        for (const ind in callendarDensity) {
            const item = callendarDensity[ind];

            // eslint-disable-next-line no-magic-numbers
            item.d5 = avg(ind, 2);
            item.d3 = avg(ind, 1);
        }

        return callendarDensity;
    }

    _sortParts(parts) {
        return parts.sort((a, b) => {
            return dayjs(a.point.date).isBefore(b.point.date) ? -1 : 1;
        });
    }

    isMatchingHole(holeDate, issueId) {
        const actions = this._points[issueId] || [];
        const created = actions.find(a => a.type === 'created');
        const updated = actions.find(a => a.type === 'updated');

        return {
            created : !created || dayjs(created).isBefore(holeDate),
            updated : !updated || dayjs(updated).isAfter(holeDate)
        };
    }

    fillHoles(parts) {
        const holesCount = parts.filter(p => !p.point).length;

        Array.from({ length: holesCount })
            .forEach(() => {
                const unmatched = parts.filter(p => !p.point);
                const callendarDensity = this._calcDensity(parts);
                const [ deepestHole ] = callendarDensity.sort(holeSort);
                const holeDate = dayjs.utc(deepestHole.date, CALENDAR_FORMAT, true);

                const [ bestPart ] = unmatched.sort((a, b) => {
                    const order = 1;
                    const matchA = this.isMatchingHole(holeDate, a.issueId);
                    const matchB = this.isMatchingHole(holeDate, b.issueId);

                    if (matchA.created && !matchB.created) return order;
                    if (!matchA.created && matchB.created) return -order;
                    if (matchA.updated && !matchB.updated) return order;
                    if (!matchA.updated && matchB.updated) return -order;

                    return a.issueId > b.issueId ? order : -order;
                });

                bestPart.point = { type: 'auto', date: holeDate.format() };
            });
    }

    splitParts() {
        const parts = [];

        for (const issueId of Object.keys(this._times)) {
            const points = this.points[issueId];
            const time = this._times[issueId];

            if (points.length === 0) {
                parts.push({ issueId, time });
                continue;
            }

            const pointsWeightsSum = points.map(p => this.weights[p.type]).reduce((a, b) => a + b, 0);

            parts.push(
                ...points.map(p => ({
                    issueId,
                    point : p,
                    time  : time * this.weights[p.type] / pointsWeightsSum
                }))
            );
        }

        this.fillHoles(parts);

        return this._sortParts(parts).map(p => ({
            issue : p.issueId,
            time  : p.time,
            date  : p.point.date
        }));
    }

    getPartTime(part) {
        return part.time;
    }
}

class IdStrategy extends BaseStrategy {
    splitParts() {
        return Object.keys(this._times)
            .map(issue => ({ issue }));
    }

    getPartTime(part) {
        return this._times[part.issue];
    }
}

export default class TimeTracker {
    static strategies = {
        'id_based'      : IdStrategy,
        'actions_based' : ActionsStrategy
    }

    constructor(strategy) {
        this.strategy = {
            'id'      : this.constructor.strategies.id_based,
            'actions' : this.constructor.strategies.actions_based
        }[strategy];
    }

    compute(strategyOpts) {
        const strategy = new this.strategy(strategyOpts);
        const tasks = strategy.run();

        return {
            tasks,
            sum     : strategy.sum,
            shrinks : strategy.shrinks
        };
    }
}
