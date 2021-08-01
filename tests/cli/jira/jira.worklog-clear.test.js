import { assert } from 'chai';
import Test from '../../Test';
import { CLITester, getApiCalls, load } from '../../utils';

const jiraRunner = load('bin/jira').default;

const factory = new Test();

suite('jira clear worklog');

before(async function () {
    await factory.setJIRADefault();
});

test('jira clear worklog for issue', async function () {
    const tester = new CLITester([], factory);
    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'worklog', 'clear', 'A-4' ])
    ]);

    const [ , getWorklogs, deleteWorklogs ] = await getApiCalls('type=requestSent');

    assert.deepOwnInclude(getWorklogs, {
        method : 'GET',
        url    : '/rest/api/3/issue/A-4/worklog'
    });

    assert.deepOwnInclude(deleteWorklogs, {
        method : 'DELETE',
        url    : '/rest/api/3/issue/A-4/worklog/17252'
    });

    assert.match(output, /Removed.*10m.*for.*17 Jun 2021/);
});


after(async function () {
    await factory.cleanTmpFolder();
});
