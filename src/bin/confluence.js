#!./node_modules/.bin/babel-node

import path from 'path';
import os from 'os';
import yargs from 'yargs/yargs';
import { v4 as uuid } from 'uuid';
import Confluence from '../Confluence';
import packageInfo from '../../package.json';
import { getCLIRunner, commonYargsOpts, minTerminalWidth, commonCommandArgs, getYargsFail } from './utils';
import init from './init';
import logger from './logger';

const isMain = !module.parent;
const  onYargsFail = getYargsFail(isMain, logger);

const cliCommand = getCLIRunner({
    isMain,
    profile : 'confluence'
});

async function listPages(args, profile) {
    const confluence = new Confluence(profile, logger);
    const pages = await confluence.getPages(args.space);

    for (const p of pages) {
        logger.info(`%s ${p.title}`, p.id);
    }
}

async function exportPage(args, profile) {
    const fileName = args.path ? path.resolve(args.path) : path.resolve(os.tmpdir(), `${uuid()}.pdf`);
    const confluence = new Confluence(profile, logger);

    await confluence.exportPage(args.page, fileName);
}

export default async function run(cmd) {
    await  yargs(cmd)
        .usage('Usage: $0 <command> [options]')
        .command({
            command : 'init',
            desc    : 'Add attlasian profile',
            handler : cliCommand(init, { noLoadProfile: true })
        })
        .command({
            command : `pages <space> ${commonCommandArgs}`,
            builder : y => commonYargsOpts(y)
                .option('space', {
                    describe : 'Id of confluence space',
                    type     : 'string'
                })
                .alias('-p', '--profile'),
            desc    : 'List Pages',
            handler : cliCommand(listPages)
        })
        .command({
            command : `export <page> [--path=<path>] ${commonCommandArgs}`,
            builder : y => commonYargsOpts(y)
                .option('page', {
                    describe : 'Id of space page',
                    type     : 'string'
                })
                .alias('-p', '--profile'),
            desc    : 'Export Page as pdf',
            handler : cliCommand(exportPage)
        })
        .help('h')
        .alias('h', 'help')
        .wrap(Math.min(minTerminalWidth, process.stdout.columns))
        .showHelpOnFail(true).demandCommand(1, '').recommendCommands().strict()
        .epilog(`${packageInfo.name} v.${packageInfo.version}`)
        .fail(onYargsFail)
        .argv;
}

if (isMain) {
    const firstCmdArgIndex = 2;

    run(process.argv.slice(firstCmdArgIndex));
}
