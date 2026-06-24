import AsyncStorage from '@react-native-async-storage/async-storage';

export type Keyword = {
  id: string;
  label: string;
  pinned: boolean;
  key?: string;
};

const STORAGE_KEY = 'sn_keyworder_keywords';

export function normalizeKey(
  key: string | undefined | null,
): string | undefined {
  const cleaned = (key ?? '')
    .trim()
    .replace(/:+/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function keywordValue(keyword: Pick<Keyword, 'label' | 'key'>): string {
  const key = normalizeKey(keyword.key);
  return key ? `${key}:${keyword.label}` : keyword.label;
}

export function keywordSignature(
  keyword: Pick<Keyword, 'label' | 'key'>,
): string {
  return keywordValue(keyword).toLowerCase();
}

function normalizeKeyword(item: any): Keyword | null {
  const label = typeof item?.label === 'string' ? item.label.trim() : '';
  if (!label) {
    return null;
  }
  return {
    id: typeof item.id === 'string' && item.id ? item.id : makeId(),
    label,
    pinned: Boolean(item.pinned),
    key: normalizeKey(item.key),
  };
}

export async function loadKeywords(): Promise<Keyword[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(normalizeKeyword).filter(Boolean) as Keyword[];
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
    throw e;
  }
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
