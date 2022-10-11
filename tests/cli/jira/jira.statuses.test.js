import { assert } from 'chai';
import Test from '../../Test';
import { CLITester, getApiCalls, load } from '../../utils';

const jiraRunner = load('bin/jira').default;
const factory = new Test();

suite('cli jira statuses');

before(async function () {
    await factory.setJIRADefault();
});

test('list statuses', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'statuses' ])
    ]);

    const [ myself, ...apiCalls ] = await getApiCalls('type=requestSent');

    assert.lengthOf(apiCalls, 1);

    assert.deepOwnInclude(myself, {
        method : 'GET',
        url    : '/rest/api/3/myself'
    });
    assert.deepOwnInclude(apiCalls[0], {
        url    : '/rest/api/latest/status/',
        method : 'GET'
    });

    assert.match(output, /1.* Reopen \(category\)/);
});

after(async function () {
    await factory.cleanTmpFolder();
});
