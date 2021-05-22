import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import ms from 'ms';
import { v4 as uuid } from 'uuid';
import { toArray } from 'myrmidon';
import dayjs from './date';
import Api from './JiraApi';

const WEEKEND_INDEXES = [ 0, 6 ]; // eslint-disable-line no-magic-numbers
const LOG_FLOAT_PRECISION = 3;
const MIN_LOGGED_TIME = 0.25;
const ROUND_LOGGED_TIME = 0.25;

function workingDays({ include = [], exclude = [], to, from } = {}) {
    const totalDays = dayjs(to).diff(dayjs(from), 'day');
    const days = [];

    for (let i = 0; i < totalDays; i++) {
        const day = dayjs(from)
            .add(i, 'days')
            .startOf('day');

        let insert = !WEEKEND_INDEXES.includes(day.day());

        if (exclude.length && exclude.some(d => d.isSame(day, 'day'))) {
            insert = false;
        }

        if (to && (day > dayjs(to))) {
            insert = false;
        }

        if (from && (day < dayjs(from))) {
            insert = false;
        }

        if (include.length && include.some(d => d.isSame(day, 'day'))) {
            insert = true;
        }

        if (insert) days.push(day);
    }

    return days;
}

function round(value, step = 1.0) {
    const inv = 1.0 / step;

    return Math.round(value * inv) / inv;
}

export default class JIRA extends Api {
    constructor(config, logger) {
        super(config.host, {
            username : config.email,
            password : config.token
        });
        this.userId = config.userId;
        this.host = config.host;
        this.statuses = config.jira?.statuses;
        this.gitlab = config.jira?.gitlab && {
            jiraId  : config.jira.gitlab.jiraId,
            gitUser : toArray(config.jira.gitlab.gitUser)
        };
        this.initLogger(logger);
    }

    async list({ isMine, wasMine, stages = [], from, to, search, sprint = [ 'open' ] }, includes) {
        const jql = [];

        if (isMine) jql.push('assignee was currentuser()');
        if (wasMine) jql.push('assignee was currentuser()');
        if (from) jql.push(`updatedDate >= ${from.format('YYYY-MM-DD')}`);
        if (to) jql.push(`created <= ${to.format('YYYY-MM-DD')}`);
        if (stages.length) {
            const [ devStatusesList, testStatusesList ] = [ this.statuses.dev, this.statuses.test ]
                .map(statusList => statusList.map(s => `"${s}"`).join(', '));

            if (stages.includes('dev')) jql.push(`status IN (${devStatusesList})`);
            if (stages.includes('test')) jql.push(`status IN (${testStatusesList})`);
        }

        if (!sprint.includes('all')) {
            if (sprint.includes('open')) jql.push('Sprint in openSprints()');
        }

        if (search) jql.push(`summary ~ "${search}"`);

        const query = {};

        if (jql.length) query.jql = jql.join(' AND ');

        const issues = await this.getIssues(query, includes);

        return issues;
    }

    async move(issueID, status) {
        const issue = await this.getIssue(issueID, [ 'transitions' ]);
        const statuses = [ ...this.statuses.dev, ...this.statuses.test ].reverse();
        const desirableIndex = statuses.findIndex(s => s === status);

        for (const i in statuses) {
            if (i < desirableIndex) continue;
            const stat = statuses[i];
            const transition = issue.transitions.find(t => t.to.id === stat);

            if (transition) {
                await this.transit(issueID, transition.id);

                this.logger.log('info', `moved %s from %s to %s (${transition.to.id})`, issue.id, issue.statusName, transition.to.name);
                const isFinalMove = transition.to.id === status;

                if (isFinalMove) return;

                return this.move(issueID, status);
            }
        }

        this.logger.log('warn', 'No transitions to status %s found', status);
    }

    async loadStatuses() {
        if (this._STATUSES) return this._STATUSES;
        const statuses = await this.getStatuses();

        return this._STATUSES = statuses;
    }

    async show(issueID) {
        const task = await this.getIssue(
            issueID,
            [ 'changelog', 'transitions' ]
        );

        this.logger.verbose(task);

        return task;
    }

    async test(issueID) {
        await this.move(issueID, this.statuses.test[0]);
    }

    isInDevelopmentForRange(issue, [ start, end ]) {
        if (this.statuses.dev.includes(issue.status)) {
            return true;
        }

        return issue.history.some(t => {
            const isTimeMatch = dayjs(t.date).isBetween(dayjs(start), dayjs(end));
            const isFieldMatch = [ t.from, t.to ].some(status => this.statuses.dev.includes(status));

            return isTimeMatch && isFieldMatch;
        });
    }

    transitionDates(history, type, format = 'MMM DD') {
        const filter = {
            fromDev : tr => this.statuses.dev.includes(tr.from) && !this.statuses.dev.includes(tr.to),
            toDev   : tr => this.statuses.dev.includes(tr.to) && !this.statuses.dev.includes(tr.from)
        }[type];

        return history
            .filter(filter)
            .map(tr => dayjs(tr.date))
            .sort((a, b) => a - b)
            .map(d => d.format(format));
    }

    async exportLog([ start, end ], file = path.join(os.tmpdir(), `${uuid()}.json`)) {
        const allModifiedTasks = await this.list({
            from    : start,
            to      : end,
            wasMine : true
        }, [ 'comments', 'worklogs', 'changelog' ]);
        const tasks = allModifiedTasks.filter(issue => this.isInDevelopmentForRange(issue, [ start, end ]));

        this.logger.verbose({
            start              : start.format('YYYY/MM/DD'),
            end                : end.format('YYYY/MM/DD'),
            allTasksCount      : allModifiedTasks.length,
            filteredTasksCount : tasks.length,
            file
        });

        tasks.sort((a, b) => dayjs(a.updated) - dayjs(b.updated));
        const relFilePath = path.resolve(file);

        const payload = tasks.map(t => {
            const extra =  {};
            const isMine = t.assignee === this.userId;

            if (t.history.length) {
                extra.transitions = {};
                const fromDev = this.transitionDates(t.history, 'fromDev');
                const toDev = this.transitionDates(t.history, 'toDev');

                if (fromDev.length) extra.transitions.OUT = fromDev.join(', ');
                if (toDev.length) extra.transitions.IN = toDev.join(', ');
            }

            if (!isMine) extra.assignee = t.assigneeName;
            if (t.worklog.length) {
                const othersSpentTime = t.worklog
                    .filter(w => w.author !== this.userId)
                    .reduce((a, b) => a + b.time, 0);

                const meSpentTime = t.worklog
                    .filter(w => w.author === this.userId)
                    .reduce((a, b) => a + b.time, 0);

                extra.spent = `${ms(meSpentTime)   } / ${ms(meSpentTime + othersSpentTime)}`;
            }

            if (this.gitlab && t.comments.length) {
                const commits = t.comments.filter(c => {
                    const isFromGitlab = c.author === this.gitlab.jiraId;
                    const isMineCommit = this.gitlab.gitUser.some(u => JSON.stringify(c).includes(u));

                    return isMineCommit && isFromGitlab;
                }).length;

                if (commits) extra.commits = commits;
            }

            return {
                id   : t.key,
                text : t.summary,
                ...extra,
                time : 0
            };
        });

        await fs.ensureFile(relFilePath);
        await fs.writeJSON(relFilePath, payload);
        this.logger.info('%s issues was imported to %s', tasks.length, relFilePath);

        return relFilePath;
    }

    async clearWorklog(issueID, { mine = true, period = [] } = {}) {
        const [ start, end ] = period;
        const worklogs =  await this.getWorklog(issueID);
        const worklogsToClear = worklogs.filter(w => {
            const isMine = !mine || w.author === this.userId;
            const isAfterStart = !start || start.isSameOrAfter(dayjs(w.start), 'day');
            const isBeforeEnd = !end || end.isSameOrBefore(dayjs(w.end), 'day');

            return isMine && isAfterStart && isBeforeEnd;
        });

        await Promise.all(worklogsToClear.map(w => this.deleteWorklog(issueID, w.id)));

        return worklogsToClear;
    }

    async logIssues({ issues, from, to, include, exclude, confirm }) {
        const days = workingDays({ from, to, include, exclude });
        const total = {};

        days.forEach(day => total[day.format('D MMM YYYY')] = 8);
        this.logger.verbose(total);
        const sum = Object.values(total).reduce((a, b) => a + b, 0);
        const sortIssues = {};
        const arrayIssues = await fs.readJSON(issues);

        arrayIssues
            .filter(issue => issue.time)
            .forEach(issue => sortIssues[issue.id] = issue.time);

        const estimateSum = Object.values(sortIssues).reduce((a, b) => a + b, 0);
        const next = [ Object.keys(total)[0], 0 ];
        const tasks = [];
        const shrinks = [];

        for (const issueId in sortIssues) { // eslint-disable-line
            const est = sortIssues[issueId];
            const norm = Math.max(round(sum * est / estimateSum, ROUND_LOGGED_TIME), MIN_LOGGED_TIME);

            shrinks.push(norm / est);
            // const currentDayTotal = total[next[0]];
            // const currentDayLeft = currentDayTotal - next[1];

            let leftToAdd = norm;

            Object.entries(total)
                // eslint-disable-next-line no-loop-func
                .forEach(([ day, amount ], index) => {
                    if (day !== next[0]) return;
                    const currentDayLeft = amount - next[1];

                    if (currentDayLeft > leftToAdd) {
                        tasks.push({ day, time: leftToAdd, issue: issueId });
                        next[1] = next[1] + leftToAdd;
                        leftToAdd = 0;
                    } else {
                        tasks.push({ day, time: currentDayLeft, issue: issueId });
                        if (index === Object.entries(total).length - 1) return;
                        leftToAdd -= currentDayLeft;
                        next[1] = 0;
                        next[0] = Object.entries(total)[index + 1][0];
                    }
                });
        }

        const fullTasks = tasks
            .filter(t => t.time > 0)
            .sort((a, b) => a.issue > b.issue ? 1 : -1);

        const checkSum = fullTasks.reduce((a, b) => a + b.time, 0);

        shrinks.sort((a, b) =>  a - b);
        this.logger.info('%s hours estimated to be logged during %s days', estimateSum, Object.keys(total).length);
        this.logger.info('%s hours will be logged (shrink %s - %s)', checkSum, shrinks[0]?.toFixed(LOG_FLOAT_PRECISION), shrinks[shrinks.length - 1]?.toFixed(LOG_FLOAT_PRECISION));
        // eslint-disable-next-line guard-for-in
        for (const taskIndex in fullTasks) {
            const task = fullTasks[taskIndex];

            if (confirm) await this.logTime(task.issue, task.day, task.time);
            this.logger.info('%s/%s: Logged %s hours for %s', +taskIndex + 1, fullTasks.length, task.time, task.day);
        }

        if (!confirm) this.logger.info('Confirm operation to actually log time');
    }
}
