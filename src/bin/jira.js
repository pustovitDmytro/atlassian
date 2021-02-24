#!./node_modules/.bin/babel-node

import os from 'os';
import path from 'path';
import yargs from 'yargs/yargs';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import { isString } from 'myrmidon';
import chalk from 'chalk';
import JIRA from '../JIRA';
import Api from '../AtlassianApi';
import packageInfo from '../../package.json';

const isMain = !module.parent;
const homedir = os.homedir();
const defaultConfigPath = path.join(homedir, '.atlassian');
const configPath = process.env.ATLASSIAN_CONFIG_PATH || defaultConfigPath;

const validate = (required, regexp, msg = 'invalid value') => value => {
    if (!value) return 'value is required';
    if (regexp && !regexp.test(value)) return msg;

    return true;
};

function errorFormatter(error) {
    if (error.isAxiosError) {
        const json = error.toJSON();

        if (json.data) throw JSON.stringify(json.data);

        throw json.message;
    }
    throw error;
}

async function validateCredentials(token, answers) {
    this.jira = new JIRA({
        host  : answers.host,
        email : answers.email,
        token
    });

    this.myself = await this.jira.getMyself().catch(errorFormatter);

    return true;
}

const CREDENTIALS_QUESTIONS = (context = {}) => [
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
        type     : 'password',
        name     : 'token',
        mask     : '*',
        message  : 'Past your token: ',
        validate : validateCredentials.bind(context)
    },
    {
        type    : 'confirm',
        name    : 'confirm',
        message : () => `User found:\n${JSON.stringify(context.myself, null, 4)}\nis this you?`
    }
];

const isMakeDefault = (currentConfig, scope) => ({
    type    : 'confirm',
    name    : 'isDefault',
    message : () => {
        const profile = getDefaultProfile(currentConfig, scope);

        return profile
            ? `Profile ${profile} used as default for ${scope} calls, change?`
            : `Make this profile default for ${scope} calls?`;
    }
});

const JIRA_QUESTIONS = (currentConfig, credentials, context = {}) => [
    isMakeDefault(currentConfig, 'jira'),
    ...[ 'dev', 'test' ].map((name, index) => {
        const isFirst = index === 0;

        return {
            type    : 'input',
            name    : `statuses.${name}`,
            message : async () => {
                const messages = [];

                if (isFirst) {
                    context.jira = new JIRA(credentials);
                    context.statuses = await context.jira.loadStatuses();

                    messages.push(
                        '\nCurrent Jira statuses in project:',
                        ...context.statuses.map(s => `${s.id} ${s.name}`)
                    );
                }
                messages.push(`\nEnter list of statuses for ${name}`);

                return messages.join('\n');
            },
            transformer : inp => isString(inp) ? inp.split(/[\s,]+/) : inp,
            filter      : inp => isString(inp) ? inp.split(/[\s,]+/) : inp,
            validate    : async inp => {
                const statusIds = context.statuses.map(s => s.id);
                const invalid = inp.find(i => !statusIds.includes(i));

                if (invalid) return `${invalid} is not valid status. should be one of [${statusIds.join(',')}]`;

                return true;
            }
        };
    }),
    {
        type    : 'confirm',
        name    : 'confirm',
        message : answ => `jira config: \n${JSON.stringify(answ, null, 4)}\nis everything correct?`
    }
];

const CONFLUENCE_QUESTIONS = (currentConfig) => [
    isMakeDefault(currentConfig, 'confluence')
];

const PROFILE_QUESTIONS = (currentConfig) => [
    {
        type    : 'input',
        name    : 'profile',
        default : 'default',
        message : 'Name your profile'
    },
    {
        type    : 'confirm',
        name    : 'confirm',
        when    : answers => !!currentConfig[answers.profile],
        message : answers => `Profile ${answers.profile} already exists, replace?`
    }
];

function getDefaultProfile(config, scope) {
    return Object.keys(config).find(key => config[key][scope]?.isDefault);
}

async function loadConfig() {
    return fs.readJSON(configPath).catch(async () => {
        await fs.ensureDir(path.dirname(configPath));

        return {};
    });
}

async function loadProfile(scope, name) {
    const config = await loadConfig();

    let profileName = name;

    if (!profileName) profileName = process.env.ATLASSIAN_PROFILE;
    if (!profileName) profileName = getDefaultProfile(config, scope);
    if (!profileName) throw new Error('no profile selected');

    const profile = config[profileName];

    if (!profile) throw new Error(`no profile ${profileName} found`);

    const api = new Api(profile.host, {
        username : profile.email,
        password : profile.token
    });

    const myself = await api.getMyself();

    if (myself.id !== profile.userId) throw new Error(`Profile ${profileName} not matches user ${JSON.stringify(myself)}`);

    return profile;
}


async function untilConfirm(q) {
    const { confirm, ...res } = await inquirer.prompt(q);

    if (confirm !== false) return res;

    return untilConfirm(q);
}

async function init() {
    const currentConfig = await loadConfig();
    const context = {};
    const credentials = await untilConfirm(CREDENTIALS_QUESTIONS(context));
    const jira = await untilConfirm(JIRA_QUESTIONS(currentConfig, credentials, context));
    const confluence = await untilConfirm(CONFLUENCE_QUESTIONS(currentConfig, credentials));
    const { profile } = await untilConfirm(PROFILE_QUESTIONS(currentConfig));

    currentConfig[profile] = {
        ...credentials,
        jira,
        confluence,
        userId   : context.myself.id,
        _version : packageInfo.version
    };

    [ 'jira', 'confluence' ].forEach(key => {
        const { isDefault } = currentConfig[profile][key];

        if (isDefault) {
            const currentDefault = getDefaultProfile(currentConfig, key);

            if (currentDefault) {
                currentConfig[currentDefault][key].isDefault = false;
            }
        }
    });
    await fs.writeJSON(configPath, currentConfig);
    console.log(`Profile ${profile} saved`);
}

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
    await new Promise((res, rej) => {
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
