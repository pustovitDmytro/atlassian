/* eslint-disable no-param-reassign */

import { uniqueIdFilter } from 'myrmidon';
import Api from './AtlassianApi';
import { dumpStatus, dumpTask, dumpTransition, dumpComment, dumpWorklog } from './dumpUtils';
import dayjs from './date';

export default class JiraApi extends Api {
    async getStatuses() {
        const res = await this.get('/rest/api/latest/status/');

        return res.map(dumpStatus);
    }

    async getIssues(params, includes = []) {
        const extraParams = {};

        if (includes.length) {
            if (includes.includes('changelog')) extraParams.expand = 'changelog';
        }

        const { issues, startAt, total } = await this.get('/rest/api/3/search', { ...params, ...extraParams });
        const nextStart = startAt + issues.length;

        if (includes.length) {
            await Promise.all(issues.map(async issue => {
                const promises = [];

                if (includes.includes('transitions')) {
                    promises.push({
                        key    : '_transitions',
                        action : this.getTransitions(issue.id)
                    });
                }

                if (includes.includes('comments')) {
                    promises.push({
                        key    : '_comments',
                        action : this.getComments(issue.id)
                    });
                }

                if (includes.includes('worklogs')) {
                    promises.push({
                        key    : '_worklog',
                        action : this.getWorklog(issue.id)
                    });
                }

                await Promise.all(promises.map(async p => {
                    const res = await p.action;

                    issue[p.key] = res;
                }));
            }));
        }

        if (total > nextStart) {
            const next = await this.getIssues({
                ...params,
                startAt : nextStart
            }, includes);

            return [ ...issues.map(dumpTask), ...next ].filter(uniqueIdFilter);
        }

        return issues.map(dumpTask);
    }

    async getIssue(id, includes = []) {
        const extraParams = {};
        const promises = [];

        if (includes.length) {
            if (includes.includes('changelog')) extraParams.expand = 'changelog';
            if (includes.includes('transitions')) {
                promises.push({
                    key    : '_transitions',
                    action : this.getTransitions(id)
                });
            }

            if (includes.includes('comments')) {
                promises.push({
                    key    : '_comments',
                    action : this.getComments(id)
                });
            }

            if (includes.includes('worklogs')) {
                promises.push({
                    key    : '_worklog',
                    action : this.getWorklog(id)
                });
            }
        }

        const [ issue, ...results ] = await Promise.all([
            this.get(`/rest/api/3/issue/${id}`, extraParams), // TODO
            ...promises.map(p => p.action)
        ]);

        promises.forEach((p, i) => issue[p.key] = results[i]);

        return dumpTask(issue);
    }

    async getTransitions(id) {
        const res = await this.get(`/rest/api/3/issue/${id}/transitions`);

        return res.transitions.map(dumpTransition);
    }

    async transit(issueId, transitionId) {
        await this.post(`/rest/api/3/issue/${issueId}/transitions`, { transition: transitionId });
    }

    async getComments(issueId) {
        const res =  await this.get(`/rest/api/3/issue/${issueId}/comment`);

        return res.comments.map(dumpComment);
    }

    async getWorklog(issueId) {
        const res =  await this.get(`/rest/api/3/issue/${issueId}/worklog`);

        return res.worklogs.map(dumpWorklog);
    }

    async deleteWorklog(issueId, worklogId) {
        await this.delete(`/rest/api/3/issue/${issueId}/worklog/${worklogId}`);
    }

    async logTime(issueID, day, time) {
        const res = await this.post(`/rest/api/3/issue/${issueID}/worklog`, {
            'timeSpentSeconds' : time * 60 * 60,
            'started'          : dayjs(day, 'D MMM YYYY').format('YYYY-MM-DD[T]HH:m:s.sssZZ')
        });

        return res.data;
    }
}
