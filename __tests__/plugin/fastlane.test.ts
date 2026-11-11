const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
    renderAndroidFastlane,
    renderIosFastlane,
    rubyString,
    withFastlane,
    writeFastlaneDirectory,
} = require('../../plugin/fastlane');

const PLUGIN = '@zyno-io/mobile-foundation-rn/fastlane';
const LABEL = 'resources/native/ios/fastlane';

const appIos = (extra: any = {}) => ({
    projectName: 'Example',
    bundleIdentifier: 'com.example.app-dev',
    appleTeamId: 'ABCDE12345',
    extensionTargets: [],
    matchAppIdentifiers: {
        development: ['com.example.app-alpha'],
        appstore: ['com.example.app-uat', 'com.example.app'],
    },
    sourceLabel: LABEL,
    ...extra,
});
const byName = (files: any[], name: string) => files.find((f) => f.name === name);

describe('renderIosFastlane', () => {
    it('renders a single-target set of files', () => {
        const files = renderIosFastlane(appIos());
        const all = files.map((f: any) => f.contents).join('\n');
        const fastfile = byName(files, 'Fastfile').contents;
        expect(fastfile).toContain('XCODE_PROJECT = "Example"');
        expect(fastfile).toContain('EXTENSION_TARGETS = [].freeze');
        expect(byName(files, 'Appfile').contents).toContain('team_id("ABCDE12345")');
        expect(all).not.toContain('apple_id');
        expect(all).not.toContain('itc_team_id');
        expect(all).not.toContain('print(ENV)');
        expect(all).not.toContain('{{');
        expect(fastfile.endsWith('end\n')).toBe(true);
        expect(fastfile.endsWith('\n\n')).toBe(false);
    });

    it('renders the Matchfile with and without matchGitUrl', () => {
        const withUrl = byName(
            renderIosFastlane(appIos({ matchGitUrl: 'git@git.example.com:team/fastlane.git' })),
            'Matchfile',
        ).contents;
        expect(withUrl).toContain('git_url("git@git.example.com:team/fastlane.git")');

        const files = renderIosFastlane(appIos());
        const without = byName(files, 'Matchfile').contents;
        expect(without).not.toContain('git_url(');
        expect(without).toContain('git_url is unset');
        for (const f of files) expect(f.contents).not.toContain(['s24', 'dev'].join('.'));
    });

    it('no longer renders update-match.sh and comments a missing team id', () => {
        const files = renderIosFastlane(appIos({ appleTeamId: undefined }));
        expect(files.map((f: any) => f.name)).toEqual(['Appfile', 'Fastfile', 'Matchfile', '.gitignore']);
        expect(byName(files, 'Appfile').contents).toContain('# team_id is unset');
        expect(byName(files, 'Appfile').contents).not.toContain('team_id(');
    });

    it('appends lanes from Fastfile.append', () => {
        const files = renderIosFastlane(appIos({ append: 'override_lane :build do |o|\nend\n' }));
        const fastfile = byName(files, 'Fastfile').contents;
        expect(fastfile).toContain(`# Appended from ${LABEL}/Fastfile.append\noverride_lane :build`);
        expect(fastfile.endsWith('end\n')).toBe(true);
    });
});

describe('renderAndroidFastlane', () => {
    it('renders the BUNDLE_IDENTIFIER_ANDROID fallback', () => {
        const files = renderAndroidFastlane({ packageName: 'app.example.test', sourceLabel: 'resources/native/android/fastlane' });
        expect(byName(files, 'Appfile').contents).toContain('package_name(ENV["BUNDLE_IDENTIFIER_ANDROID"] || "app.example.test")');
        expect(byName(files, 'Fastfile').contents).toContain('lane :deploy');
        expect(files.map((f: any) => f.name)).toEqual(['Appfile', 'Fastfile', '.gitignore']);
    });
});

describe('rubyString', () => {
    it('escapes backslashes, quotes and interpolation', () => {
        expect(rubyString('a"b#{x}\\')).toBe('"a\\"b\\#{x}\\\\"');
    });
});

describe('writeFastlaneDirectory', () => {
    let root: string;
    let out: string;
    let src: string;
    let warn: jest.SpyInstance;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'fastlane-'));
        out = path.join(root, 'ios/fastlane');
        src = path.join(root, LABEL);
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        warn.mockRestore();
        fs.rmSync(root, { recursive: true, force: true });
    });

    const sourceDir = () => ({ dir: fs.existsSync(src) ? src : null, label: LABEL });
    const run = (extra: any = {}) => {
        const source = sourceDir();
        const files = renderIosFastlane(
            appIos({ append: source.dir && fs.existsSync(path.join(src, 'Fastfile.append')) ? fs.readFileSync(path.join(src, 'Fastfile.append'), 'utf8') : undefined, ...extra }),
        );
        writeFastlaneDirectory({ platform: 'ios', outputDir: out, source, files });
    };
    const tree = () =>
        Object.fromEntries(
            fs.readdirSync(out).sort().map((n: string) => [n, fs.readFileSync(path.join(out, n), 'utf8')]),
        );

    it('writes files with modes and a .gitignore', () => {
        run();
        expect(fs.existsSync(path.join(out, 'update-match.sh'))).toBe(false);
        expect(fs.statSync(path.join(out, 'Fastfile')).mode & 0o777).toBe(0o644);
        expect(fs.readFileSync(path.join(out, '.gitignore'), 'utf8')).toContain('asc-api-key.json');
    });

    it('lets an override replace a generated file and warns', () => {
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(path.join(src, 'Matchfile'), '# custom\n');
        run();
        expect(fs.readFileSync(path.join(out, 'Matchfile'), 'utf8')).toBe('# custom\n');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(`fastlane/Matchfile comes from ${LABEL}/Matchfile instead of the foundation template`));
    });

    it('copies extra files, appends Fastfile.append and does not copy it', () => {
        fs.mkdirSync(path.join(src, 'actions'), { recursive: true });
        fs.writeFileSync(path.join(src, 'actions/custom.rb'), 'x');
        fs.writeFileSync(path.join(src, 'Fastfile.append'), 'lane :extra do\nend\n');
        fs.writeFileSync(path.join(src, '.DS_Store'), 'junk');
        run();
        expect(fs.existsSync(path.join(out, 'actions/custom.rb'))).toBe(true);
        expect(fs.existsSync(path.join(out, 'Fastfile.append'))).toBe(false);
        expect(fs.existsSync(path.join(out, '.DS_Store'))).toBe(false);
        expect(fs.readFileSync(path.join(out, 'Fastfile'), 'utf8')).toContain('lane :extra do');
    });

    it('throws when both Fastfile and Fastfile.append exist', () => {
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(path.join(src, 'Fastfile'), '');
        fs.writeFileSync(path.join(src, 'Fastfile.append'), '');
        expect(() => run()).toThrow(
            `found both Fastfile and Fastfile.append in ${LABEL}; use Fastfile.append to extend the generated Fastfile or Fastfile to replace it, not both`,
        );
    });

    it('removes a legacy marked update-match.sh but keeps an unmarked one', () => {
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'update-match.sh'), '#!/bin/sh\n# Generated by @zyno-io/mobile-foundation-rn during `expo prebuild`. Do not edit.\n');
        run();
        expect(fs.existsSync(path.join(out, 'update-match.sh'))).toBe(false);

        fs.writeFileSync(path.join(out, 'update-match.sh'), '#!/bin/sh\necho mine\n');
        run();
        expect(fs.readFileSync(path.join(out, 'update-match.sh'), 'utf8')).toContain('echo mine');
    });

    it('warns when replacing an unmarked file that foundation did not generate', () => {
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'Appfile'), 'app_identifier("x")\n');
        run();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Replaced ios/fastlane/Appfile, which foundation did not generate'));
    });

    it('produces an identical tree on a second run', () => {
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(path.join(src, 'Fastfile.append'), 'lane :extra do\nend\n');
        run();
        const first = tree();
        run();
        expect(tree()).toEqual(first);
    });
});

describe('option validation', () => {
    const make = (raw: any) => withFastlane({ name: 'T', slug: 't' }, raw);

    it.each([
        [{ ios: { appleTeamId: 'abc' } }],
        [{ ios: { bundleIdentifier: 'nodots' } }],
        [{ ios: { extensionTargets: ['a', 'a'] } }],
        [{ ios: { extensionTargets: ['bad target'] } }],
        [{ ios: { matchGitUrl: '' } }],
        [{ ios: { matchGitUrl: 'git@host:a b.git' } }],
        [{ ios: { matchAppIdentifiers: { nope: ['a.b'] } } }],
        [{ ios: { matchAppIdentifiers: { appstore: ['bad id'] } } }],
        [{ ios: { sourceDir: '' } }],
        [{ ios: { unknown: 1 } }],
        [{ android: { packageName: '1bad.name' } }],
        [{ android: { sourceDir: 'a\nb' } }],
        [{ unknown: true }],
        ['yes'],
    ])('rejects %j', (raw) => {
        expect(() => make(raw)).toThrow(PLUGIN);
    });

    it('registers no mods when disabled', () => {
        expect(withFastlane({ name: 'T', slug: 't' }, false).mods).toBeUndefined();
    });

    it('registers per-platform mods otherwise', () => {
        const config = make(undefined);
        expect(config.mods.ios.dangerous).toBeDefined();
        expect(config.mods.android.dangerous).toBeDefined();
        const iosOnly = make({ android: false });
        expect(iosOnly.mods.android).toBeUndefined();
    });
});

const hasRuby = spawnSync('ruby', ['-v']).status === 0;
const rubyIt = hasRuby ? it : it.skip;

describe('Ruby syntax', () => {
    const check = (contents: string) => {
        const result = spawnSync('ruby', ['-c'], { input: contents, encoding: 'utf8' });
        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
    };

    rubyIt('renders valid Ruby with and without matchGitUrl', () => {
        for (const extra of [{}, { matchGitUrl: 'git@git.example.com:team/certs.git', extensionTargets: ['Ext'], append: 'lane :x do\nend\n' }]) {
            for (const f of renderIosFastlane(appIos(extra))) {
                if (f.name === 'Appfile' || f.name === 'Fastfile' || f.name === 'Matchfile') check(f.contents);
            }
        }
        for (const f of renderAndroidFastlane({ packageName: 'app.example.test', sourceLabel: 'x' })) {
            if (f.name !== '.gitignore') check(f.contents);
        }
    });
});
