#!/usr/bin/env node

process.env.BABEL_DISABLE_CACHE = 1;

require('@babel/register');
const os = require('os');
const path = require('path');
const yargs = require('yargs/yargs');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const { isString } = require('myrmidon');
const chalk = require('chalk');
const packageInfo = require('../package.json');
const JIRA = require('../src/JIRA').default;

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

const SCOPES = [ 'jira', 'confluence' ];

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
            : 'Make this profile default for jira calls?';
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
                    const statuses = await context.jira.loadStatuses();

                    messages.push(
                        '\nCurrent Jira statuses in project:',
                        ...statuses.map(s => `${s.id} ${s.name}`)
                    );
                }
                messages.push(`\nEnter list of statuses for ${name}`);

                return messages.join('\n');
            },
            transformer : inp => isString(inp) ? inp.split(/[\s,]+/) : inp,
            filter      : inp => isString(inp) ? inp.split(/[\s,]+/) : inp,
            validate    : async inp => {
                const statuses = await context.jira.loadStatuses();
                const statusIds = statuses.map(s => s.id);
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

const CONFLUENCE_QUESTIONS = (currentConfig, credentials, context = {}) => [
    isMakeDefault(currentConfig, 'confluence'),
    {
        type    : 'confirm',
        name    : 'confirm',
        message : answ => `confluence config: \n${JSON.stringify(answ, null, 4)}\nis everything correct?`
    }
];

const PROFILE_QUESTIONS = (currentConfig, context) => [
    {
        type    : 'input',
        name    : 'profile',
        default : 'default',
        message : 'Name your profile'
    },
    {
        type    : 'confirm',
        name    : 'confirm',
        message : answers => `${JSON.stringify(buildConfig(answers), null, 4)}\nIs everything correct?`
    }
];

function getDefaultProfile(config, scope) {
    return Object.keys(config).find(key => config[key][scope] && config[key][scope].isDefault);
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

async function loadConfig() {
    return fs.readJSON(configPath).catch(async () => {
        await fs.ensureDir(path.dirname(configPath));
        console.log(`No current config found in ${configPath}`);

        return {};
    });
}

async function untilConfirm(q) {
    const { confirm, ...res } = await inquirer.prompt(q);

    if (confirm) return res;

    return untilConfirm(q);
}

async function init() {
    const currentConfig = await loadConfig();
    const context = {};
    const credentials = await untilConfirm(CREDENTIALS_QUESTIONS(context));
    const jira = await untilConfirm(JIRA_QUESTIONS(currentConfig, credentials));

    console.log('jira: ', jira);

    console.log('credentials: ', credentials);

    // const { profile, confirm, token, ...answers } = await inquirer.prompt(questions(currentConfig));

    // if (confirm) {
    //     const profileConfig = buildConfig(answers);

    //     Object.keys(profileConfig.defaults).forEach(key => {
    //         const isDefault = profileConfig.defaults[key];

    //         if (isDefault) {
    //             const currentDefault = getDefaultProfile(currentConfig, key);

    //             if (currentDefault) {
    //                 currentConfig[currentDefault].default[key] = false;
    //             }
    //         }
    //     });
    //     currentConfig[profile] = { ...profileConfig, token, _version: packageInfo.version };
    //     await fs.writeJSON(configPath, currentConfig);
    //     console.log(`Profile ${profile} saved`);
    // } else {
    //     console.log(`Cancelled profile ${profile} creation`);
    // }
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
