import path from 'path';
import fs from 'fs-extra';
import './mock/JiraApi';
import './mock/AtlassianApi';
import { createNamespace } from 'cls-hooked';
import { v4 as uuid } from 'uuid';
import { tmpFolder, configPath, logsPath } from './constants';
import { factoryLogger } from './logger';

const context = createNamespace('__TEST__');

beforeEach(function setClsFromContext() {
    const old = this.currentTest.fn;

    this.currentTest._TRACE_ID = uuid();
    this.currentTest.fn = function clsWrapper() {
        return new Promise((res, rej) => {
            context.run(() => {
                context.set('current', {
                    test  : this.test.title,
                    suite : this.test.parent.title,
                    body  : this.test.body,
                    id    : this.test._TRACE_ID
                });

                Promise.resolve(old.apply(this, arguments))
                    .then(res)
                    .catch(rej);
            });
        });
    };
});

async function clean(dirPath, opts) {
    const files = await fs.readdir(tmpFolder);

    await Promise.all(files.map(async f => {
        const fullPath = path.resolve(dirPath, f);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) return clean(fullPath, opts);
        const match = Object.keys(opts).find(key => fullPath.match(key));

        if (match) {
            const mode = opts[match];

            if (mode === 'truncate') await fs.truncate(fullPath);
        }

        await fs.remove(fullPath);
    }));
}

export * from './utils';
export * from './constants';

export default class Test {
    constructor() {
        const relative = path.relative(tmpFolder, configPath);

        if (relative.includes('..')) throw new Error('config not inside tmp dir');

        this.logger = factoryLogger;
    }

    async setTmpFolder() {
        await this.cleanTmpFolder();
        await fs.ensureDir(tmpFolder);
    }

    async cleanTmpFolder() {
        await clean(tmpFolder, {
            [logsPath] : 'truncate'
        });
    }

    async saveProfile(name, profile) {
        const config = await this.loadConfig();

        config[name] = profile;
        await fs.writeJSON(configPath, config);
    }

    loadConfig() {
        return fs.readJSON(configPath).catch(async () => {
            await fs.ensureDir(path.dirname(configPath));

            return {};
        });
    }

    get 'jira_default'() {
        return {
            'host'  : 'http://wuztum.nu',
            'email' : 'kuba@gu.nr',
            'token' : 'gUOv4Dn4o8iVYy53rrTK',
            'jira'  : {
                'isUse'     : true,
                'isDefault' : true,
                'statuses'  : { 'dev': [ '1', '2' ], 'test': [ '3' ] }
            },
            'confluence' : { 'isUse': false },
            'userId'     : 1,
            '_version'   : '1.0.0'
        };
    }
}
