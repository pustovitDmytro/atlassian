#!./node_modules/.bin/babel-node

import yargs from 'yargs/yargs';
import { isPromise } from 'myrmidon';
import JIRA from '../JIRA';
import packageInfo from '../../package.json';
import { loadProfile, installLogger } from './utils';
import init from './init';
import logger from './logger';

const isMain = !module.parent;

function onError(e) {
    if (isMain) {
        logger.error(`${e.name}: ${e.message}`);
        logger.verbose(e.stack);
        process.exit(1);
    }
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

export default async function run(cmd) {
    await new Promise((res, rej) => {
        function onYargsFail(message, error, ygs) {
            const failMessage = message || error;

            if (!isMain) rej(failMessage);
            ygs.showHelp('error');
            if (failMessage) {
                console.log();
                logger.error(failMessage.toString());
                logger.verbose(error?.stack);
            }
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

