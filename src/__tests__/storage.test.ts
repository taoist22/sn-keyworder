jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import {
  keywordValue,
  mergeGroupNames,
  normalizeGroups,
  normalizeKey,
} from '../storage';

describe('keyword storage normalization', () => {
  it('normalizes structured keys without changing readable labels', () => {
    expect(normalizeKey(' Project Alpha ')).toBe('Project_Alpha');
    expect(keywordValue({key: 'Project Alpha', label: 'Decision'})).toBe(
      'Project_Alpha:Decision',
    );
  });

  it('deduplicates groups case-insensitively', () => {
    expect(normalizeGroups(['Work, personal', 'work'])).toEqual([
      'Work',
      'personal',
    ]);
  });

  it('preserves saved group ids while discovering keyword groups', () => {
    const merged = mergeGroupNames(
      [{id: 'saved', name: 'Work'}],
      [
        {
          id: 'keyword',
          label: 'Decision',
          pinned: false,
          groups: ['work', 'Ideas'],
        },
      ],
    );
    expect(merged.find(group => group.name === 'Work')?.id).toBe('saved');
    expect(merged.map(group => group.name)).toEqual(['Ideas', 'Work']);
  });
});
