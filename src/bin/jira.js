#!./node_modules/.bin/babel-node

import yargs from 'yargs/yargs';
import chalk from 'chalk';
import JIRA from '../JIRA';
import packageInfo from '../../package.json';
import {  loadProfile } from './utils';
import init from './init';

const isMain = !module.parent;

async function list(args) {
    const profile = await loadProfile('jira', args.profile);
    const jira = new JIRA(profile);
    const stages = [];

    if (args.dev) stages.push('dev');
    const tasks = await jira.list({
        isMine : args.mine,
        search : args.search,
        sprint : args.sprint,
        stages
    });

    tasks.forEach(t => {
        console.log(chalk.bold(t.key), t.summary);
    });
}

async function test(args) {
    const profile = await loadProfile('jira', args.profile);
    const jira = new JIRA(profile);

    await jira.test(args.issueId);
}

export default async function run(cmd) {
    await new Promise((res) => {
        // eslint-disable-next-line no-unused-expressions
        yargs(cmd)
            .usage('Usage: $0 <command> [options]')
            .command({
                command : 'init',
                desc    : 'Add attlasian profile',
                handler : init
            })
            .command({
                command : 'list [--dev] [--mine] [--search=<search>] [--sprint=<sprint>]',
                aliases : [ 'ls' ],
                builder : y => y
                    .alias('-d', '--dev')
                    .alias('-m', '--mine')
                    .alias('-s', '--search')
                    .alias('--grep', '--search')
                    .array('--sprint'),
                desc    : 'List Tasks',
                handler : list
            })
            .command({
                command : 'test [<issueId>]',
                desc    : 'Send task to testing',
                handler : test
            })
            .command('profiles', 'List stored attlasian profiles')
            .help('h')
            .alias('h', 'help')
            .help()
            .showHelpOnFail(true).demandCommand(1, '').recommendCommands().strict()
            .epilog(`${packageInfo.name} v.${packageInfo.version}`).onFinishCommand(res).argv;
    });
}

if (isMain) {
    run(process.argv.slice(2));
}
