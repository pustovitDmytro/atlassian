#!./node_modules/.bin/babel-node
/* eslint-disable max-lines-per-function */

import yargs from 'yargs/yargs';
import { isArray } from 'myrmidon';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import ms from 'ms';
import JIRA from '../Jira';
import packageInfo from '../../package.json';
import { adfToText } from '../utils/adfUtils';
import { getCLIRunner } from './utils';
import init from './init';
import logger from './logger';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const isMain = !module.parent;

const cliCommand = getCLIRunner({
    isMain,
    profile : 'jira'
});

function prettyDate(date) {
    return dayjs(date).format('DD-MM-YYYY');
}

async function list(args, profile) {
    const jira = new JIRA(profile, logger);
    const stages = [];

    if (args.dev) stages.push('dev');
    const tasks = await jira.list({
        isMine : args.mine,
        search : args.search,
        sprint : args.sprint,
        stages
    });

    for (const t of tasks) {
        logger.info(`%s ${t.summary}`, t.key);
    }
}

async function test(args, profile) {
    const jira = new JIRA(profile, logger);

    for (const issueId of args.issueId) {
        await jira.test(issueId);
    }
}

async function show(args, profile) {
    const jira = new JIRA(profile, logger);
    const task = await jira.show(args.issueId);

    logger.info(`%s: ${task.summary}\n`, task.key);
    logger.info(`Assignee: ${task.assigneeName} (${task.assignee})`);
    logger.info(`Status: ${task.status} (${task.statusName})`);
    logger.info(`Priority: ${task.priority}`);

    logger.info(adfToText(task.description));
    if (args.comments && task.comments.length > 0) {
        logger.info('\nComments:');
        for (const com of task.comments) {
            logger.info(`\n%s (${com.author}) ${prettyDate(com.date)}`, com.authorName);
            logger.info(adfToText(com.text));
        }
    }
}

async function exportLog(args, profile) {
    const jira = new JIRA(profile, logger);

    await jira.exportLog([ args.start, args.end ], args.file);
}

async function clearWorklog(args, profile) {
    const jira = new JIRA(profile, logger);

    const cleared = await jira.clearWorklog(args.issueId);

    if (cleared.length === 0) logger.warn('No worklogs found');
    for (const i of cleared) {
        logger.info('Removed %s for %s', ms(i.time), dayjs(i.start).format('DD MMM YYYY'));
    }
}

async function logIssues(args, profile) {
    const jira = new JIRA(profile, logger);

    await jira.logIssues(args);
}

const FORMATS = [ 'DD MM', 'DD MMM', 'DD-MMM', 'DD-MM', 'DD-MM-YY', 'DD MM YY', 'DD-MM-YYYY', 'DD MM YYYY' ];

const dateSuffix = `\npossible formats: ${FORMATS.join(', ')}`;

function asDate(date) {
    if (!date) return;
    if (isArray(date)) return date.map(d => asDate(d));
    for (const format of FORMATS) {
        const dated = dayjs.utc(date, format, true);

        if (dated.isValid()) return dated;
    }

    throw new Error(`Invalid date ${date}`);
}

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

export default async function run(cmd) {
    function onYargsFail(message, error, ygs) {
        const failMessage = message || error;

        ygs.showHelp('error');
        if (failMessage) {
            console.log();
            logger.error(failMessage.toString());
            logger.verbose(error?.stack);
        }

        if (!isMain) throw (failMessage);
        process.exit(1);
    }

    const minTerminalWidth =  95;
    const commonCommandArgs = '[--verbose] [--profile=<profile>]';

    const Argv = yargs(cmd)
        .usage('Usage: $0 <command> [options]')
        .command({
            command : 'init',
            desc    : 'Add attlasian profile',
            handler : cliCommand(init, { noLoadProfile: true })
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
            desc    : 'Send task(s) to testing',
            builder : y => commonOpts(y)
                .option('issueId', {
                    describe : 'id(s) of task',
                    type     : 'array'
                }),
            handler : cliCommand(test)
        })
        .command({
            command : `show ${commonCommandArgs} [--comments] <issueId>`,
            desc    : 'Show task description',
            builder : y => commonOpts(y)
                .option('issueId', {
                    describe : 'id of task',
                    type     : 'string'
                })
                .option('comments', {
                    describe : 'Show comments',
                    type     : 'boolean'
                }),
            handler : cliCommand(show)
        })
        .command({
            command : `export log ${commonCommandArgs} <start> <end> [--file=<file>]`,
            desc    : 'Export tasks for time tracking',
            builder : y => commonOpts(y)
                .option('start', {
                    describe : `issues with updatedDate >= start will be included ${dateSuffix}`,
                    type     : 'date'
                })
                .option('end', {
                    describe : `issues with created <= end will be included ${dateSuffix}`,
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
            desc    : 'Clear worklog',
            builder : y => commonOpts(y)
                .option('start', {
                    describe : `clear only worklogs after (>=) start date ${dateSuffix}`,
                    type     : 'date'
                })
                .option('end', {
                    describe : `clear only worklogs before (<=) end date ${dateSuffix}`,
                    type     : 'date'
                })
                .coerce('start', asDate)
                .coerce('end', asDate),
            handler : cliCommand(clearWorklog)
        })
        .command({
            command : `log ${commonCommandArgs} [--issues=<issues>] [--from=<from>] [--to=<to>] [--include=<include>] [--exclude=<exclude>] [--confirm]`,
            desc    : 'Log time in issues',
            builder : y => commonOpts(y)
                .option('issues', {
                    demandOption : true,
                    describe     : 'path to file with issues',
                    type         : 'path'
                })
                .option('include', {
                    describe : 'add day to worklog',
                    type     : 'array'
                })
                .option('exclude', {
                    describe : 'remove day from worklog',
                    type     : 'array'
                })
                .option('from', {
                    demandOption : true,
                    describe     : `start of worklog period ${dateSuffix}`,
                    type         : 'date'
                })
                .option('to', {
                    demandOption : true,
                    describe     : `end of worklog period ${dateSuffix}`,
                    type         : 'date'
                })
                .option('confirm', {
                    describe : 'actually log time',
                    alias    : 'y',
                    type     : 'boolean'
                })
                .coerce('from', asDate)
                .coerce('to', asDate)
                .coerce('include', asDate)
                .coerce('exclude', asDate),
            handler : cliCommand(logIssues)
        })
        .help('h')
        .alias('h', 'help')
        .wrap(Math.min(minTerminalWidth, process.stdout.columns))
        .version(packageInfo.version)
        .demandCommand(1, '').recommendCommands().strict()
        .epilog(`${packageInfo.name} v.${packageInfo.version}`)
        .fail(onYargsFail);

    await Argv.argv;
}

const firstCmdArgIndex = 2;

if (isMain) run(process.argv.slice(firstCmdArgIndex));

