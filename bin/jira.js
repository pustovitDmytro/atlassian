#!./node_modules/.bin/babel-node

import os from 'os';
import path from 'path';
import yargs from 'yargs/yargs';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import packageInfo from '../package.json';

const isMain = !module.parent;
const homedir = os.homedir();
const defaultConfigPath = path.join(homedir, '.atlassian');
const configPath = process.env.ATLASSIAN_CONFIG_PATH || defaultConfigPath;

const validate = (required, regexp, msg = 'invalid value') => value => {
    if (!value) return 'value is required';
    if (regexp && !regexp.test(value)) return msg;

    return true;
};

const questions = [
    {
        type     : 'input',
        name     : 'host',
        validate : validate(true, /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)/, 'not a valid host'),
        message  : 'Enter atlassian host:'
    },
    {
        type     : 'input',
        name     : 'email',
        validate : validate(true, /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/, 'not a valid host'),
        message  : 'Past your email:'
    },
    {
        type    : 'password',
        name    : 'token',
        mask    : '*',
        message : 'Past your token:\nNotice: dont send this value to anyone'
    },
    {
        type    : 'input',
        name    : 'userId',
        message : 'Provide your userID \n(needed for filtering)'
    },
    {
        type    : 'input',
        name    : 'profile',
        default : 'default',
        message : 'Name your profile'
    },
    {
        type    : 'confirm',
        name    : 'confirm',
        message : answers => `${JSON.stringify(answers, null, 4)}\nIs everything correct?`
    }
];

async function init() {
    const { profile, confirm, ...answers } = await inquirer.prompt(questions);

    if (confirm) {
        const currentConfig = await fs.readJSON(configPath).catch(async () => {
            await fs.ensureDir(path.dirname(configPath));
            console.log(`No current config found in ${configPath}`);

            return {};
        });

        currentConfig[profile] = { ...answers, _version: packageInfo.version };
        await fs.writeJSON(configPath, currentConfig);
        console.log(`Profile ${profile} saved`);
    } else {
        console.log(`Cancelled profile ${profile} creation`);
    }
}

async function run(cmd) {
    // eslint-disable-next-line no-unused-expressions
    yargs(cmd)
        .usage('Usage: $0 <command> [options]')
        .command({
            command : 'init',
            desc    : 'Add attlasian profile',
            handler : init
        })
        .command('profiles', 'List stored attlasian profiles')
        .help('h')
        .alias('h', 'help')
        .help()
        .showHelpOnFail(true).demandCommand(1, '').recommendCommands().strict()
        .epilog(`${packageInfo.name} v.${packageInfo.version}`).argv;
}

if (isMain) {
    run(process.argv.slice(2));
}
