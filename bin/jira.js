#!/usr/bin/env node

process.env.BABEL_DISABLE_CACHE = 1;

require('@babel/register');
const os = require('os');
const path = require('path');
const yargs = require('yargs/yargs');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const packageInfo = require('../package.json');
const JIRA = require('../src/JIRA').default;
const chalk = require('chalk');

const isMain = !module.parent;
const homedir = os.homedir();
const defaultConfigPath = path.join(homedir, '.atlassian');
const configPath = process.env.ATLASSIAN_CONFIG_PATH || defaultConfigPath;

const validate = (required, regexp, msg = 'invalid value') => value => {
    if (!value) return 'value is required';
    if (regexp && !regexp.test(value)) return msg;

    return true;
};

const SCOPES = [ 'jira', 'confluence', 'test' ];

const questions = currentConfig => [
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
        message : 'Past your token: '
    },
    {
        type    : 'input',
        name    : 'profile',
        default : 'default',
        message : 'Name your profile'
    },
    ...SCOPES.map(scope => ({
        type    : 'confirm',
        name    : `default.${scope}`,
        message : () => `Profile ${getDefaultProfile(currentConfig, scope)} used as default for ${scope} calls, change?`,
        when    : () => getDefaultProfile(currentConfig, scope)
    })),
    {
        type    : 'confirm',
        name    : 'confirm',
        message : answers => `${JSON.stringify(buildConfig(answers), null, 4)}\nIs everything correct?`
    }
];

function getDefaultProfile(config, level) {
    return Object.keys(config).find(key => config[key].default[level]);
}

function buildConfig(answers) {
    const defaults = {
        ...SCOPES.reduce((prev, cur) => ({ ...prev, [cur]: true }), {}),
        ...answers.default
    };

    return {
        profile : answers.profile,
        host    : answers.host,
        email   : answers.email,
        default : defaults
    };
}

async function init() {
    const currentConfig = await fs.readJSON(configPath).catch(async () => {
        await fs.ensureDir(path.dirname(configPath));
        console.log(`No current config found in ${configPath}`);

        return {};
    });

    const { profile, confirm, token, ...answers } = await inquirer.prompt(questions(currentConfig));

    if (confirm) {
        const profileConfig = buildConfig(answers);

        Object.keys(profileConfig.defaults).forEach(key => {
            const isDefault = profileConfig.defaults[key];

            if (isDefault) {
                const currentDefault = getDefaultProfile(currentConfig, key);

                if (currentDefault) {
                    currentConfig[currentDefault].default[key] = false;
                }
            }
        });
        currentConfig[profile] = { ...profileConfig, token, _version: packageInfo.version };
        await fs.writeJSON(configPath, currentConfig);
        console.log(`Profile ${profile} saved`);
    } else {
        console.log(`Cancelled profile ${profile} creation`);
    }
}

async function list(args) {
    const config = await fs.readJSON(configPath);
    const profile = Object.values(config)[0];
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
    const config = await fs.readJSON(configPath);
    const profile = Object.values(config)[0];
    const jira = new JIRA(profile);

    await jira.test(args.issueId);
    // if (args.dev) stages.push('dev');
    // const tasks = await jira.list({
    //     isMine : args.mine,
    //     search : args.search,
    //     sprint : args.sprint,
    //     stages
    // });

    // tasks.forEach(t => {
    //     console.log(chalk.bold(t.key), t.summary);
    // });
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
        .command({
            command : 'list [--dev] [--mine] [--search=<search>] [--sprint=<sprint>]',
            aliases : [ 'ls' ],
            builder : y => y
                .alias('-d', '--dev')
                .alias('-m', '--mine')
                .alias('-s', '--search')
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
        .epilog(`${packageInfo.name} v.${packageInfo.version}`).argv;
}

if (isMain) {
    run(process.argv.slice(2));
}
