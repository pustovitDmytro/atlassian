import sinon from 'sinon';
import JIRA_API from '../../src/JiraApi';

class JIRA_MOCK_API extends JIRA_API {
    async getMyself() {
        return {
            id    : 1,
            email : this.auth.username,
            name  : 'Tyler Simpson'
        };
    }

    async getStatuses() {
        return [
            { id: '1', name: 'Reopen' },
            { id: '2', name: 'In progress' },
            { id: '3', name: 'In testing' }
        ];
    }
}

const methods = Object.getOwnPropertyNames(JIRA_MOCK_API.prototype).filter(m => m !== 'constuctor');

methods.forEach(methodName => {
    sinon.replace(JIRA_API.prototype, methodName, JIRA_MOCK_API.prototype[methodName]);
});
