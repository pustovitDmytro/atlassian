import path from 'path';
import fse from 'fs-extra';
import { createLogger, transports } from 'winston';
import { tmpFolder, configPath } from './constants';
import './mock/JiraApi';

export default class Test {
    constructor() {
        const relative = path.relative(tmpFolder, configPath);

        if (relative.includes('..')) throw new Error('config not inside tmp dir');

        this.logger = createLogger({
            transports : [
                new transports.File({
                    filename : path.join(tmpFolder, 'test.log')
                })
            ]
        });
    }
    async setTmpFolder() {
        await fse.ensureDir(tmpFolder);
    }
    async cleanTmpFolder() {
        await fse.remove(tmpFolder);
    }
}

export * from './constants';
