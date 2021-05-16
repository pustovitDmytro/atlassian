#!./node_modules/.bin/babel-node

import path from 'path';
import os from 'os';
import yargs from 'yargs/yargs';
import chalk from 'chalk';
import fs from 'fs-extra';
import { v4 as uuid } from 'uuid';
import Confluence from '../Confluence';
import packageInfo from '../../package.json';
import { configPath } from './utils';
import init from './init';

const isMain = !module.parent;

async function listPages(args) {
    const config = await fs.readJSON(configPath);
    const profile =  args.profile ? config[args.profile] : Object.values(config)[0];

    const confluence = new Confluence(profile);
    const pages = await confluence.getPages(args.space);

    pages.forEach(p => console.log(chalk.bold(p.id), `${p.title}`));
}

async function exportPage(args) {
    const config = await fs.readJSON(configPath);
    const profile =  args.profile ? config[args.profile] : Object.values(config)[0];
    const fileName = args.path ? path.resolve(args.path) : path.resolve(os.tmpdir(), `${uuid.v4()}.pdf`);
    const confluence = new Confluence(profile);

    await confluence.exportPage(args.page, fileName);
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
                command : 'pages <space> [--profile=<profile>]',
                builder : y => y
                    .alias('-p', '--profile'),
                desc    : 'List Pages',
                handler : listPages
            })
            .command({
                command : 'export <page> [--path=<path>]',
                builder : y => y
                    .alias('-p', '--profile'),
                desc    : 'Export Page as pdf',
                handler : exportPage
            })
            .help('h')
            .alias('h', 'help')
            .help()
            .showHelpOnFail(true).demandCommand(1, '').recommendCommands().strict()
            .epilog(`${packageInfo.name} v.${packageInfo.version}`)
            .onFinishCommand(res).argv;
    });
}

if (isMain) {
    const firstCmdArgIndex = 2;

    run(process.argv.slice(firstCmdArgIndex));
}
