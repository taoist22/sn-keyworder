export type ApiRes<T> =
  | {success: boolean; result?: T; error?: {message?: string}}
  | null
  | undefined;

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function withTimeout<T>(
  task: Promise<T>,
  label: string,
  timeoutMs = 8000,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export function requireApiResult<T>(response: ApiRes<T>, fallback: string): T {
  if (!response?.success || response.result === undefined) {
    throw new Error(response?.error?.message ?? fallback);
  }
  return response.result;
}
