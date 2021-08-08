import path from 'path';
import fs from 'fs-extra';
import './mock/JiraApi';
import './mock/ConfluenceApi';
import { createNamespace } from 'cls-hooked';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import { tmpFolder, configPath, logsPath } from './constants';
import { factoryLogger } from './logger';
import defaultUser from './mock/fixtures/atlassian/user.json';

console.log('Current time:', dayjs().format());

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

                Promise.resolve(Reflect.apply(old, this, arguments))
                    .then(res).catch(rej); // eslint-disable-line promise/prefer-await-to-then
            });
        });
    };
});

afterEach(function () {
    if (this.currentTest.state === 'failed') {
        console.error(this.currentTest.err);
        throw this.currentTest.err;
    }
});

async function clean(dirPath, opts) {
    const files = await fs.readdir(tmpFolder);

    await Promise.all(files.map(async f => {
        const fullPath = path.resolve(dirPath, f);

        if (!await fs.exists(fullPath)) return;
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

    async setConfluenceDefault() {
        await this.setTmpFolder();
        await this.saveProfile('confluence_default', this.confluence_default);
    }

    async setJIRADefault() {
        await this.setTmpFolder();
        await this.saveProfile('jira_default', this.jira_default);
        await this.saveProfile('missmatch', {
            ...this.jira_default,
            userId : -1
        });
    }

    async loadConfig() {
        try {
            return await fs.readJSON(configPath);
        } catch  {
            await fs.ensureDir(path.dirname(configPath));

            return {};
        }
    }

    get 'jira_default'() {
        return {
            'host'  : 'http://wuztum.nu',
            'email' : defaultUser.emailAddress,
            'token' : 'jira_atlassian_token',
            'jira'  : {
                'isUse'     : true,
                'isDefault' : true,
                'statuses'  : { 'dev': [ '1', '2' ], 'test': [ '3' ] },
                'gitlab'    : {
                    'jiraId'  : '1122',
                    'gitUser' : [
                        'dmytroPust',
                        'Dmytro Pustovit'
                    ]
                }
            },
            'confluence' : { 'isUse': false },
            'userId'     : defaultUser.accountId,
            '_version'   : '1.0.0'
        };
    }

    get 'confluence_default'() {
        return {
            'host'  : 'http://oh.lr/vuuh',
            'email' : defaultUser.emailAddress,
            'token' : 'confluence_atlassian_token',
            'jira'  : { 'isUse': false },

            'confluence' : {
                'isDefault' : true,
                'isUse'     : true
            },
            'userId'   : defaultUser.accountId,
            '_version' : '1.4.0'
        };
    }
}
