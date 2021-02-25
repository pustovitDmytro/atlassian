
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import Api from '../AtlassianApi';

const homedir = os.homedir();
const defaultConfigPath = path.join(homedir, '.atlassian');

export const configPath = process.env.ATLASSIAN_CONFIG_PATH || defaultConfigPath;

export function errorFormatter(error) {
    if (error.isAxiosError) {
        const json = error.toJSON();

        if (json.data) throw JSON.stringify(json.data);

        throw json.message;
    }
    throw error;
}


export function getDefaultProfile(config, scope) {
    return Object.keys(config).find(key => config[key][scope]?.isDefault);
}

export async function loadConfig() {
    return fs.readJSON(configPath).catch(async () => {
        await fs.ensureDir(path.dirname(configPath));

        return {};
    });
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


export async function untilConfirm(q) {
    const { confirm, ...res } = await inquirer.prompt(q);

    if (confirm !== false) return res;

    return untilConfirm(q);
}
