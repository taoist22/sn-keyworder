jest.mock('sn-plugin-lib', () => ({
  PluginManager: {
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
  },
}));

import {PluginManager} from 'sn-plugin-lib';
import {
  requireFileReadPermission,
  requireFileWritePermission,
} from '../pluginPermissions';

const manager = PluginManager as any;

beforeEach(() => {
  manager.hasPermission = jest.fn();
  manager.requestPermission = jest.fn();
});

test('fails closed when the permission bridge is unavailable', async () => {
  manager.hasPermission = undefined;
  manager.requestPermission = undefined;

  await expect(requireFileReadPermission()).rejects.toThrow(
    'File read access was not allowed.',
  );
});

test('does not prompt when write permission is already granted', async () => {
  manager.hasPermission!.mockResolvedValue(1);

  await expect(requireFileWritePermission()).resolves.toBeUndefined();
  expect(manager.requestPermission).not.toHaveBeenCalled();
});

test('stops when the user denies write permission', async () => {
  manager.hasPermission!.mockResolvedValue(0);
  manager.requestPermission!.mockResolvedValue(0);

  await expect(requireFileWritePermission()).rejects.toThrow(
    'File write access was not allowed.',
  );
});
