import { useRef, type PointerEvent, type MouseEvent } from 'react';

// Keep vertical scrolling, pinch zoom and control taps native. Navigate once on release.
export function useHorizontalSwipe(onPrevious: () => void, onNext: () => void, disabled = false) {
  const gesture = useRef<{ id: number; x: number; y: number; started: number } | null>(null);
  const ignoreClickUntil = useRef(0);
  return {
    style: { touchAction: 'pan-y pinch-zoom' },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!event.isPrimary) { gesture.current = null; return; }
      ignoreClickUntil.current = 0;
      gesture.current = null;
      if (disabled || event.pointerType !== 'touch' || (event.target as Element).closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, started: Date.now() };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = gesture.current;
      if (!start || event.pointerId !== start.id) return;
      const x = Math.abs(event.clientX - start.x), y = Math.abs(event.clientY - start.y);
      if (y > 12 && y > x) gesture.current = null;
    },
    onPointerCancel: () => { gesture.current = null; },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const start = gesture.current;
      gesture.current = null;
      if (!start || event.pointerId !== start.id || disabled || Date.now() - start.started > 1000) return;
      const x = event.clientX - start.x, y = event.clientY - start.y;
      if (Math.abs(x) < 48 || Math.abs(x) < Math.abs(y) * 1.4) return;
      ignoreClickUntil.current = Date.now() + 400;
      event.preventDefault();
      if (x < 0) onNext(); else onPrevious();
    },
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (Date.now() < ignoreClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    },
  };
}
