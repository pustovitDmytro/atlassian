import { assert } from 'chai';
import { createLogger, format } from 'winston';
import arrayTransport from 'winston-array-transport';
import Test from '../Test';
import { load } from '../utils';

const factory = new Test();

const JIRA = load('Jira').default;
const { JSONFormats, levels } = load('logger');

export const traces = [];

const logger = createLogger({
    level      : 'verbose',
    levels,
    format     : format.combine(...JSONFormats),
    transports : [
        new arrayTransport({
            array : traces,
            json  : true
        })
    ]
});

suite('JIRA: logger');

before(async function () {});

test('Check logger format', async function () {
    const jira = new JIRA(factory.jira_default);

    jira.setLogger(logger);

    await jira.getStatuses();
    const log = traces[0];

    assert.exists(log.traceId);
    assert.exists(log.data);
    assert.exists(log.atlassian);
    assert.exists(log.timestamp);
    assert.equal(log.level, 'verbose');
});

after(async function () {});
