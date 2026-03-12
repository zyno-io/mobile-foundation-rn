import { getCdnUrlForId, getUriForCacheItem, getCacheUriForBlob } from '../../src/helpers/storage';
import { configureFoundation } from '../../src/config';
import { createMockConfig } from '../test-utils';

// Access the mocked modules via require (virtual modules can't be type-imported)
const FileSystem = require('expo-file-system/legacy');
const { File } = require('expo-file-system/next');

beforeAll(() => {
    configureFoundation(createMockConfig({ env: { CDN_URL: 'https://cdn.example.com' } }));
});

describe('getCdnUrlForId', () => {
    it('constructs CDN URL with nested path from 6-char ID', () => {
        expect(getCdnUrlForId('abcdef')).toBe('https://cdn.example.com/ab/cd/ef/abcdef');
    });

    it('works with longer IDs (uses first 6 chars for path)', () => {
        expect(getCdnUrlForId('abcdefghij')).toBe('https://cdn.example.com/ab/cd/ef/abcdefghij');
    });
});

describe('getUriForCacheItem', () => {
    it('returns URI when file exists', async () => {
        FileSystem.getInfoAsync.mockResolvedValueOnce({
            exists: true,
            uri: 'file:///cache/test-file',
        });

        const result = await getUriForCacheItem('test-file');
        expect(result).toBe('file:///cache/test-file');
    });

    it('returns null when file does not exist', async () => {
        FileSystem.getInfoAsync.mockResolvedValueOnce({
            exists: false,
        });

        const result = await getUriForCacheItem('missing-file');
        expect(result).toBeNull();
    });
});

describe('getCacheUriForBlob', () => {
    it('writes blob to cache dir and returns URI', async () => {
        const blob = new Blob(['hello world']);
        const result = await getCacheUriForBlob('my-file', blob);

        expect(result).toBe('file:///cache/my-file');
        expect(File).toHaveBeenCalledWith('file:///cache/my-file');
    });
});
