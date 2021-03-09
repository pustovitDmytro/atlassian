import { assert } from 'chai';
import jiraRunner from '../../src/bin/jira';
import Test from '../Test';
import { CLITester, getApiCalls } from '../utils';

const factory = new Test();

suite('cli jira test');

before(async function () {
    await factory.setTmpFolder();
    await factory.saveProfile('jira_default', factory.jira_default);
});

test('jira test A-1', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'test', 'A-1' ])
    ]);

    const [ getTransitions, getIssue, transit ] = await getApiCalls('type=requestSent');

    assert.deepOwnInclude(getTransitions, {
        method : 'GET',
        url    : '/rest/api/3/issue/A-1/transitions'
    });
    assert.deepOwnInclude(getIssue, {
        method : 'GET',
        url    : '/rest/api/3/issue/A-1'
    });
    assert.deepOwnInclude(transit, {
        method : 'POST',
        url    : '/rest/api/3/issue/A-1/transitions',
        data   : { 'transition': 1 }
    });
    assert.match(output, new RegExp('info.*moved A-1 from In progress to In testing'));
});

after(async function () {
    await factory.cleanTmpFolder();
});
