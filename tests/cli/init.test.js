import { assert } from 'chai';
import fs from 'fs-extra';
import { pause } from 'myrmidon';
import packageInfo from '../../package.json';
import Test, { configPath, load } from '../Test';
import { CLITester } from '../utils';

const jiraRunner = load('bin/jira').default;
const confluenceRunner = load('bin/confluence').default;

const factory = new Test();

suite('cli init');

before(async function () {
    await factory.cleanTmpFolder();
});

test('Negative: paste invalid host', async function () {
    const tester = new CLITester([
        { output: 'Enter atlassian host:', input: 'Zachary Martinez' }
    ], factory);


    const [ output ] = await Promise.all([
        tester.test(),
        new Promise((res, rej) => {
            jiraRunner([ 'init' ]).then(res).catch(rej);
            pause(1000).then(res).catch(rej);
        })
    ]);

    assert.include(output, 'not a valid host');
    assert.include(output, 'Enter atlassian host');
    assert.notInclude(output, 'Past your email');
});

test('Negative: skip email', async function () {
    const tester = new CLITester([
        { output: 'Enter atlassian host:', input: 'http://ov.bh/tucukol' },
        { output: 'Past your email:', input: null }
    ], factory);


    const [ output ] = await Promise.all([
        tester.test(),
        new Promise((res, rej) => {
            jiraRunner([ 'init' ]).then(res).catch(rej);
            pause(1000).then(res).catch(rej);
        })
    ]);

    assert.include(output, 'value is required');
    assert.include(output, 'Enter atlassian host');
    assert.include(output, 'Past your email');
    assert.notInclude(output, 'Past your token:');
});

test('init profile from jira', async function () {
    const config = {
        'host'  : 'http://wuztum.nu',
        'email' : 'kuba@gu.nr',
        'token' : 'atlassian_token',
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
