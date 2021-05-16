import path from 'path';

const isBuild = process.env.BUILD && [ '1', 'true' ].includes(process.env.BUILD);
const entry = process.env.ENTRY && path.resolve(process.env.ENTRY)
|| isBuild && path.resolve(__dirname, '../lib')
|| path.resolve(__dirname, '../src');

const tmpFolder = path.join(__dirname, '../tmp/tests');
const configPath = process.env.ATLASSIAN_CONFIG_PATH;
const logsPath = path.join(tmpFolder, 'test.log');


const testsRootFolder = __dirname;

export {
    tmpFolder,
    configPath,
    logsPath,
    entry,
    testsRootFolder
};
