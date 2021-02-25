import { pause } from 'myrmidon';
import mockStdin from  'mock-stdin';
import { stdout } from 'test-console';
import { assert } from 'chai';

export class CLITester {
    constructor(dialog, factory) {
        this.dialog = dialog;
        this.stdin = mockStdin.stdin();
        this.factory = factory;
    }

    async test(index = 0) {
        if (index === this.dialog.length) return this.stdin.restore();
        const inspect = stdout.inspect();
        const item = this.dialog[index];

        await pause(100);

        inspect.restore();
        this.stdin.send([ item.input, null ]);
        const out = inspect.output.join('\n');

        this.factory.logger.log('info', { item, out });
        assert.match(out, new RegExp(item.output), JSON.stringify(item));
        await this.test(index + 1);
    }
}
