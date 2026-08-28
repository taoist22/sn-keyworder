import {PluginManager} from 'sn-plugin-lib';

export const FILE_READ_PERMISSION = 'plugin.permission.FILE:READ';
export const FILE_WRITE_PERMISSION = 'plugin.permission.FILE:WRITE';

const pendingRequests = new Map<string, Promise<boolean>>();

async function ensurePluginPermission(
  permission: string,
  description: string,
): Promise<boolean> {
  const manager = PluginManager as typeof PluginManager & {
    hasPermission?: (name: string) => Promise<number>;
    requestPermission?: (name: string, desc?: string) => Promise<number>;
  };

  // Older firmware did not expose the permission bridge. Continue to support it.
  if (
    typeof manager.hasPermission !== 'function' ||
    typeof manager.requestPermission !== 'function'
  ) {
    return true;
  }

  const pending = pendingRequests.get(permission);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      if (Number(await manager.hasPermission!(permission)) > 0) {
        return true;
      }
      return (
        Number(await manager.requestPermission!(permission, description)) > 0
      );
    } catch {
      return false;
    }
  })();

  pendingRequests.set(permission, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(permission);
  }
}

export async function requireFileReadPermission(): Promise<void> {
  const allowed = await ensurePluginPermission(
    FILE_READ_PERMISSION,
    'Allow Keyworder to import a keyword list from shared storage.',
  );
  if (!allowed) {
    throw new Error('File read access was not allowed.');
  }
}

export async function requireFileWritePermission(): Promise<void> {
  const allowed = await ensurePluginPermission(
    FILE_WRITE_PERMISSION,
    'Allow Keyworder to add visible labels and keyword indexes to the current page.',
  );
  if (!allowed) {
    throw new Error('File write access was not allowed.');
  }
}
