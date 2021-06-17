import path from 'path';
import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import fs from 'fs-extra';
import Test from '../Test';
import { CLITester, getApiCalls, load } from '../utils';
import { tmpFolder } from '../constants';
import exportWorkflow from '../mock/fixtures/export.json';

const jiraRunner = load('bin/jira').default;

const factory = new Test();

suite('cli jira add time to worklog');
const emptyOutFile = path.join(tmpFolder, `${uuid()}.json`);
const fullOutFile = path.join(tmpFolder, `${uuid()}.json`);

before(async function () {
    await factory.setJIRADefault();
    await fs.writeJSON(emptyOutFile, []);
    await fs.writeJSON(fullOutFile, exportWorkflow);
});

test('jira add time to worklog from empty list', async function () {
    const tester = new CLITester([], factory);
    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'log',  '--issues', emptyOutFile, '--from', '01 03 20', '--to', '10 03 20', '--confirm' ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.isEmpty(apiCalls.filter(r => r.url !== '/rest/api/3/myself'));
    assert.include(output, '0 hours will be logged');
});


test('jira add time to worklog from file', async function () {
    const tester = new CLITester([], factory);
    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'log',  '--issues', fullOutFile, '--from', '01 03 20', '--to', '10 03 20', '--confirm' ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.isNotEmpty(apiCalls);
    assert.include(output, 'hours for 6 Mar 2020');
});


after(async function () {
    await factory.cleanTmpFolder();
});
