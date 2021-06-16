import { assert } from 'chai';
import Test from '../Test';
import { CLITester, getApiCalls, load } from '../utils';

const cliRunner = load('bin/confluence').default;
const factory = new Test();

suite('cli confluence exportPage');

before(async function () {
    await factory.setConfluenceDefault();
});

test('Confluence export page as pdf', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(0, 1000),
        cliRunner([ 'export', 'page-1' ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.lengthOf(apiCalls, 4);
    assert.lengthOf(apiCalls.filter(a => a.url.includes('longtask')), 2);
    assert.match(output, /written to.*pdf/);
    // TODO: compare files
});

after(async function () {
    await factory.cleanTmpFolder();
});
