/* eslint-disable no-param-reassign */
import { createLogger, format, transports } from 'winston';
import chalk from 'chalk';
import { level, levels, JSONFormats } from '../logger';

const { SPLAT, MESSAGE, LEVEL } = require('triple-beam');

const splatChalkFormat = format(info => {
    if (info[SPLAT]) {
        info[SPLAT] = info[SPLAT].map(s => chalk.bold(s));
    }

    return info;
});

const levelTags = {
    warn  : { color: '#b3b300', name: 'Warning' },
    error : { color: '#b30000', name: 'Error', fillMessage: true }
};


const simpleChalkFormat = format(info => {
    const levelTag = levelTags[info.level];
    const messages = [];

    if (levelTag) messages.push(chalk.hex(levelTag.color).bold(`${levelTag.name}: `));
    messages.push(levelTag?.fillMessage
        ? chalk.hex(levelTag.color)(info.message)
        : info.message
    );
    info[MESSAGE] = messages.join('');

    return info;
});

const levelsFilter = (lvs = [], ...rest) => format(info => {
    if (lvs.includes(info[LEVEL])) {
        return info;
    }
})(...rest);

export default createLogger({
    level,
    levels,
    transports : [
        new transports.Console({
            format : format.combine(
                splatChalkFormat(),
                format.splat(),
                simpleChalkFormat()
            ),
            level : 'info'
        }),
        new transports.Console({
            format : format.combine(
                levelsFilter([ 'debug', 'verbose', 'notice' ]),
                ...JSONFormats
            )
        })
    ]
});

