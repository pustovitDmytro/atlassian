import path from 'path';
import { pause } from 'myrmidon';
import mockStdin from  'mock-stdin';
import { stdout } from 'test-console';
import { assert } from 'chai';
import { getNamespace } from 'cls-hooked';
import jsonQuery from 'json-query';
import { entry } from './constants';
import { apiTraces } from './logger';


export class CLITester {
    constructor(dialog, factory) {
        this.dialog = dialog;
        this.stdin = mockStdin.stdin();
        this.factory = factory;
    }

    async test(index = 0, time = 100) {
        const inspect = stdout.inspect();

        await pause(time);
        inspect.restore();
        const out = inspect.output.join('\n');

        if (index === this.dialog.length) {
            this.stdin.restore();

            return out;
        }

        const item = this.dialog[index];

        this.stdin.send([ item.input, null ]);
        this.factory.logger.log('info', { item, out, service: 'CLITester' });
        assert.match(out, new RegExp(item.output), JSON.stringify(item));
        await this.test(index + 1);

        return out;
    }
}

export async function getApiCalls(query, { trace = true } = {}) {
    const ns = getNamespace('__TEST__');
    const queryItems = [];

    if (query)queryItems.push(query);

    if (trace) {
        const traceId = ns.get('current').id;

        queryItems.push(`traceId=${traceId}`);
    }

    const q = `[*${queryItems.join('&')}]`;
    const res = jsonQuery(q, { data: apiTraces });

    return res.value;
}

export function load(relPath, clearCache) {
    const absPath = path.resolve(entry, relPath);

    if (clearCache) delete require.cache[require.resolve(absPath)];
    // eslint-disable-next-line security/detect-non-literal-require
    const result =  require(absPath);

    if (clearCache) delete require.cache[require.resolve(absPath)];

    return result;
}

export function resolve(relPath) {
    return require.resolve(path.join(entry, relPath));
}
