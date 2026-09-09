import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Pressable, Text} from 'react-native';
import ConfigPanel from '../ConfigPanel';
import {Keyword, KeywordGroup} from '../storage';

jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('../pluginPermissions', () => ({
  requireFileReadPermission: jest.fn(),
}));

it('group Undo restores memberships without reverting subsequent keyword edits or additions', async () => {
  jest.useFakeTimers();
  let keywords: Keyword[] = [
    {id: 'a', label: 'Decision', groups: ['Work', 'Ideas'], pinned: false},
  ];
  let groups: KeywordGroup[] = [{id: 'work', name: 'Work'}];
  let tree: TestRenderer.ReactTestRenderer;
  const render = () => (
    <ConfigPanel
      keywords={keywords}
      groups={groups}
      onUpdate={async next => {
        keywords = next;
        tree.update(render());
      }}
      onUpdateGroups={async next => {
        groups = next;
        tree.update(render());
      }}
      onBack={() => {}}
    />
  );
  act(() => {
    tree = TestRenderer.create(render());
  });
  const press = async (label: string) => {
    const button = tree.root
      .findAllByType(Pressable)
      .find(node =>
        node.findAllByType(Text).some(text => text.props.children === label),
      );
    expect(button).toBeDefined();
    await act(async () => {
      await button!.props.onPress();
    });
  };
  try {
    await press('Groups');
    await press('✕');
    expect(keywords[0].groups).toEqual(['Ideas']);
    keywords = [
      {...keywords[0], label: 'Edited', pinned: true, groups: ['Personal']},
      {id: 'b', label: 'New', pinned: false, groups: []},
    ];
    // Recreating the group during the undo window must not duplicate it.
    groups = [{id: 'replacement', name: 'Work'}];
    act(() => tree.update(render()));
    await press('Undo');
    expect(keywords).toEqual([
      {id: 'a', label: 'Edited', pinned: true, groups: ['Personal', 'Work']},
      {id: 'b', label: 'New', pinned: false, groups: []},
    ]);
    expect(groups).toEqual([{id: 'replacement', name: 'Work'}]);
  } finally {
    act(() => tree.unmount());
    jest.useRealTimers();
  }
});
