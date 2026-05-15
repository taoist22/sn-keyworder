import AsyncStorage from '@react-native-async-storage/async-storage';

export type Keyword = {
  id: string;
  label: string;
  pinned: boolean;
};

const STORAGE_KEY = 'sn_keyworder_keywords';

export async function loadKeywords(): Promise<Keyword[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (e) {
    console.error('[Storage] Load failed:', e);
    return [];
  }
}

export async function saveKeywords(keywords: Keyword[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keywords));
  } catch (e) {
    console.error('[Storage] Save failed:', e);
  }
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
