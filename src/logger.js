/* eslint-disable camelcase */
import { createLogger, format, transports } from 'winston';
import { version, name } from '../package.json';

const appNameFormat = format(info => {
    info[name] = version; // eslint-disable-line no-param-reassign

    return info;
});

const { npm_config_loglevel, ATLASSIAN_DEBUG, ATLASSIAN_LOG_LEVEL } = process.env;

export const level = ATLASSIAN_LOG_LEVEL || ATLASSIAN_DEBUG && 'debug' || npm_config_loglevel || 'notice';
export const levels = {
    error   : 0,
    warn    : 1,
    info    : 2,
    notice  : 3,
    verbose : 4,
    debug   : 5
};

export const JSONFormats = [
    format.splat(),
    appNameFormat(),
    format.timestamp(),
    format.json()
];


export default createLogger({
    level,
    levels,
    format     : format.combine(...JSONFormats),
    transports : [
        new transports.Console({})
    ]
});
