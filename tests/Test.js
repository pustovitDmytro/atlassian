import path from 'path';
import fs from 'fs-extra';
import './mock/JiraApi';
import './mock/AtlassianApi';
import { createNamespace } from 'cls-hooked';
import uuid from 'uuid';
import { tmpFolder, configPath } from './constants';
import { factoryLogger } from './logger';

const context = createNamespace('__TEST__');

beforeEach(function setClsFromContext() {
    const old = this.currentTest.fn;

    this.currentTest._TRACE_ID = uuid.v4();
    this.currentTest.fn = function clsWrapper() {
        return new Promise((res, rej) => {
            context.run(() => {
                context.set('current', {
                    test  : this.test.title,
                    suite : this.test.parent.title,
                    body  : this.test.body,
                    id    : this.test._TRACE_ID
                });

                // eslint-disable-next-line more/no-then
                Promise.resolve(old.apply(this, arguments))
                    .then(res)
                    .catch(rej);
            });
        });
    };
});

export default class Test {
    constructor() {
        const relative = path.relative(tmpFolder, configPath);

        if (relative.includes('..')) throw new Error('config not inside tmp dir');

        this.logger = factoryLogger;
    }
    async setTmpFolder() {
        await fs.ensureDir(tmpFolder);
    }
    async cleanTmpFolder() {
        await fs.remove(tmpFolder);
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
                'isDefault' : true,
                'statuses'  : { 'dev': [ '1', '2' ], 'test': [ '3' ] }
            },
            'confluence' : { 'isDefault': false },
            'userId'     : 1,
            '_version'   : '1.0.0'
        };
    }
}

export * from './constants';
