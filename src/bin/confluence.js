#!/usr/bin/env node

process.env.BABEL_DISABLE_CACHE = 1;

require('@babel/register');
const os = require('os');
const path = require('path');
const yargs = require('yargs/yargs');
// const inquirer = require('inquirer');
const fs = require('fs-extra');
const uuid = require('uuid');
const chalk = require('chalk');
const packageInfo = require('../../package.json');
const Confluence = require('../Confluence').default;

const isMain = !module.parent;
const homedir = os.homedir();
const defaultConfigPath = path.join(homedir, '.atlassian');
const configPath = process.env.ATLASSIAN_CONFIG_PATH || defaultConfigPath;

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

async function run(cmd) {
    // eslint-disable-next-line no-unused-expressions
    yargs(cmd)
        .usage('Usage: $0 <command> [options]')
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
        .epilog(`${packageInfo.name} v.${packageInfo.version}`).argv;
}

if (isMain) {
    run(process.argv.slice(2));
}
