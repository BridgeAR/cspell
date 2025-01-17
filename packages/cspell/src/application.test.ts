import type { Issue } from '@cspell/cspell-types';
import * as path from 'path';
import * as App from './application';
import { CSpellApplicationOptions } from './options';
import { InMemoryReporter } from './util/InMemoryReporter';

const getStdinResult = {
    value: '',
};

const samplesRoot = path.resolve(__dirname, '../samples');

const sampleOptions = { root: samplesRoot };

jest.mock('get-stdin', () => {
    return jest.fn(() => Promise.resolve(getStdinResult.value));
});

describe('Validate the Application', () => {
    jest.setTimeout(10000); // make sure we have enough time on Travis.

    test('Tests running the application', () => {
        const files = ['text.txt'];
        const options = sampleOptions;
        const reporter = new InMemoryReporter();
        const lint = App.lint(files, options, reporter);
        return lint.then((result) => {
            expect(reporter.errorCount).toBe(0);
            expect(reporter.infoCount).toBeGreaterThan(0);
            expect(reporter.debugCount).toBeGreaterThan(0);
            expect(reporter.runResult).toEqual(result);
            expect(result.files).toBe(1);
            return;
        });
    });

    test('Tests running the application verbose', () => {
        const files = ['text.txt'];
        const options = { ...sampleOptions, verbose: true };
        const reporter = new InMemoryReporter();
        const lint = App.lint(files, options, reporter);
        return lint.then((result) => {
            expect(reporter.errorCount).toBe(0);
            expect(reporter.infoCount).toBeGreaterThan(0);
            expect(reporter.debugCount).toBeGreaterThan(0);
            expect(reporter.runResult).toEqual(result);
            expect(result.files).toBe(1);
            return;
        });
    });

    test('Tests running the application words only', () => {
        const files = ['text.txt'];
        const options = { ...sampleOptions, wordsOnly: true, unique: true };
        const reporter = new InMemoryReporter();
        const lint = App.lint(files, options, reporter);
        return lint.then((result) => {
            expect(reporter.errorCount).toBe(0);
            expect(reporter.infoCount).toBeGreaterThan(0);
            expect(reporter.debugCount).toBeGreaterThan(0);
            expect(reporter.runResult).toEqual(result);
            expect(result.files).toBe(1);
            return;
        });
    });

    test('Tests running the trace command', async () => {
        const result = await App.trace(['apple'], {});
        expect(result.length).toBeGreaterThan(2);

        const foundIn = result.filter((r) => r.found);
        expect(foundIn).toContainEqual(
            expect.objectContaining({
                dictName: 'en_us',
                dictSource: expect.stringContaining('en_US.trie.gz'),
            })
        );
        expect(foundIn.map((d) => d.dictName)).toEqual(expect.arrayContaining(['en-gb', 'en_us', 'companies']));
    });

    test('Tests running the trace command with missing dictionary', async () => {
        const result = await App.trace(['apple'], { config: 'samples/cspell-missing-dict.json' });
        expect(result.length).toBeGreaterThan(2);
        expect(result).toContainEqual(
            expect.objectContaining({
                dictName: 'missing-dictionary',
                dictSource: expect.stringContaining('missing.txt'),
            })
        );
        const errors = result.filter((r) => r.errors).map((r) => r.errors);
        expect(errors).toContainEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: expect.stringContaining('failed to load'),
                }),
            ])
        );
    });

    test('Tests checkText', async () => {
        const result = await App.checkText('samples/latex/sample2.tex', {});
        expect(result.items.length).toBeGreaterThan(50);
        expect(result.items.map((i) => i.text).join('')).toBe(result.text);
    });

    test('running the application from stdin', async () => {
        const files = ['stdin'];
        const options = { ...sampleOptions, wordsOnly: true, unique: true };
        const reporter = new InMemoryReporter();
        // cspell:ignore texxt
        getStdinResult.value = `
            This is some texxt to test out reding from stdin.
            cspell:ignore badspellingintext
            We can ignore values within the text: badspellingintext
        `;
        const lint = App.lint(files, options, reporter);
        const result = await lint;
        expect(result.files).toBe(1);
        expect(reporter.errorCount).toBe(0);
        expect(reporter.infoCount).toBeGreaterThan(0);
        expect(reporter.debugCount).toBeGreaterThan(0);
        expect(reporter.issues.map((i) => i.text)).toEqual(['texxt']);
        expect(reporter.runResult).toEqual(result);
    });
});

describe('Validate createInit', () => {
    test('createInit', async () => {
        async function worked() {
            try {
                await App.createInit();
            } catch (e) {
                return false;
            }
            return true;
        }
        expect(await worked()).toBe(false);
    });
});

describe('Application, Validate Samples', () => {
    function iMap(issue: string | Partial<Issue>): Partial<Issue> {
        return expect.objectContaining(typeof issue === 'string' ? { text: issue } : issue);
    }

    sampleTests().map((sample) =>
        test(`Test file: "${sample.file}"`, async () => {
            const reporter = new InMemoryReporter();
            const root = path.resolve(path.dirname(sample.file));
            const { file, issues, options: sampleOptions = {} } = sample;
            const options = {
                root,
                ...sampleOptions,
            };

            const result = await App.lint([path.resolve(file)], options, reporter);
            expect(result.files).toBe(1);
            expect(reporter.issues).toEqual(issues.map(iMap));
            expect(result.issues).toBe(issues.length);
            expect(reporter.runResult).toEqual(result);
        })
    );
});

interface SampleTest {
    file: string;
    issues: (string | Partial<Issue>)[];
    options?: CSpellApplicationOptions;
}

function sampleTests(): SampleTest[] {
    // cspell:disable
    return [
        {
            file: path.resolve(path.join(__dirname, '../samples/src/drives.ps1')),
            issues: ['Woude', 'Woude'],
        },
        {
            file: path.resolve(path.join(__dirname, '../../cspell-lib/samples/src/drives.ps1')),
            issues: ['Woude', 'Woude'],
        },
        { file: 'samples/src/drives.ps1', issues: ['Woude', 'Woude'] },
        { file: 'samples/src/sample.c', issues: [] },
        {
            file: 'samples/src/sample.go',
            options: { showSuggestions: true, showContext: true },
            issues: [
                {
                    text: 'garbbage',
                    suggestions: expect.arrayContaining(['garbage', 'garage']),
                    context: expect.objectContaining({ text: 'Deliberate misspelling: garbbage. */' }),
                },
            ],
        },
        { file: 'samples/src/sample.py', issues: ['garbbage'] },
        {
            file: 'samples/src/sample.tex',
            issues: ['includegraphics', 'Zotero'],
        },
        {
            file: path.resolve(path.join(__dirname, '../samples/src/drives.ps1')),
            issues: ['Woude', 'Woude'],
        },
        {
            file: path.resolve(path.join(__dirname, '../../cspell-lib/samples/src/drives.ps1')),
            issues: ['Woude', 'Woude'],
        },
    ];
    // cspell:enable
}
