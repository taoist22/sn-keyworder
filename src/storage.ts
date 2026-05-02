import {PluginFileAPI, PluginNoteAPI, FileUtils} from 'sn-plugin-lib';

export type Keyword = {
  id: string;
  label: string;
  pinned: boolean;
};

const SIDELOAD_PATH = 'file:///storage/emulated/0/MyStyle/SnKeyworder/keywords.json';
const STORAGE_DIR = '/MyStyle/SnKeyworder';
const STORAGE_FILENAME = 'storage.note';
const STORAGE_PREFIX = 'KW_DATA:';

type ApiRes<T> = {
  success: boolean;
  result?: T;
  error?: {message?: string};
};

async function getStoragePath(): Promise<string> {
  try {
    const exists = await FileUtils.exists(STORAGE_DIR);
    if (!exists) {
      await FileUtils.makeDir(STORAGE_DIR);
    }
  } catch (e) {
    console.error('[Storage] Directory check failed', e);
  }
  return STORAGE_DIR + '/' + STORAGE_FILENAME;
}

async function ensureStorageNote(path: string): Promise<void> {
  try {
    const res = (await PluginFileAPI.getNoteTotalPageNum(path)) as ApiRes<number>;
    if (res?.success && res.result && res.result > 0) {
      return;
    }
    await PluginFileAPI.createNote({
      notePath: path,
      template: 'none',
      mode: 0,
      isPortrait: true,
    });
  } catch (e) {
    console.error('[Storage] ensureStorageNote failed', e);
  }
}

export async function loadKeywords(): Promise<Keyword[]> {
  try {
    const response = await fetch(SIDELOAD_PATH);
    // file:// URLs on Android return status 0, not 200 — parse regardless
    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }
    const keywords: Keyword[] = data.map((item: any) => {
      if (typeof item === 'string') {
        return {id: makeId(), label: item, pinned: false};
      }
      return item;
    });
    console.log('[Storage] Loaded', keywords.length, 'keywords');
    return keywords;
  } catch (e) {
    console.log('[Storage] Load failed:', e);
    return [];
  }
}

export async function saveKeywords(keywords: Keyword[]): Promise<void> {
  try {
    const path = await getStoragePath();
    await ensureStorageNote(path);

    const dataStr = STORAGE_PREFIX + JSON.stringify(keywords);
    await PluginFileAPI.clearLayerElements(path, 0, 0);
    const insertRes = (await PluginFileAPI.insertElements(path, 0, [
      {
        type: 500,
        layerNum: 0,
        pageNum: 0,
        textBox: {
          textContentFull: dataStr,
          textRect: {left: 0, top: 0, right: 200, bottom: 40},
          fontSize: 10,
          textBold: 0,
          textItalics: 0,
          textAlign: 0,
          textEditable: 0,
        },
      },
    ])) as ApiRes<boolean>;

    if (!insertRes?.success) {
      console.error('[Storage] insertElements failed:', insertRes?.error?.message);
    }

    try {
      await PluginNoteAPI.saveCurrentNote();
    } catch {
      // ignore
    }
  } catch (e) {
    console.error('[Storage] Save failed', e);
  }
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
