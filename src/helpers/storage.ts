import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

import { getFoundationConfig } from '../config';

export function getCdnUrlForId(id: string) {
    const cdnUrl = getFoundationConfig().env.CDN_URL;
    return `${cdnUrl}/${id.substring(0, 2)}/${id.substring(2, 4)}/${id.substring(4, 6)}/${id}`;
}

export async function getUriForCacheItem(name: string) {
    const fileUri = FileSystem.cacheDirectory + name;
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) return fileInfo.uri;
    return null;
}

export async function getCacheUriForBlob(name: string, blob: Blob) {
    const fileUri = FileSystem.cacheDirectory + name;
    const reader = new Response(blob);
    const arrayBuffer = await reader.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const file = new File(fileUri);
    file.write(uint8Array, {});

    return fileUri;
}
