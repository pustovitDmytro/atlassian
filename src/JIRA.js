/* eslint-disable no-param-reassign */
// import { inspect } from 'util';
import path from 'path';
import dayjs from 'dayjs';
import { uniqueIdFilter } from 'myrmidon';
import fs from 'fs-extra';
import ms from 'ms';
import axios from 'axios';
import Api from './JiraApi';
import { dumpTask } from './dumpUtils';

function onError(error) {
    // console.error(error.response ? error.response.data : error);
    throw error;
}

export default class JIRA extends Api {
    constructor(config) {
        super(config.host, {
            username : config.email,
            password : config.token
        });
        this.userId = config.userId;
        this.host = config.host;
        this.statuses = {
            dev  : [ '10006', '10000', '1' ],
            test : [ '10002', '10003' ]
        };
        this.gitlab = config.gitlab;
    }

    async list({ isMine, stages, from, to, search, sprint = [ 'open' ] }) {
        const jql = [];

        if (isMine) jql.push('assignee was currentuser()');
        if (from) jql.push(`updatedDate >= ${from.format('YYYY-MM-DD')}`);
        if (to) jql.push(`updatedDate <= ${to.format('YYYY-MM-DD')}`);
        if (stages.length) {
            if (stages.includes('dev')) jql.push(`status IN (${this.statuses.dev.map(s => `"${s}"`).join(', ')})`);
            if (stages.includes('test')) jql.push(`status IN (${this.statuses.test.map(s => `"${s}"`).join(', ')})`);
        }
        if (!sprint.includes('all')) {
            if (sprint.includes('open')) jql.push('Sprint in openSprints()');
        }
        if (search) jql.push(`summary ~ "${search}"`);

        const query = {};

        if (jql.length) query.jql = jql.join(' AND ');

        const issues = await this.getIssues(query);

        return issues.map(dumpTask);
    }

    async move(issueID, status) {
        const { data: { transitions } } =  await axios
            .get(`${this.host}/rest/api/3/issue/${issueID}/transitions`, {
                auth : this.auth
            })
            .catch(onError);

        const statuses = [ ...this.statuses.dev, ...this.statuses.test ].reverse();
        const desirableIndex = statuses.findIndex(s => s === status);

        for (const i in statuses) {
            if (i < desirableIndex) continue;
            const stat = statuses[i];
            const transition = transitions.find(t => t.to.id === stat);

            if (transition) {
                await axios
                    .post(`${this.host}/rest/api/3/issue/${issueID}/transitions`, { transition: transition.id }, {
                        auth : this.auth
                    }).catch(onError);

                console.log(`moved from ${transition.name} to ${transition.to.name} (${transition.to.id})`);
                const isFinalMove = transition.to.id === status;

                if (isFinalMove) return;

                return this.move(issueID, status);
            }
        }
        console.warn(`No transitions to status ${status} found`);
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

    async getIssues(params, includes = []) {
        if (includes.length) {
            // ?expand=changelog
            params.expand = includes;
        }
        const list =  await axios
            .get(`${this.host}/rest/api/3/search`, {
                auth : this.auth,
                params
            }).catch(onError);
        const { issues, startAt, total } = list.data;
        const nextStart = startAt + issues.length;

        if (total > nextStart) {
            const next = await this.getIssues({
                ...params,
                startAt : nextStart
            });

            return [ ...issues, ...next ].filter(uniqueIdFilter);
        }

        return issues;
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

                issue._worklogs = info.data.worklogs || [];
            }
            if (comments) {
                const info =  await axios.get(`${this.host}/rest/api/3/issue/${issue.id}/comment`, { auth: this.auth });

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

    async importForTimeLog([ start, end ], file = './tmp/issues.json') {
        const tasks = await this.getTaskList(start, end, { comments: true, worklog: true });

        tasks.sort((a, b) => dayjs(a.updated) - dayjs(b.updated));
        const relFilePath = path.resolve(file);

        const payload = tasks.map(t => {
            const extra =  {};
            const isMine = t.assignee === this.userId;

            if (t.transitions.length) {
                extra.transitions = {};
                const devToTest = t.transitions
                    .filter(tr => this.statuses.dev.includes(tr.from) && !this.statuses.dev.includes(tr.to))
                    .map(tr => dayjs(tr.date))
                    .sort((a, b) => a - b)
                    .map(d => d.format('MMM DD'));

                const testToDev = t.transitions
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
