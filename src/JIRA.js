import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import ms from 'ms';
import axios from 'axios';
import uuid from 'uuid';
import dayjs from './date';
import Api from './JiraApi';

function onError(error) {
    throw error;
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
        this.gitlab = config.jira?.gitlab;
        this.initLogger(logger);
    }

    async list({ isMine, wasMine, stages = [], from, to, search, sprint = [ 'open' ] }, includes) {
        const jql = [];

        if (isMine) jql.push('assignee is currentuser()');
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
        const issue = await this.getIssue(issueID, 'transitions');
        const statuses = [ ...this.statuses.dev, ...this.statuses.test ].reverse();
        const desirableIndex = statuses.findIndex(s => s === status);

        for (const i in statuses) {
            if (i < desirableIndex) continue;
            const stat = statuses[i];
            const transition = issue.transitions.find(t => t.to.id === stat);

            if (transition) {
                await this.transit(issueID, transition.id);

                this.logger.log('info', `moved %s from %s to %s (${transition.to.id})`, issue.id, issue.status, transition.to.name);
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

    async exportLog([ start, end ], file = path.join(os.tmpdir(), `${uuid.v4()}.json`)) {
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
                const othersSpentTime = t.worklog.filter(w => w.author !== this.userId).reduce((a, b) => a + b.time, 0);
                const meSpentTime = t.worklog.filter(w => w.author === this.userId).reduce((a, b) => a + b.time, 0);

                extra.spent = `${ms(meSpentTime)   } / ${ms(meSpentTime + othersSpentTime)}`;
            }
            if (this.gitlab && t.comments.length) {
                const commits = t.comments.filter(c => {
                    const isFromGitlab = c.author === this.gitlab.jiraId;
                    const isMineCommit = JSON.stringify(c).includes(this.gitlab.gitlabUser);

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

    async logTime(issueID, day, time) {
        const payload = {
            'timeSpentSeconds' : task.time * 60 * 60,
            'started'          : dayjs(task.day, 'D MMM YYYY').format('YYYY-MM-DD[T]HH:m:s.sssZZ')
        };

        const res = await axios.post(`${this.host}/rest/api/3/issue/${task.issue}/worklog`, payload, { auth: this.auth }).catch(onError);

        console.log('res: ', res.data);

        return res.data;
    }
}
