import { assert } from 'chai';
import Test from '../Test';
import { CLITester, getApiCalls, load } from '../utils';

const jiraRunner = load('bin/jira').default;
const factory = new Test();

suite('cli jira show');

before(async function () {
    await factory.setJIRADefault();
});

test('jira show with comments', async function () {
    const tester = new CLITester([], factory);

    const [ output ] = await Promise.all([
        tester.test(),
        jiraRunner([ 'show', 'A-4', '--comments' ])
    ]);

    const apiCalls = await getApiCalls('type=requestSent');

    assert.lengthOf(apiCalls, 2);
    for (const req of apiCalls) {
        assert.equal(req.method, 'GET');
    }

    assert.exists(apiCalls.find(c => c.url === '/rest/api/3/issue/A-4'));

    assert.include(output, 'Assignee: Lucinda Vasquez (IUiyLR5qVQAAh)');
    assert.include(output, '[file] 5b36655c-60ca-4a26-be48-db0a1c5d2f1d');
    assert.match(output, /Sadie Shelton.* \(voq2ULLho\) 25-03-2021/);
});

after(async function () {
    await factory.cleanTmpFolder();
});
