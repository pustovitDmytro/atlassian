import sinon from 'sinon';
import JIRA_API from '../../src/JiraApi';

const ISSUES = [ {
    key    : 'A-1',
    fields : {
        project : {
            name : 'Project A'
        },
        assignee : {
            accountId : 'Q7xGhfn2w'
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

function axiosResponse(data) {
    return { data };
}

class JIRA_MOCK_API extends JIRA_API {
    async getStatuses() {
        return [
            { id: '1', name: 'Reopen' },
            { id: '2', name: 'In progress' },
            { id: '3', name: 'In testing' }
        ];
    }

    async _axios(opts) {
        if (opts.url.match('/rest/api/3/search')) {
            const { startAt } = opts.params;

            if (startAt) {
                return axiosResponse({ issues: ISSUES.slice(2), startAt, total: ISSUES.length });
            }

            return axiosResponse({ issues: ISSUES.slice(0, 2), startAt: 0, total: ISSUES.length });
        }

        return axiosResponse(1);
    }
}

const methods = Object.getOwnPropertyNames(JIRA_MOCK_API.prototype).filter(m => m !== 'constructor');

methods.forEach(methodName => {
    sinon.replace(JIRA_API.prototype, methodName, JIRA_MOCK_API.prototype[methodName]);
});
