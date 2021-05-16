import { createLogger, transports, format } from 'winston';
import arrayTransport from 'winston-array-transport';
import { load } from './utils';
import { logsPath } from './constants';

const { levels, JSONFormats } = load('logger');

export const factoryLogger = createLogger({
    transports : [
        new transports.File({
            filename : logsPath
        })
    ]
});

export const apiTraces = [];

export const apiLogger = createLogger({
    level      : 'debug',
    levels,
    format     : format.combine(...JSONFormats),
    transports : [
        new transports.Console(),
        new transports.File({
            filename : logsPath
        }),
        new arrayTransport({
            array : apiTraces,
            json  : true
        })
    ]
});
