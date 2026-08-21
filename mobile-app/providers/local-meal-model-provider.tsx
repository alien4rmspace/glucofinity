import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { localMealLanguageProvider } from '@/services/local-meal-language-provider';
import {
  warmLocalMealModelCache,
  type LocalMealModelStartupStatus,
} from '@/services/local-meal-model-startup';
import type { LocalMealModelAccessState } from '@/services/local-meal-language-provider.types';

type LocalMealModelState = 'checking' | 'preparing' | LocalMealModelStartupStatus;

interface LocalMealModelContextValue {
  access?: LocalMealModelAccessState;
  state: LocalMealModelState;
  progress: number;
  error?: string;
  retry: () => void;
}

const LocalMealModelContext = createContext<LocalMealModelContextValue | undefined>(undefined);

export function LocalMealModelProvider({ children }: PropsWithChildren) {
  const mounted = useRef(true);
  const preparationId = useRef(0);
  const [access, setAccess] = useState<LocalMealModelAccessState>();
  const [state, setState] = useState<LocalMealModelState>('checking');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();

  const prepare = useCallback(() => {
    const activePreparationId = preparationId.current + 1;
    preparationId.current = activePreparationId;
    setState('checking');
    setProgress(0);
    setError(undefined);

    void warmLocalMealModelCache(localMealLanguageProvider, {
      onAccess: (nextAccess) => {
        if (!mounted.current || preparationId.current !== activePreparationId) return;
        setAccess(nextAccess);
        setState(nextAccess.availability === 'available' ? 'preparing' : 'unavailable');
      },
      onProgress: (nextProgress) => {
        if (!mounted.current || preparationId.current !== activePreparationId) return;
        setProgress(nextProgress);
      },
    }).then((result) => {
      if (!mounted.current || preparationId.current !== activePreparationId) return;
      setAccess(result.access);
      setState(result.status);
      setError(result.error);
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    prepare();
    return () => {
      mounted.current = false;
      preparationId.current += 1;
      localMealLanguageProvider.release();
    };
  }, [prepare]);

  const value = useMemo<LocalMealModelContextValue>(() => ({
    access,
    state,
    progress,
    error,
    retry: prepare,
  }), [access, error, prepare, progress, state]);

  return (
    <LocalMealModelContext.Provider value={value}>
      {children}
    </LocalMealModelContext.Provider>
  );
}

export function useLocalMealModel(): LocalMealModelContextValue {
  const context = useContext(LocalMealModelContext);
  if (!context) throw new Error('useLocalMealModel must be used inside LocalMealModelProvider.');
  return context;
}
