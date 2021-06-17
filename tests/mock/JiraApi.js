import { URL } from 'url';
import { load } from '../utils';
import ISSUES from './fixtures/issues.json';
import STATUSES from './fixtures/statuses.json';
import ATLASSIAN_API, {
    axiosResponse,
    axiosError
} from './AtlassianApi';

const JIRA_API = load('JiraApi').default;


class JIRA_MOCK_API extends JIRA_API {
    async getStatuses() {
        return STATUSES;
    }

    async _axios(opts) {
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
            return axiosResponse({ comments: [] });
        }

        if (opts.url.match('/rest/api/3/issue/.*/worklog')) {
            return axiosResponse({ worklogs: [] });
        }

        if (opts.url.match('/rest/api/3/issue')) {
            const { pathname } = new URL(opts.url);
            const id = pathname.split('/').reverse().[0];
            const issue = ISSUES.find(i => i.key === id);

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
