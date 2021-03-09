
import { uniqueIdFilter } from 'myrmidon';
import Api from './AtlassianApi';
import { dumpStatus, dumpTask, dumpTransition } from './dumpUtils';

export default class JiraApi extends Api {
    async getStatuses() {
        const res = await this.get('/rest/api/latest/status/');

        return res.map(dumpStatus);
    }

    async getIssues(params, includes = []) {
        const extraParams = {};

        if (includes.length) {
            extraParams.expand = includes; // ?expand=changelog
        }

        const { issues, startAt, total } = await this.get('/rest/api/3/search', { ...params, ...extraParams });
        const nextStart = startAt + issues.length;

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
}
