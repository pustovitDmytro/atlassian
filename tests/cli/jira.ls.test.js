import { assert } from 'chai';
import Test from '../Test';
import { CLITester, getApiCalls, load } from '../utils';

const jiraRunner = load('bin/jira').default;
const factory = new Test();

suite('cli jira list');

before(async function () {
    await factory.setJIRADefault();
});

test('jira ls -dm', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'ls', '-dm' ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.lengthOf(apiCalls, 3);

    const [ , first, second ] = apiCalls;

    assert.deepOwnInclude(first, {
        method : 'GET',
        url    : '/rest/api/3/search'
    });

    assert.notExists(first.params.startAt);
    assert.deepOwnInclude(first.params, {
        jql : 'assignee was currentuser() AND status IN ("1", "2") AND Sprint in openSprints()'
    });

    assert.deepOwnInclude(second, {
        method : 'GET',
        url    : '/rest/api/3/search'
    });

    assert.deepOwnInclude(second.params, {
        jql     : 'assignee was currentuser() AND status IN ("1", "2") AND Sprint in openSprints()',
        startAt : 2
    }, 'second request for paggination');

    assert.match(output, /A-1.*brief tie pool present sharp/);
    assert.match(output, /A-2.*symbol stock taste combine identity/);
    assert.match(output, /A-3.*continent safe area fun especially end various love stick down balloon sense come our whispered old line environment trade/);
});

after(async function () {
    await factory.cleanTmpFolder();
});
