/* eslint-disable import/no-commonjs */
const { Module } = require('module');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

function clearRequireCache() {
    for (const key of Object.keys(require.cache)) {
        delete require.cache[key];
    }
}

function isPathInside(childPath, parentPath) {
    const relation = path.relative(parentPath, childPath);

    return Boolean(
        relation &&
		relation !== '..' &&
		!relation.startsWith(`..${path.sep}`) &&
		relation !== path.resolve(childPath)
    );
}

const ROOT_FOLDER = process.cwd();

function preventParentScopeModules() {
    const nodeModulePaths = Module._nodeModulePaths;

    Module._nodeModulePaths = function (from) {
        const originalPath = nodeModulePaths.call(this, from);


        return originalPath.filter(function (p) {
            return isPathInside(p, ROOT_FOLDER);
        });
    };
}

function loadEnv() {
    dotenv.config({
        path : path.join(__dirname, './test.env')
    });
}

if (process.platform === 'win32') {
    const rl = readline.createInterface({
        input  : process.stdin,
        output : process.stdout
    });

    rl.on('SIGINT', function () {
        console.log('readline SIGINT catched');

        process.emit('SIGINT');
    });
}

[ 'SIGINT', 'exit' ].forEach(signal => {
    process.on(signal, function (code) {
        console.log(`${signal} catched, code:`, code);
        // eslint-disable-next-line no-process-exit
        process.exit(code);
    });
});

clearRequireCache();
preventParentScopeModules();
loadEnv();
