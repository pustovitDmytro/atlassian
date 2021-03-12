#!./node_modules/.bin/babel-node

import yargs from 'yargs/yargs';
import { isPromise } from 'myrmidon';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import ms from 'ms';
import JIRA from '../JIRA';
import packageInfo from '../../package.json';
import { loadProfile, installLogger } from './utils';
import init from './init';
import logger from './logger';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const isMain = !module.parent;

function onError(e) {
    logger.error(e.toString());
    logger.verbose(e.stack);
    if (isMain) process.exit(1);

    throw e;
}

function onSuccess(result) {
    return result;
}

function cliCommand(method) {
    const f =  function (...args) {
        try {
            const promise = method.apply(this, args);

            if (isPromise(promise)) {
                return promise // eslint-disable-line more/no-then
                    .then(result => onSuccess(result))
                    .catch(error => onError(error));
            }

            return onSuccess(promise);
        } catch (error) {
            onError(error);
        }
    };

    return f;
}

async function list(args) {
    try {
        installLogger(logger, args);
        const profile = await loadProfile('jira', args.profile);
        const jira = new JIRA(profile, logger);
        const stages = [];

        if (args.dev) stages.push('dev');
        const tasks = await jira.list({
            isMine : args.mine,
            search : args.search,
            sprint : args.sprint,
            stages
        });

        tasks.forEach(t => {
            logger.info(`%s ${t.summary}`, t.key);
        });
    } catch (error) {
        onError(error);
    }
}

async function test(args) {
    installLogger(logger, args);
    const profile = await loadProfile('jira', args.profile);
    const jira = new JIRA(profile, logger);

    for (const issueId of args.issueId) {
        await jira.test(issueId);
    }
}

async function exportLog(args) {
    installLogger(logger, args);
    const profile = await loadProfile('jira', args.profile);
    const jira = new JIRA(profile, logger);

    await jira.exportLog([ args.start, args.end ], args.file);
}

async function clearWorklog(args) {
    installLogger(logger, args);
    const profile = await loadProfile('jira', args.profile);
    const jira = new JIRA(profile, logger);

    const cleared = await jira.clearWorklog(args.issueId);

    if (!cleared.length) logger.warn('No worklogs found');
    cleared.forEach(i => {
        logger.info('Removed %s for %s', ms(i.time), dayjs(i.start).format('DD MMM YYYY'));
    });
}

const FORMATS = [ 'DD MM', 'DD MMM', 'DD-MMM', 'DD-MM', 'DD-MM-YY', 'DD MM YY', 'DD-MM-YYYY', 'DD MM YYYY' ];

function asDate(date) {
    for (const format of FORMATS) {
        const dated = dayjs.utc(date, format, true);

        if (dated.isValid()) return dated;
    }
    throw new Error(`Invalid date ${date}`);
}

export default async function run(cmd) {
    await new Promise((res, rej) => {
        function onYargsFail(message, error, ygs) {
            const failMessage = message || error;

            ygs.showHelp('error');
            if (failMessage) {
                console.log();
                logger.error(failMessage.toString());
                logger.verbose(error?.stack);
            }
            if (!isMain) return rej(failMessage);
            process.exit(2);
        }
        const commonCommandArgs = '[--verbose] [--profile=<profile>]';
        const commonOpts = y => y
            .option('verbose', {
                describe : 'verbose logs',
                alias    : [ 'v' ],
                type     : 'boolean'
            })
            .option('profile', {
                alias    : [ 'p' ],
                describe : 'specify profile name',
                type     : 'string'
            });

        const Argv = yargs(cmd)
            .usage('Usage: $0 <command> [options]')
            .command({
                command : 'init',
                desc    : 'Add attlasian profile',
                handler : cliCommand(init)
            })
            .command({
                command : `list [--dev] [--mine] [--search=<search>] [--sprint=<sprint>] ${commonCommandArgs}`,
                aliases : [ 'ls' ],
                builder : y => commonOpts(y)
                    .option('dev', {
                        alias    : [ 'd', 'development' ],
                        describe : 'filter only tasks in development',
                        type     : 'boolean'
                    })
                    .option('mine', {
                        alias    : [ 'm', 'my' ],
                        describe : 'filter only mine issues',
                        type     : 'boolean'
                    })
                    .option('search', {
                        alias    : [ 's', 'grep' ],
                        describe : 'search issues by summary',
                        type     : 'string'
                    })
                    .option('sprint', {
                        describe : 'specify sprints for filter',
                        choices  : [ 'all', 'open' ],
                        default  : [ 'open' ],
                        type     : 'array'
                    }),
                desc    : 'List Tasks',
                handler : cliCommand(list)
            })
            .command({
                command : `test ${commonCommandArgs} <issueId...>`,
                desc    : 'Send task to testing',
                builder : y => commonOpts(y)
                    .option('issueId', {
                        describe : 'id(s) of task',
                        type     : 'array'
                    }),
                handler : cliCommand(test)
            })
            .command({
                command : `export log ${commonCommandArgs} <start> <end> [file]`,
                desc    : 'Send task to testing',
                builder : y => commonOpts(y)
                    .option('start', {
                        describe : `issues with updatedDate >= start will be included\npossible formats: ${FORMATS.join(', ')}`,
                        type     : 'date'
                    })
                    .option('end', {
                        describe : `issues with created <= end will be included\npossible formats: ${FORMATS.join(', ')}`,
                        type     : 'date'
                    })
                    .option('file', {
                        describe : 'path to resulting file',
                        type     : 'string'
                    })
                    .coerce('start', asDate)
                    .coerce('end', asDate),
                handler : cliCommand(exportLog)
            })
            .command({
                command : `worklog clear <issueId> ${commonCommandArgs} [--start=<start>] [--end=<end>]`,
                desc    : 'Send task to testing',
                builder : y => commonOpts(y)
                    .option('start', {
                        describe : 'clear only worklogs after (>=) start date',
                        type     : 'date'
                    })
                    .option('end', {
                        describe : 'clear only worklogs before (<=) end date',
                        type     : 'date'
                    })
                    .coerce('start', asDate)
                    .coerce('end', asDate),
                handler : cliCommand(clearWorklog)
            })
            .command('profiles', 'List stored attlasian profiles')
            .help('h')
            .alias('h', 'help')
            .wrap(Math.min(95, process.stdout.columns))
            .version(packageInfo.version)
            .demandCommand(1, '').recommendCommands().strict()
            .epilog(`${packageInfo.name} v.${packageInfo.version}`)
            .onFinishCommand(res)
            .fail(onYargsFail);

        return Argv.argv;
    });
}

if (isMain) run(process.argv.slice(2));

