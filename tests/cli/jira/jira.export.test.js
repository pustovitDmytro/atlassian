import path from 'path';
import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import fs from 'fs-extra';
import Test from '../../Test';
import { CLITester, getApiCalls, load } from '../../utils';
import { tmpFolder } from '../../constants';
import sample from '../../mock/fixtures/jira/export.log.result.json';

const jiraRunner = load('bin/jira').default;

const factory = new Test();

suite('cli jira export');

before(async function () {
    await factory.setJIRADefault();
});

test('jira export with explicit dates', async function () {
    const tester = new CLITester([], factory);
    const outFile = path.join(tmpFolder, `${uuid()}.json`);
    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'export', 'log', '01 01 1900', '01 01 2100', '--file', outFile ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.isNotEmpty(apiCalls);
    const searchCall = apiCalls.find(r => r.method === 'GET' && r.url === '/rest/api/3/search');

    assert.exists(searchCall);
    assert.equal(
        searchCall.params.jql,
        'assignee was currentuser() AND updatedDate >= 1900-01-01 AND created <= 2100-01-01 AND Sprint IN (s1, s2, s3)'
    );

    assert.include(output.replace(/\\\\/g, '\\'), outFile);
    assert.deepEqual(
        await fs.readJSON(outFile),
        sample
    );
});

after(async function () {
    await factory.cleanTmpFolder();
});
