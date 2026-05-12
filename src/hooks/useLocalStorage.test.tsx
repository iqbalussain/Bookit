import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('keeps the previous state and emits an error event when a write fails', () => {
    const errorHandler = vi.fn();
    window.addEventListener('Bookit:storage-error', errorHandler);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('app_test_key', ['saved']));

    expect(() => {
      act(() => {
        result.current[1]((prev) => [...prev, 'new']);
      });
    }).not.toThrow();

    expect(result.current[0]).toEqual(['saved']);
    expect(errorHandler).toHaveBeenCalledTimes(1);

    window.removeEventListener('Bookit:storage-error', errorHandler);
  });
});
