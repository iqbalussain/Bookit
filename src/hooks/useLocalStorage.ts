import { useState, useEffect, useCallback } from 'react';

/**
 * A storage-error event is dispatched when a write fails so any listener
 * (e.g. a global toast handler) can surface it without coupling this hook
 * to the toast system directly.
 */
function dispatchStorageError(key: string, isQuota: boolean) {
  const message = isQuota
    ? `Storage is full — could not save "${key}". Please export a backup to free up space.`
    : `Could not save data for "${key}". Check your browser's storage permissions.`;
  window.dispatchEvent(new CustomEvent('bookit:storage-error', { detail: { key, isQuota, message } }));
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`[localStorage] Error reading key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const newValue = value instanceof Function ? value(storedValue) : value;
        window.localStorage.setItem(key, JSON.stringify(newValue));
        setStoredValue(newValue);
      } catch (error) {
        console.error(`[localStorage] Error writing key "${key}":`, error);
        const isQuota =
          error instanceof DOMException &&
          (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
        dispatchStorageError(key, isQuota);
      }
    },
    [key, storedValue],
  );

  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  return [storedValue, setValue];
}
