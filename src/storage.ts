// In-memory storage — keywords persist for the session but reset when the
// plugin is next opened. Persistent storage will be addressed in a follow-up
// using Supernote's note-based file APIs (no AsyncStorage in PluginHost).

export type Keyword = {
  id: string;
  label: string;
  pinned: boolean;
};

let _store: Keyword[] = [];

export async function loadKeywords(): Promise<Keyword[]> {
  return [..._store];
}

export async function saveKeywords(keywords: Keyword[]): Promise<void> {
  _store = [...keywords];
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
