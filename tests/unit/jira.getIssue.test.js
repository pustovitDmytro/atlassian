import { assert } from 'chai';
import Test from '../Test';
import { load, getApiCalls } from '../utils';
import { createUnitLogger } from '../logger';

const factory = new Test();
const JIRA = load('Jira').default;
const { logger, traces } = createUnitLogger('debug');

suite('JIRA: getIssue');

before(async function () {});

test('Negative: unexpected (non-http) error in API', async function () {
    const jira = new JIRA(factory.jira_default);

    jira.setLogger(logger);

    await jira.getIssue('unexpected')
        .then(() => assert.fail('request must fail'))
        .catch(error => {
            assert.equal(error.toString(), 'Error: TypeError: Cannot set property key of undefined');
        });
});

test('getIssue without includes', async function () {
    const jira = new JIRA(factory.jira_default);

    jira.setLogger(logger);

    const issue = await jira.getIssue('A-1');

    assert.deepOwnInclude(issue, {
        id          : 'A-1',
        key         : 'A-1',
        worklog     : [],
        comments    : [],
        transitions : []
    });

    const calls = await getApiCalls('type=requestSent', { traces });

    assert.lengthOf(calls, 1);
    assert.deepOwnInclude(calls[0], {
        method : 'GET',
        url    : '/rest/api/3/issue/A-1',
        params : {},
        api    : 'JIRA'
    });
});

test('getIssue with all includes', async function () {
    const jira = new JIRA(factory.jira_default);

    jira.setLogger(logger);

    const issue = await jira.getIssue('A-3', [ 'comments', 'transitions', 'worklogs' ]);
    const calls = await getApiCalls('type=requestSent', { traces });

    assert.deepOwnInclude(issue, {
        id : 'A-3'
    });
    assert.isNotEmpty(issue.worklog, 'worklog');
    assert.isNotEmpty(issue.comments, 'comments');
    assert.isNotEmpty(issue.transitions, 'transitions');

    assert.lengthOf(calls, 4);
    [
        '/rest/api/3/issue/A-3/transitions',
        '/rest/api/3/issue/A-3/comment',
        '/rest/api/3/issue/A-3/worklog',
        '/rest/api/3/issue/A-3'
    ].forEach(url => {
        assert.exists(calls.find(call => call.method === 'GET' && call.url === url));
    });
});

after(async function () {});
