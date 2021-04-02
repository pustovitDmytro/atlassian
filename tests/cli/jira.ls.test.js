import { assert } from 'chai';
import jiraRunner from '../../src/bin/jira';
import Test from '../Test';
import { CLITester, getApiCalls } from '../utils';

const factory = new Test();

suite('cli jira list');

before(async function () {
    await factory.setTmpFolder();
    await factory.saveProfile('jira_default', factory.jira_default);
});

test('jira ls -dm', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'ls', '-dm' ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.lengthOf(apiCalls, 2);
    apiCalls.forEach(req => {
        assert.equal(req.method, 'GET');
        assert.equal(req.url, '/rest/api/3/search');
        assert.equal(
            req.params.jql,
            'assignee was currentuser() AND status IN ("1", "2") AND Sprint in openSprints()'
        );
    });
    const [ first, second ] = apiCalls;

    assert.notExists(first.params.startAt);
    assert.exists(second.params.startAt, 'second request for paggination');

    assert.match(output, new RegExp('A-1.*brief tie pool present sharp'));
    assert.match(output, new RegExp('A-2.*symbol stock taste combine identity'));
    assert.match(output, new RegExp('A-3.*continent safe area fun especially end various love stick down balloon sense come our whispered old line environment trade'));
});

after(async function () {
    await factory.cleanTmpFolder();
});
