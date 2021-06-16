import { assert } from 'chai';
import Test from '../Test';
import { CLITester, getApiCalls, load } from '../utils';

const cliRunner = load('bin/confluence').default;
const factory = new Test();

suite('cli confluence listPages');

before(async function () {
    await factory.setConfluenceDefault();
});

test('Confluence list pages for default space', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        cliRunner([ 'pages', 'space-a' ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.lengthOf(apiCalls, 2);
    const [ first, ending ] = apiCalls;

    assert.equal(first.method, 'GET');
    assert.equal(first.url, '/wiki/rest/api/space/space-a/content');
    assert.deepOwnInclude(first.params, { start: 0 });

    assert.equal(ending.method, 'GET');
    assert.equal(ending.url, '/wiki/rest/api/space/space-a/content');
    assert.deepOwnInclude(ending.params, { start: 10 });

    assert.match(output, /539689084.* Olive Jefferson/);
    assert.match(output, /539689091.* Meeting notes/);
    assert.match(output, /539689093.* Retrospectives/);
});

after(async function () {
    await factory.cleanTmpFolder();
});
