import { assert } from 'chai';
import sinon from 'sinon';
import logger from '../entry';
import { verifyStdout } from '../utils';
import jiraRunner from '../../src/bin/jira';
import JIRA_API from '../../src/JiraApi';
import JIRA_API_MOCK from '../mock/JiraApi';

sinon.replace(JIRA_API.prototype, 'getMyself', JIRA_API_MOCK.prototype.getMyself);

suite('Cli init');

test('Default configuration', async function () {
    const stdin = require('mock-stdin').stdin();

    setTimeout(() => stdin.send([ 'http://wuztum.nu', null ]), 500);
    setTimeout(() => stdin.send([ 'kuba@gu.nr', null ]), 1000);
    setTimeout(() => stdin.send([ 'gUOv4Dn4o8iVYy53rrTK', null ]), 1500);
    setTimeout(() => stdin.send([ 'Y', null ]), 2000);

    const res = await jiraRunner([ 'init' ]);

    console.log('res: ', res);

    stdin.send(null);
});
