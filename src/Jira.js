/* eslint-disable unicorn/no-array-reduce */
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import ms from 'ms';
import { v4 as uuid } from 'uuid';
import { toArray } from 'myrmidon';
import dayjs from './date';
import Api from './api/JiraApi';
import { workingDays } from './utils';
import TimeTracker from './TimeTracker';

const LOG_FLOAT_PRECISION = 3;

function formatJQLList(list) {
    return list.map(s => `"${s}"`).join(', ');
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

    async list({ isMine, wasMine, stages = [], from, to, search, sprint = [ 'open' ], id }, includes) {
        const jql = [];

        if (isMine) jql.push('assignee = currentuser()');
        if (wasMine) jql.push('assignee was currentuser()');
        if (from) jql.push(`updatedDate >= ${from.format('YYYY-MM-DD')}`);
        if (to) jql.push(`created <= ${to.format('YYYY-MM-DD')}`);
        if (stages.length > 0) {
            if (stages.includes('dev')) jql.push(`status IN (${formatJQLList(this.statuses.dev)})`);
            if (stages.includes('test')) jql.push(`status IN (${formatJQLList(this.statuses.test)})`);
        }

        if (!sprint.includes('all') && sprint.includes('open')) jql.push('Sprint in openSprints()');
        if (search) jql.push(`summary ~ "${search}"`);
        if (id) jql.push(`id IN (${formatJQLList(id)})`);

        const query = {};

        if (jql.length > 0) query.jql = jql.join(' AND ');

        return this.getIssues(query, includes);
    }

    async move(issueID, status) {
        const issue = await this.getIssue(issueID, [ 'transitions' ]);
        const statuses = [ ...this.statuses.dev, ...this.statuses.test ].reverse();
        const desirableIndex = statuses.indexOf(status);

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
            .filter((element, index, array) => filter(element, index, array))
            .map(tr => dayjs(tr.date))
            .sort((a, b) => a - b)
            .map(d => format ? d.format(format) : d);
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

            if (t.history.length > 0) {
                extra.transitions = {};
                const fromDev = this.transitionDates(t.history, 'fromDev');
                const toDev = this.transitionDates(t.history, 'toDev');

                if (fromDev.length > 0) extra.transitions.OUT = fromDev.join(', ');
                if (toDev.length > 0) extra.transitions.IN = toDev.join(', ');
            }

            if (!isMine) extra.assignee = t.assigneeName;
            if (t.worklog.length > 0) {
                const othersSpentTime = t.worklog
                    .filter(w => w.author !== this.userId)
                    .reduce((a, b) => a + b.time, 0);

                const meSpentTime = t.worklog
                    .filter(w => w.author === this.userId)
                    .reduce((a, b) => a + b.time, 0);

                extra.spent = `${ms(meSpentTime)   } / ${ms(meSpentTime + othersSpentTime)}`;
            }

            if (this.gitlab && t.comments.length > 0) {
                const commits = t.comments.filter(c => this.isMineCommit(c)).length;

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

    isMineCommit(c) {
        const isFromGitlab = c.author === this.gitlab.jiraId;
        const isMineCommit = this.gitlab.gitUser.some(u => JSON.stringify(c).includes(u));

        return isMineCommit && isFromGitlab;
    }

    isMineComment(c) {
        return  c.author === this.userId;
    }

    async getTimePoints(issueIds, [ start, end ]) {
        const issues = await this.list({
            id : issueIds
        }, [ 'comments', 'changelog' ]);
        const res = {};

        for (const issue of issues) {
            const points = [];

            for (const type of [ 'created', 'updated' ]) {
                const date = issue[type];

                if (dayjs(date).isBetween(start, end)) points.push({ type, date });
            }

            for (const type of [ 'fromDev', 'toDev' ]) {
                points.push(
                    ...this.transitionDates(issue.history, type, null)
                        .filter(d => d.isBetween(start, end))
                        .map(d => ({
                            type : `transition.${type}`,
                            date : d.format()
                        }))
                );
            }

            if (this.gitlab) {
                points.push(
                    ...issue.comments.filter(c => this.isMineCommit(c)).map(mineCommit => ({
                        type : 'commit.mine',
                        date : mineCommit.date
                    }))
                );
            }

            points.push(
                ...issue.comments.filter(c => this.isMineComment(c)).map(mineComment => ({
                    type : 'comment.mine',
                    date : mineComment.date
                }))
            );


            res[issue.id] = points;
        }

        return res;
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

    async logIssues({ issues: issuePath, from, to, include, exclude, confirm, strategy }) {
        const days = workingDays({ from, to, include, exclude });
        const total = {};

        for (const day of days)  total[day.format('D MMM YYYY')] = 8;
        this.logger.verbose(total);

        const tracker = new TimeTracker(strategy);
        const trackerOpts = {
            calendar : total,
            issues   : await fs.readJSON(issuePath)
        };

        if (strategy === 'actions') {
            trackerOpts.points = await this.getTimePoints(
                trackerOpts.issues.map(i => i.id),
                [ from, to ]
            );
        }

        const { tasks, sum, shrinks } = tracker.compute(trackerOpts);
        const checkSum = tasks.reduce((a, b) => a + b.time, 0);

        this.logger.info('%s of %s hours estimated to be logged during %s days', sum.estimated, sum.expected, Object.keys(total).length);
        this.logger.info('%s hours will be logged (shrink %s - %s)', checkSum, shrinks[0]?.toFixed(LOG_FLOAT_PRECISION), shrinks[shrinks.length - 1]?.toFixed(LOG_FLOAT_PRECISION));
        // eslint-disable-next-line guard-for-in
        for (const taskIndex in tasks) {
            const task = tasks[taskIndex];

            if (confirm) await this.logTime(task.issue, task.day, task.time);
            this.logger.info('%s/%s: Logged %s hours for %s', +taskIndex + 1, tasks.length, task.time, task.day);
        }

        if (!confirm) this.logger.info('Confirm operation to actually log time');
    }
}
