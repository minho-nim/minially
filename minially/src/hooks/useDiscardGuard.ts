import { useRef, useState } from 'react';

export function useDiscardGuard(dirty: boolean, busy = false) {
  const [confirming, setConfirming] = useState(false);
  const action = useRef<(() => void) | null>(null);
  const request = (next: () => void): boolean => {
    if (busy) return false;
    if (!dirty) { next(); return true; }
    action.current = next; setConfirming(true); return false;
  };
  const cancel = () => { action.current = null; setConfirming(false); };
  const discard = () => { const next = action.current; cancel(); next?.(); };
  return { confirming, request, cancel, discard };
}
