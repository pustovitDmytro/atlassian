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

    const [ , getWorklogs, ...deleteWorklogs ] = await getApiCalls('type=requestSent');

    assert.deepOwnInclude(getWorklogs, {
        method : 'GET',
        url    : '/rest/api/3/issue/A-4/worklog'
    });
    assert.lengthOf(deleteWorklogs, 2);

    assert.deepOwnInclude(deleteWorklogs[0], {
        method : 'DELETE',
        url    : '/rest/api/3/issue/A-4/worklog/17252'
    });

    assert.match(output, /Removed.*10m.*for.*05 Jun 2021/);
});

test('clear worklog for period', async function () {
    const tester = new CLITester([], factory);
    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'worklog', 'clear', 'A-4', '--from', '30-06-21', '--to', '01-08-21' ])
    ]);

    const [ , getWorklogs, ...deleteWorklogs ] = await getApiCalls('type=requestSent');

    assert.deepOwnInclude(getWorklogs, {
        method : 'GET',
        url    : '/rest/api/3/issue/A-4/worklog'
    });
    assert.lengthOf(deleteWorklogs, 1);
    assert.deepOwnInclude(deleteWorklogs[0], {
        method : 'DELETE',
        url    : '/rest/api/3/issue/A-4/worklog/8943'
    });

    assert.match(output, /Removed.*1h.*for.*01 Jul 2021/);
});


after(async function () {
    await factory.cleanTmpFolder();
});
