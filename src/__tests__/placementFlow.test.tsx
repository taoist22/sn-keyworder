import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Pressable} from 'react-native';
import KeywordPanel from '../KeywordPanel';
import PlacementOverlay from '../PlacementOverlay';
import {PluginManager, PluginNoteAPI, PluginFileAPI, PluginCommAPI} from 'sn-plugin-lib';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../pluginRouter', () => ({subscribeToButtonEvents: jest.fn(() => jest.fn())}));
jest.mock('sn-plugin-lib', () => ({
  PluginManager: {closePluginView: jest.fn(), hasPermission: jest.fn(async () => 1), requestPermission: jest.fn(), getDeviceType: jest.fn(async () => 4)},
  PluginCommAPI: {
    getCurrentFilePath: jest.fn(async () => ({success: true, result: '/Note/test.note'})),
    getCurrentPageNum: jest.fn(async () => ({success: true, result: 0})),
    getPageDisplaySize: jest.fn(async () => ({success: true, result: {width: 1404, height: 1872}})),
  },
  PluginNoteAPI: {insertText: jest.fn(async () => ({success: true}))},
  PluginFileAPI: {getKeyWords: jest.fn(async () => ({success: true, result: []})), insertKeyWord: jest.fn(async () => ({success: true}))},
}));
let tree: TestRenderer.ReactTestRenderer;
let insertion: Promise<void>;
async function startBatch() {
  await act(async () => {tree = TestRenderer.create(<KeywordPanel keywords={[
    {id: 'a', label: 'TODO', pinned: false}, {id: 'b', label: 'REVIEW', pinned: false},
  ]} groups={[]} onManage={() => {}} />);});
  const button = (id: string) => tree.root.findAllByType(Pressable).find(n => n.props.testID === id)!;
  await act(async () => {button('keyword-a').props.onPress(); button('keyword-b').props.onPress();});
  await act(async () => {insertion = button('keyword-insert').props.onPress();});
}
beforeEach(async () => {jest.clearAllMocks(); await startBatch();});
afterEach(() => {act(() => tree.unmount());});
it('waits for one tap, then inserts and indexes the whole batch before closing', async () => {
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginManager.closePluginView).not.toHaveBeenCalled();
  await act(async () => {
    tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'placed', point: {x: 300, y: 600}});
    await insertion;
  });
  expect(PluginNoteAPI.insertText).toHaveBeenCalledTimes(2);
  expect(PluginNoteAPI.insertText).toHaveBeenNthCalledWith(1, expect.objectContaining({textContentFull: 'TODO', textRect: expect.objectContaining({left: 300, top: 561})}));
  expect(PluginFileAPI.insertKeyWord).toHaveBeenCalledTimes(2);
  expect((PluginManager.closePluginView as jest.Mock).mock.invocationCallOrder[0]).toBeGreaterThan((PluginFileAPI.insertKeyWord as jest.Mock).mock.invocationCallOrder[1]);
});
it('cancels without inserting or indexing', async () => {
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'cancelled'}); await insertion;});
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginFileAPI.insertKeyWord).not.toHaveBeenCalled();
  expect(PluginManager.closePluginView).toHaveBeenCalledTimes(1);
});
it('refuses insertion when the page changes while waiting', async () => {
  (PluginCommAPI.getCurrentPageNum as jest.Mock).mockResolvedValueOnce({success: true, result: 1});
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'placed', point: {x: 300, y: 600}}); await insertion;});
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginFileAPI.insertKeyWord).not.toHaveBeenCalled();
  expect(PluginManager.closePluginView).not.toHaveBeenCalled();
});
it('preserves index-only insertion in documents without requesting a placement tap', async () => {
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'cancelled'}); await insertion; tree.unmount();});
  jest.clearAllMocks();
  (PluginCommAPI.getCurrentFilePath as jest.Mock).mockResolvedValue({success: true, result: '/Document/test.pdf'});
  await startBatch();
  await act(async () => {await insertion;});
  expect(tree.root.findAllByType(PlacementOverlay)).toHaveLength(0);
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginFileAPI.insertKeyWord).toHaveBeenCalledTimes(2);
  (PluginCommAPI.getCurrentFilePath as jest.Mock).mockResolvedValue({success: true, result: '/Note/test.note'});
});

async function restartWithExisting(labels: string[]) {
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'cancelled'}); await insertion; tree.unmount();});
  jest.clearAllMocks();
  (PluginFileAPI.getKeyWords as jest.Mock).mockResolvedValueOnce({success: true, result: labels.map(keyword => ({keyword, page: 0}))});
  await startBatch();
}
async function chooseDuplicate(choice: string) {
  await act(async () => {tree.root.findAllByType(Pressable).find(n => n.props.testID === `duplicate-${choice}`)!.props.onPress();});
}
async function placeBatch() {
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'placed', point: {x: 300, y: 600}}); await insertion;});
}
it('warns before placement and skips existing labels when requested', async () => {
  await restartWithExisting(['TODO']);
  expect(tree.root.findAllByType(PlacementOverlay)).toHaveLength(0);
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  await chooseDuplicate('skip');
  await placeBatch();
  expect(PluginNoteAPI.insertText).toHaveBeenCalledTimes(1);
  expect(PluginFileAPI.insertKeyWord).toHaveBeenCalledWith('/Note/test.note', 0, 'REVIEW');
  expect(PluginManager.closePluginView).toHaveBeenCalledTimes(1);
});
it('places all labels but only indexes new keywords and closes normally', async () => {
  await restartWithExisting(['TODO']);
  await chooseDuplicate('all');
  await placeBatch();
  expect(PluginNoteAPI.insertText).toHaveBeenCalledTimes(2);
  expect(PluginFileAPI.insertKeyWord).toHaveBeenCalledTimes(1);
  expect(PluginFileAPI.insertKeyWord).toHaveBeenCalledWith('/Note/test.note', 0, 'REVIEW');
  expect(PluginManager.closePluginView).toHaveBeenCalledTimes(1);
});
it('returns to selection without placing when duplicate review is cancelled', async () => {
  await restartWithExisting(['TODO']);
  await chooseDuplicate('cancel');
  await act(async () => {await insertion;});
  expect(tree.root.findAllByType(PlacementOverlay)).toHaveLength(0);
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginFileAPI.insertKeyWord).not.toHaveBeenCalled();
  expect(PluginManager.closePluginView).not.toHaveBeenCalled();
});
it('does not request a tap when skipping an entirely duplicate batch', async () => {
  await restartWithExisting(['TODO', 'REVIEW']);
  await chooseDuplicate('skip');
  await act(async () => {await insertion;});
  expect(tree.root.findAllByType(PlacementOverlay)).toHaveLength(0);
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginFileAPI.insertKeyWord).not.toHaveBeenCalled();
});
it('reports lookup failure before any placement or write', async () => {
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'cancelled'}); await insertion; tree.unmount();});
  jest.clearAllMocks();
  (PluginFileAPI.getKeyWords as jest.Mock).mockResolvedValueOnce({success: false, error: {message: 'Lookup failed'}});
  await startBatch();
  await act(async () => {await insertion;});
  expect(tree.root.findAllByType(PlacementOverlay)).toHaveLength(0);
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginFileAPI.insertKeyWord).not.toHaveBeenCalled();
});
