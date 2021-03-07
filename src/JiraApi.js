
import { uniqueIdFilter } from 'myrmidon';
import Api from './AtlassianApi';
import { dumpStatus, dumpTask } from './dumpUtils';

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
}
