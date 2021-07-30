
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import Api from '../api/AtlassianApi';
import cliLogger from './logger';

const homedir = os.homedir();
const defaultConfigPath = path.join(homedir, '.atlassian');

export const configPath = process.env.ATLASSIAN_CONFIG_PATH || defaultConfigPath;

export function getDefaultProfile(config, scope) {
    return Object.keys(config).find(key => config[key][scope]?.isDefault);
}

export async function loadConfig() {
    try {
        return await fs.readJSON(configPath);
    } catch  {
        await fs.ensureDir(path.dirname(configPath));

        return {};
    }
}

export async function loadProfile(scope, name) {
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

export function installLogger(logger, { logLevel, verbose, debug }) {
    const level = logLevel || verbose && 'verbose' || debug && 'debug';

    // eslint-disable-next-line no-param-reassign
    if (level) logger.level = level;
}


export async function untilConfirm(q) {
    const { confirm, ...res } = await inquirer.prompt(q);

    if (confirm !== false) return res;

    return untilConfirm(q);
}

export function getCLIRunner({ isMain, profile }) {
    function onError(e) {
        cliLogger.error(e.toString());
        cliLogger.verbose(e.stack);
        if (isMain) process.exit(1);

        throw e;
    }

    return function cliCommand(method, { noLoadProfile } = {}) {
        return async function (args) {
            try {
                installLogger(cliLogger, args);
                const profileConf = noLoadProfile
                    ? null
                    : await loadProfile(profile, args.profile);

                await method(args, profileConf);
            } catch (error) {
                onError(error);
            }
        };
    };
}

export const commonYargsOpts = y => y
    .option('verbose', {
        describe : 'verbose logs',
        alias    : [ 'v' ],
        type     : 'boolean'
    })
    .option('debug', {
        describe : 'debug logs',
        type     : 'boolean'
    })
    .option('profile', {
        alias    : [ 'p' ],
        describe : 'specify profile name',
        type     : 'string'
    });

export const minTerminalWidth =  95;
export const commonCommandArgs = '[--verbose] [--debug] [--profile=<profile>]';

export function getYargsFail(isMain, logger) {
    return function onYargsFail(message, error, ygs) {
        const failMessage = message || error;

        ygs.showHelp('error');
        if (failMessage) {
            console.log();
            logger.error(failMessage.toString());
            logger.verbose(error?.stack);
        }

        if (!isMain) throw (failMessage);
        process.exit(1);
    };
}

