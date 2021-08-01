import { assert } from 'chai';
import Test from '../../Test';
import { CLITester, getApiCalls, load } from '../../utils';

const jiraRunner = load('bin/jira').default;

const factory = new Test();

suite('cli jira test');

before(async function () {
    await factory.setJIRADefault();
});

test('Positive: jira test A-1', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'test', 'A-1' ])
    ]);

    const [ , getTransitions, getIssue, transit ] = await getApiCalls('type=requestSent');

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
        /info.*moved A-1 from In progress to In testing/
    );
});

test('Negative: specify not existing task', async function () {
    const errorMessage = /ATLASSIAN_ERROR: Request failed with status code 404.*\s*.*Issue does not exist or you do not have permission to see it/;
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'test', '00' ])
            .then(() => assert.fail('request must fail'))
            .catch(error => {
                assert.match(error.toString(), errorMessage);
            })
    ]);

    const [ , getTransitions, getIssue ] = await getApiCalls('type=requestSent');

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
