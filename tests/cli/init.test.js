import { assert } from 'chai';
import fs from 'fs-extra';
import jiraRunner from '../../src/bin/jira';
import confluenceRunner from '../../src/bin/confluence';
import packageInfo from '../../package.json';
import Test, { configPath } from '../Test';
import { CLITester } from '../utils';

const factory = new Test();

suite('cli init');

before(async function () {
    await factory.cleanTmpFolder();
});

test('init profile from jira', async function () {
    const config = {
        'host'  : 'http://wuztum.nu',
        'email' : 'kuba@gu.nr',
        'token' : 'gUOv4Dn4o8iVYy53rrTK',
        'jira'  : {
            'isUse'     : true,
            'isDefault' : false,
            'statuses'  : { 'dev': [ '1', '2' ], 'test': [ '3' ] }
        },
        'confluence' : {
            'isUse'     : true,
            'isDefault' : false
        },
        'userId'   : 1,
        '_version' : packageInfo.version
    };

    const tester = new CLITester([
        { output: 'Enter atlassian host:', input: config.host },
        { output: 'Past your email:', input: config.email },
        { output: 'Past your token:', input: config.token },
        { output: 'is this you?', input: 'y' },
        { output: 'Use this credentials for jira calls?', input: 'y' },
        { output: 'Make this profile default for jira calls?', input: 'n' },
        { output: 'Current Jira statuses in project', input: config.jira.statuses.dev.join(' ') },
        { output: 'Enter list of statuses for test', input: config.jira.statuses.test.join(',') },
        { output: 'correct?', input: 'y' },
        { output: 'Use this credentials for confluence calls?', input: 'y' },
        { output: 'Make this profile default for confluence calls?', input: 'n' },
        { output: 'Name your profile', input: null }
    ], factory);

    await Promise.all([
        tester.test(),
        jiraRunner([ 'init' ])
    ]);

    const actualConfig = await fs.readJSON(configPath);

    assert.deepEqual(actualConfig.default, config);
});


test('init profile from confluence', async function () {
    const config = {
        'host'  : 'http://putevi.tk/vod',
        'email' : 'kuba@gu.nr',
        'token' : 's413tG7',
        'jira'  : {
            'isUse'     : true,
            'isDefault' : false,
            'statuses'  : { 'dev': [ '1', '2' ], 'test': [ '3' ] }
        },
        'confluence' : {
            'isUse'     : true,
            'isDefault' : true
        },
        'userId'   : 1,
        '_version' : packageInfo.version
    };

    const tester = new CLITester([
        { output: 'Enter atlassian host:', input: config.host },
        { output: 'Past your email:', input: config.email },
        { output: 'Past your token:', input: config.token },
        { output: 'is this you?', input: 'y' },
        { output: 'Use this credentials for jira calls?', input: 'y' },
        { output: 'Make this profile default for jira calls?', input: 'n' },
        { output: 'Current Jira statuses in project', input: config.jira.statuses.dev.join(', ') },
        { output: 'Enter list of statuses for test', input: config.jira.statuses.test.join(' ') },
        { output: 'correct?', input: 'y' },
        { output: 'Use this credentials for confluence calls?', input: 'y' },
        { output: 'Make this profile default for confluence calls?', input: 'Y' },
        { output: 'Name your profile', input: 'confluence' }
    ], factory);

    await Promise.all([
        tester.test(),
        confluenceRunner([ 'init' ])
    ]);

    const actualConfig = await fs.readJSON(configPath);

    assert.deepEqual(actualConfig.confluence, config);
});
