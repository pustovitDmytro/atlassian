import { createLogger, transports, format } from 'winston';
import arrayTransport from 'winston-array-transport';
import { logsPath } from './constants';

const levels = {
    error   : 0,
    warn    : 1,
    info    : 2,
    notice  : 3,
    verbose : 4,
    debug   : 5
};

const JSONFormats = [
    format.splat(),
    format.timestamp(),
    format.json()
];

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

export function createUnitLogger(level =  'verbose') {
    const traces = [];
    const logger = createLogger({
        level,
        levels,
        format     : format.combine(...JSONFormats),
        transports : [
            new arrayTransport({
                array : traces,
                json  : true
            })
        ]
    });

    return { logger, traces };
}
