import type {
  LocalMealLanguageProvider,
  LocalMealModelAccessState,
} from '@/services/local-meal-language-provider.types';

export type LocalMealModelStartupStatus = 'ready' | 'unavailable' | 'error';

export interface LocalMealModelStartupResult {
  access: LocalMealModelAccessState;
  status: LocalMealModelStartupStatus;
  error?: string;
}

interface LocalMealModelStartupCallbacks {
  onAccess?: (access: LocalMealModelAccessState) => void;
  onProgress?: (progress: number) => void;
}

export async function warmLocalMealModelCache(
  provider: LocalMealLanguageProvider,
  callbacks: LocalMealModelStartupCallbacks = {}
): Promise<LocalMealModelStartupResult> {
  const access = await provider.getAccessState();
  callbacks.onAccess?.(access);

  if (access.availability !== 'available') {
    return { access, status: 'unavailable' };
  }

  try {
    await provider.prefetch((progress) => {
      callbacks.onProgress?.(Math.min(1, Math.max(0, progress)));
    });
    callbacks.onProgress?.(1);
    return { access, status: 'ready' };
  } catch (caughtError) {
    return {
      access,
      status: 'error',
      error: caughtError instanceof Error ? caughtError.message : 'The local model could not be prepared.',
    };
  }
}
