import { URL } from 'url';
import { load } from '../utils';

import ISSUES from './fixtures/jira/issues.json';
import STATUSES from './fixtures/jira/statuses.json';
import WORKLOGS from './fixtures/jira/worklogs.json';
import COMMENTS from './fixtures/jira/comments.json';
import SPRINTS from './fixtures/jira/sprints.json';

import ATLASSIAN_API, {
    axiosResponse,
    axiosError
} from './AtlassianApi';

const JIRA_API = load('api/JiraApi').default;

class JIRA_MOCK_API extends JIRA_API {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async _axios(opts) {
        if (opts.url.match('/rest/api/latest/status')) {
            return axiosResponse(STATUSES);
        }

        if (opts.url.match('/rest/agile/1.0/board/b1/sprint')) {
            const { startAt } = opts.params;

            if (startAt) {
                return axiosResponse({ values: SPRINTS.slice(1), isLast: true });
            }

            return axiosResponse({ values: SPRINTS.slice(0, 1), isLast: false });
        }

        if (opts.url.match('/rest/agile/1.0/board')) {
            return axiosResponse({ values: [ { id: 'b1' } ] });
        }

        if (opts.url.match('/rest/api/3/search')) {
            const { startAt } = opts.params;

            if (startAt) {
                return axiosResponse({ issues: ISSUES.slice(2), startAt, total: ISSUES.length });
            }

            return axiosResponse({ issues: ISSUES.slice(0, 2), startAt: 0, total: ISSUES.length });
        }

        if (opts.url.match('/rest/api/3/issue/.*/transitions')) {
            return axiosResponse({ transitions : [
                {
                    id   : 1,
                    name : 'to do',
                    to   : STATUSES[2]
                }
            ] });
        }

        if (opts.url.match('/rest/api/3/issue/.*/comment')) {
            if (opts.url.match('A-3')) return axiosResponse(COMMENTS);

            return axiosResponse({ comments: [] });
        }

        if (opts.url.match('/rest/api/3/issue/.*/worklog')) {
            return axiosResponse(WORKLOGS);
        }

        if (opts.url.match('/rest/api/3/issue')) {
            const { pathname } = new URL(opts.url);
            const id = pathname.split('/').reverse()[0];
            const issue = ISSUES.find(i => i.key === id);

            if (id === 'unexpected') {
                throw new Error('TypeError: Cannot set property key of undefined');
            }

            if (!issue) {
                throw axiosError(opts, {
                    message : 'Request failed with status code 404'
                }, {
                    errorMessages : [ 'Issue does not exist or you do not have permission to see it.' ],
                    errors        : {}
                });
            }

            return axiosResponse(issue);
        }

        return ATLASSIAN_API.prototype._axios(opts);
    }
}

const methods = Object.getOwnPropertyNames(JIRA_MOCK_API.prototype).filter(m => m !== 'constructor');

for (const methodName of methods) {
    JIRA_API.prototype[methodName] = JIRA_MOCK_API.prototype[methodName];
}
