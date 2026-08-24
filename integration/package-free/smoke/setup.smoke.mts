import { expect, smoke } from 'smoque';

smoke.suite('setup-smoque package-free consumer', async (t) => {
    await t.step('loads a typed smoke file without local package metadata', async () => {
        const message: string = 'package-free TypeScript smoke';

        expect.value(message).toContain('TypeScript');
    });
});
