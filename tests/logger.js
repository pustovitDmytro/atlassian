import path from 'path';
import { createLogger, transports } from 'winston';
import arrayTransport from 'winston-array-transport';
import { tmpFolder } from './constants';

export const factoryLogger = createLogger({
    transports : [
        new transports.File({
            filename : path.join(tmpFolder, 'test.log')
        })
    ]
});

export const apiTraces = [];

export const apiLogger = createLogger({
    level      : 'debug',
    transports : [
        new transports.Console(),
        new transports.File({
            filename : path.join(tmpFolder, 'test.log')
        }),
        new arrayTransport({
            array : apiTraces,
            json  : true
        })
    ]
});
