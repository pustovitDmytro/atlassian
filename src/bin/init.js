/* eslint-disable no-param-reassign */
import { isString } from 'myrmidon';
import fs from 'fs-extra';
import JIRA from '../Jira';
import packageInfo from '../../package.json';
import { configPath, getDefaultProfile, loadConfig,  untilConfirm } from './utils';

const JSON_PRETTY_OFFSET = 4;

const validate = (required, regexp, msg) => value => {
    if (!value) return 'value is required';
    if (regexp && !regexp.test(value)) return msg;

    return true;
};

async function validateCredentials(token, answers) {
    this.jira = new JIRA({
        host  : answers.host,
        email : answers.email,
        token
    });

    this.myself = await this.jira.getMyself();

    return true;
}

const CREDENTIALS_QUESTIONS = (context) => [
    {
        type     : 'input',
        name     : 'host',
        validate : validate(true, /https?:\/\/(?:www\.)?[\w#%+.:=@\\~-]{1,256}\.[\d()A-Za-z]{1,6}\b[\w#%&()+./:=?@\\~-]*/, 'not a valid host'),
        message  : 'Enter atlassian host:'
    },
    {
        type     : 'input',
        name     : 'email',
        validate : validate(true, /^[\w+.-]+@[\dA-Za-z-]+\.[\d.A-Za-z-]+$/, 'invalid email'),
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
        message : () => `User found:\n${JSON.stringify(context.myself, null, JSON_PRETTY_OFFSET)}\nis this you?`
    }
];

const isMakeDefault = (currentConfig, scope) => ({
    type    : 'confirm',
    name    : 'isDefault',
    when    : answers => !!answers.isUse,
    message : () => {
        const profile = getDefaultProfile(currentConfig, scope);

        return profile
            ? `Profile ${profile} used as default for ${scope} calls, change?`
            : `Make this profile default for ${scope} calls?`;
    }
});

const isUse = (currentConfig, scope) => ({
    type    : 'confirm',
    name    : 'isUse',
    message : `Use this credentials for ${scope} calls?`
});

const JIRA_QUESTIONS = (currentConfig, credentials, context = {}) => [
    isUse(currentConfig, 'jira'),
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
                    // eslint-disable-next-line require-atomic-updates
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
            },
            when : answers => !!answers.isUse
        };
    }),
    {
        type    : 'confirm',
        name    : 'confirm',
        message : answ => answ.isUse
            ? `jira config: \n${JSON.stringify(answ, null, JSON_PRETTY_OFFSET)}\nis everything correct?`
            : 'Are you sure?'
    }
];

const CONFLUENCE_QUESTIONS = (currentConfig) => [
    isUse(currentConfig, 'confluence'),
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


export default async function init() {
    const currentConfig = await loadConfig();
    const context = {};
    const credentials = await untilConfirm(CREDENTIALS_QUESTIONS(context));
    const jira = await untilConfirm(JIRA_QUESTIONS(currentConfig, credentials, context));
    const confluence = await untilConfirm(CONFLUENCE_QUESTIONS(currentConfig));
    const { profile } = await untilConfirm(PROFILE_QUESTIONS(currentConfig));

    const profileConfig = {
        ...credentials,
        jira,
        confluence,
        userId   : context.myself.id,
        _version : packageInfo.version
    };

    for (const key of [ 'jira', 'confluence' ]) {
        const { isDefault } = profileConfig[key];

        if (isDefault) {
            const currentDefault = getDefaultProfile(currentConfig, key);

            if (currentDefault) {
                currentConfig[currentDefault][key].isDefault = false;
            }
        }
    }

    // eslint-disable-next-line require-atomic-updates
    currentConfig[profile] = profileConfig;
    await fs.writeJSON(configPath, currentConfig);
    console.log(`Profile ${profile} saved`);
}
