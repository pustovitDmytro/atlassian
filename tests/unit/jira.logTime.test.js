import { assert } from 'chai';
import Test from '../Test';
import { load, getApiCalls } from '../utils';
import { createUnitLogger } from '../logger';

const factory = new Test();
const JIRA = load('Jira').default;
const { logger, traces } = createUnitLogger('debug');

suite('JIRA: logTime');

before(async function () {});

test('Set time to 12:00 by local tz', async function () {
    const jira = new JIRA(factory.jira_default);

    jira.setLogger(logger);

    await jira.logTime('Y-1', '1 Feb 2020', 1);
    const calls = await getApiCalls('type=requestSent', { traces });

    assert.lengthOf(calls, 1);
    const { data } = calls[0];

    assert.deepEqual(data, {
        timeSpentSeconds : 60 * 60,
        started          : '2020-02-01T12:0:0.000+0200'
    });
});

after(async function () {});
