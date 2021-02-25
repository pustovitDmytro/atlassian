import path from 'path';

const tmpFolder = path.join(__dirname, '../tmp/tests');
const configPath = process.env.ATLASSIAN_CONFIG_PATH;

export {
    tmpFolder,
    configPath
};
