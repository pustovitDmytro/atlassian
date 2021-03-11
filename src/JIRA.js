import path from 'path';
import os from 'os';
import dayjs from 'dayjs';
import fs from 'fs-extra';
import ms from 'ms';
import axios from 'axios';
import uuid from 'uuid';
import Api from './JiraApi';
import { dumpTask } from './dumpUtils';

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

    async list({ isMine, wasMine, stages, from, to, search, sprint = [ 'open' ] }) {
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

        const issues = await this.getIssues(query);

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

        return issue.transitions.some(t => {
            const isTimeMatch = dayjs(t.date).isBetween(dayjs(start), dayjs(end));
            const isFieldMatch = [ t.from, t.to ].some(status => this.statuses.dev.includes(status));

            return isTimeMatch && isFieldMatch;
        });
    }

    async getTaskList(start, end, { comments = false, worklog = false } = {}) {
        console.log('start: ', start.format('YYYY/MM/DD'), `end: ${end.format('YYYY/MM/DD')}`);

        // was mine but not anymore
        // assignee was currentuser() AND assignee not in (${username})
        const issues =  await this.getIssues({
            jql : `assignee was currentuser() AND updatedDate >= ${start.format('YYYY-MM-DD')} AND created < ${end.format('YYYY-MM-DD')}`
        });

        console.log('Total issues: ', issues.length);

        await Promise.all(issues.map(async issue => {
            if (worklog) {
                const info =  await axios.get(`${this.host}/rest/api/3/issue/${issue.id}/worklog`, { auth: this.auth });

                // eslint-disable-next-line no-param-reassign
                issue._worklogs = info.data.worklogs || [];
            }
            if (comments) {
                const info =  await axios.get(`${this.host}/rest/api/3/issue/${issue.id}/comment`, { auth: this.auth });

                // eslint-disable-next-line no-param-reassign
                issue._comments = info.data.comments || [];
            }
        }));

        const filtered = issues
            .map(issue => {
                return dumpTask(issue);
            })
            .filter(issue => this.isInDevelopmentForRange(issue, [ start, end ]));

        console.log('Filtered issues: ', filtered.length);

        return filtered;
    }

    async import([ start, end ], file = path.join(os.tmpdir, `${uuid.v4()}.json`)) {
        const allModifiedTasks = await this.list({
            from : start,
            to   : end
        }, [ 'comments', 'worklog' ]);
        const tasks = allModifiedTasks.filter(issue => this.isInDevelopmentForRange(issue, [ start, end ]));

        this.logger.notice({
            start              : start.format('YYYY/MM/DD'),
            end                : end.format('YYYY/MM/DD'),
            allTasksCount      : allModifiedTasks.length,
            filteredTasksCount : tasks.length
        });

        tasks.sort((a, b) => dayjs(a.updated) - dayjs(b.updated));
        const relFilePath = path.resolve(file);

        const payload = tasks.map(t => {
            const extra =  {};
            const isMine = t.assignee === this.userId;

            if (t.history.length) {
                extra.transitions = {};
                const devToTest = t.history
                    .filter(tr => this.statuses.dev.includes(tr.from) && !this.statuses.dev.includes(tr.to))
                    .map(tr => dayjs(tr.date))
                    .sort((a, b) => a - b)
                    .map(d => d.format('MMM DD'));

                const testToDev = t.history
                    .filter(tr => this.statuses.dev.includes(tr.to) && !this.statuses.dev.includes(tr.from))
                    .map(tr => dayjs(tr.date))
                    .sort((a, b) => a - b)
                    .map(d => d.format('MMM DD'));

                if (devToTest.length) extra.transitions['DEV->TEST'] = devToTest.join(', ');
                if (testToDev.length) extra.transitions['TEST->DEV'] = testToDev.join(', ');
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
        this.logger.info('%d issues was imported to %s', tasks.length, relFilePath);

        return relFilePath;
    }

    async clear(issue) {
        const info =  await axios.get(`${this.host}/rest/api/3/issue/${issue}/worklog`, { auth: this.auth });

        console.log(info.data);
        await Promise.all(info.data.worklogs
            .map(w => axios.delete(`${this.host}/rest/api/3/issue/${issue}/worklog/${w.id}`, { auth: this.auth })
                .catch(error => {
                    console.error(error.response.data);
                }))
        );
    }

    async logTask(task) {
        const payload = {
            'timeSpentSeconds' : task.time * 60 * 60,
            'started'          : dayjs(task.day, 'D MMM YYYY').format('YYYY-MM-DD[T]HH:m:s.sssZZ')
        };

        const res = await axios.post(`${this.host}/rest/api/3/issue/${task.issue}/worklog`, payload, { auth: this.auth }).catch(onError);

        console.log('res: ', res.data);

        return res.data;
    }
}
