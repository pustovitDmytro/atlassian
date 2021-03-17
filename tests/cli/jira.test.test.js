import { assert } from 'chai';
import jiraRunner from '../../src/bin/jira';
import Test from '../Test';
import { CLITester, getApiCalls } from '../utils';

const factory = new Test();

suite.only('cli jira test');

before(async function () {
    await factory.setTmpFolder();
    await factory.saveProfile('jira_default', factory.jira_default);
});

test('Positive: jira test A-1', async function () {
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

    assert.match(
        output,
        new RegExp('info.*moved A-1 from In progress to In testing')
    );
});

test('Negative: specify not existing task', async function () {
    const errorMessage = new RegExp('API_ERROR: Request failed with status code 404.*\\s*.*Issue does not exist or you do not have permission to see it');
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        // eslint-disable-next-line more/no-then
        jiraRunner([ 'test', '00' ])
            .then(() => assert.fail('request must fail'))
            .catch(e => {
                assert.match(e.toString(), errorMessage);
            })
    ]);

    const [ getTransitions, getIssue ] = await getApiCalls('type=requestSent');

    assert.deepOwnInclude(getTransitions, {
        method : 'GET',
        url    : '/rest/api/3/issue/00/transitions'
    });
    assert.deepOwnInclude(getIssue, {
        method : 'GET',
        url    : '/rest/api/3/issue/00'
    });

    assert.match(output, errorMessage);
});

after(async function () {
    await factory.cleanTmpFolder();
});
