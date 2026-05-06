import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Prevents premature redirects when edit pages mount before records hydrate.
 * It skips exactly one missing-record check and redirects only if the record
 * is still missing on the next check.
 */
export function useDelayedMissingRedirect(
  isEditing: boolean,
  exists: boolean,
  fallbackPath: string
) {
  const navigate = useNavigate();
  const skippedOnceRef = useRef(false);

  useEffect(() => {
    if (!isEditing) return;
    if (exists) {
      skippedOnceRef.current = false;
      return;
    }
    if (!skippedOnceRef.current) {
      skippedOnceRef.current = true;
      return;
    }
    navigate(fallbackPath);
  }, [exists, fallbackPath, isEditing, navigate]);
}

export default useDelayedMissingRedirect;
