import AsyncStorage from '@react-native-async-storage/async-storage';

export type Keyword = {
  id: string;
  label: string;
  pinned: boolean;
  key?: string;
  groups?: string[];
};

export type KeywordGroup = {
  id: string;
  name: string;
};

const STORAGE_KEY = 'sn_keyworder_keywords';
const GROUP_STORAGE_KEY = 'sn_keyworder_groups';

export function normalizeKey(
  key: string | undefined | null,
): string | undefined {
  const cleaned = (key ?? '').trim().replace(/:+/g, '').replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned : undefined;
}

export function normalizeGroups(value: unknown): string[] {
  const rawItems: unknown[] = [];
  const collect = (input: unknown) => {
    if (Array.isArray(input)) {
      input.forEach(collect);
      return;
    }
    if (typeof input === 'string') {
      input.split(',').forEach(part => rawItems.push(part));
    }
  };
  collect(value);

  const groups: string[] = [];
  for (const item of rawItems) {
    const group = normalizeKey(String(item ?? ''));
    if (
      group &&
      !groups.some(existing => existing.toLowerCase() === group.toLowerCase())
    ) {
      groups.push(group);
    }
  }
  return groups;
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

function normalizeGroup(item: any): KeywordGroup | null {
  const name = normalizeKey(typeof item === 'string' ? item : item?.name);
  if (!name) {
    return null;
  }
  return {
    id: typeof item?.id === 'string' && item.id ? item.id : makeId(),
    name,
  };
}

export function mergeGroupNames(
  savedGroups: KeywordGroup[],
  keywords: Keyword[],
): KeywordGroup[] {
  const byName = new Map<string, KeywordGroup>();
  for (const group of savedGroups) {
    byName.set(group.name.toLowerCase(), group);
  }
  for (const keyword of keywords) {
    for (const groupName of keyword.groups ?? []) {
      const normalized = normalizeKey(groupName);
      if (normalized && !byName.has(normalized.toLowerCase())) {
        byName.set(normalized.toLowerCase(), {id: makeId(), name: normalized});
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
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
    groups: normalizeGroups([
      ...normalizeGroups(item.groups),
      ...normalizeGroups(item.group),
      normalizeKey(item.key),
    ]),
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

export async function loadKeywordGroups(): Promise<KeywordGroup[]> {
  try {
    const raw = await AsyncStorage.getItem(GROUP_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(normalizeGroup).filter(Boolean) as KeywordGroup[];
  } catch (e) {
    console.error('[Storage] Group load failed:', e);
    return [];
  }
}

export async function saveKeywordGroups(groups: KeywordGroup[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    console.error('[Storage] Group save failed:', e);
    throw e;
  }
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
