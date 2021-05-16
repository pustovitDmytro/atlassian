import { URL } from 'url';
import sinon from 'sinon';
import createAxiosError from 'axios/lib/core/createError';
import { load } from '../utils';

const JIRA_API = load('JiraApi').default;

const ISSUES = [ {
    key    : 'A-1',
    fields : {
        project : {
            name : 'Project A'
        },
        assignee : {
            accountId : 'Q7xGhfn2w'
        },
        status : {
            name : 'In progress'
        },
        summary : 'brief tie pool present sharp'
    }
}, {
    key    : 'A-2',
    fields : {
        project : {
            name : 'Project A'
        },
        assignee : {
            accountId : 'Fey9WYekb'
        },
        summary : 'symbol stock taste combine identity'
    }
}, {
    key    : 'A-3',
    fields : {
        project : {
            name : 'Project A'
        },
        assignee : {
            accountId : 'jMVaTJEHe6yCHkR8'
        },
        summary : 'continent safe area fun especially end various love stick down balloon sense come our whispered old line environment trade'
    }
} ];

const STATUSES = [
    { id: '1', name: 'Reopen' },
    { id: '2', name: 'In progress' },
    { id: '3', name: 'In testing' }
];

function axiosResponse(data) {
    return { data };
}

function axiosError(opts, { message, code }, data) {
    return createAxiosError(message, opts, code, {}, { data });
}

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

        return axiosResponse(1);
    }
}

const methods = Object.getOwnPropertyNames(JIRA_MOCK_API.prototype).filter(m => m !== 'constructor');

methods.forEach(methodName => {
    sinon.replace(JIRA_API.prototype, methodName, JIRA_MOCK_API.prototype[methodName]);
});
